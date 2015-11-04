'use strict';
const Joi = require('joi');
const Boom = require('boom');

const internals = {};

internals.schema = Joi.object().keys({
    allowedRetries: Joi.number().positive().optional(),
    initialWait: Joi.number().positive().optional(),
    maxWait: Joi.number().positive().optional(),
    timeWindow: Joi.number().positive().optional(),
    proxyCount: Joi.number().positive().allow(0).optional(),
    preResponse: Joi.boolean().optional()
});

internals.defaults = {
    allowedRetries: 5,
    initialWait: 100,
    maxWait: 15000,
    timeWindow: 6 * 60 * 1000,
    proxyCount: 0,
    preResponse: false
};
internals.getIP = ( request, count ) => {

    if (count && request.headers['x-forwarded-for']) {
        const proxies = request.headers['x-forwarded-for'].split(',').filter((chunk) => chunk.trim());
        if (proxies.length > count) {
            return proxies[proxies.length - count - 1].trim();
        }
        if (proxies[0]) {
            return proxies[0].trim();
        }

    }
    return request.info.remoteAddress;
};

internals.delays = {};
internals.getDelays = (initialWait, allowedRetries, maxWait) => {

    if (internals.delays[initialWait] === undefined) {

        let next = initialWait;
        let newDelay = initialWait;
        internals.delays[initialWait] = [];
        for (let i = 0; i < allowedRetries; i++) {

            internals.delays[initialWait][i] = Math.min(newDelay, maxWait);
            newDelay += next;
            next = internals.delays[initialWait][i];

        }
    }
    return internals.delays[initialWait];
};

internals.delay = function delay ( key, value, request, settings, cache) {

    return new Promise((resolve, reject) => {

        let id = value;
        if (key === 'ip') {
            id = internals.getIP(request, settings.proxyCount);
        }
        cache.get(key + '-' + id, ( err, cached, stored, cacheInfo ) => {

            if (err) {
                return reject(Boom.internal(err));
            }
            // new ip
            if (cached === null) {
                cache.set(key + '-' + id, { attemps: 0, lastAttemp: Date.now() }, 0, (err) => {

                    if (err) {
                        return reject(Boom.internal(err));
                    }
                    return resolve({ continue: true });
                });
            }
            else {
                const delays = internals.getDelays(settings.initialWait, settings.allowedRetries, settings.maxWait);
                const remainingTime = delays[cached.attemps] - (Date.now() - cached.lastAttemp);
                cached.attemps += 1;
                if (cached.attemps > settings.allowedRetries) {
                    reject({
                        err:{
                            statusCode: 429,
                            error: 'Too Many Requests',
                            message: 'you have exceeded your request limit'
                        },
                        code: 429,
                        header:{ key: 'Retry-After', val: cacheInfo.ttl }
                    });
                }
                cached.lastAttemp = Date.now() + remainingTime;
                cache.set(key + '-' + id, cached, 0, (err) => {

                    if (err) {
                        return reject(Boom.internal(err));
                    }
                    if (remainingTime > 0) {
                        // delay the response
                        setTimeout(resolve, remainingTime);
                    }
                    else {
                        return resolve();
                    }
                });
            }
        });
    });
};

internals.drop = function drop (key, request, settings, cache) {

    return new Promise((resolve, reject) => {

        cache.drop(key, (err) => {

            if (err) {
                return reject(Boom.internal(err));
            }
            resolve();
        });
    });
};

exports.register = function (server, options, next) {

    let validateOptions = internals.schema.validate(options);
    if (validateOptions.error) {
        return next(validateOptions.error);
    }

    const settings = Object.assign({}, internals.defaults, options);
    const cache = server.cache({ segment: 'hapi-brute', expiresIn: settings.timeWindow });

    server.decorate('reply', 'brute', function (key, val, cb) {

        const curKey = typeof key === 'string' && key || 'ip';
        const callback = (typeof key === 'function' && key) || (typeof cb === 'function' && cb);
        // const promise = typeof key === 'object' && key.then ? key : null;
        let value = typeof val === 'string' && val || null;
        if (curKey !== 'ip' && value === null) {
            const err = Boom.internal('Must provide a value if key is not the default');
            this.response(err);
            return Promise.reject(err);
        }
        let routeSettings = this.request.route.settings.plugins.brute;
        if (typeof routeSettings === 'object') {
            validateOptions = internals.schema.validate(routeSettings);
            if (validateOptions.error) {
                return this.response(validateOptions.error);
            }
            routeSettings = Object.assign({}, settings, routeSettings);
        }
        else {
            routeSettings = settings;
        }
        if (curKey === 'ip') {
            value = internals.getIP(this.request, routeSettings.proxyCount);
        }
        const reset = (resetCallback) => {

            internals.drop(curKey + '-' + value, this.request, routeSettings, cache) //eslint-disable-line
            .then(() => {

                try {
                    resetCallback && resetCallback();
                }
                catch (err) {
                    this.response(err);
                    return Promise.reject(err);
                }
                return Promise.resolve();
            }, (err) => {

                this.response(err);
                return Promise.reject(err);
            });
        };
        return internals.delay(curKey, value, this.request, routeSettings, cache)
        .then(() => {

            try {
                callback && callback(null, reset);
            }
            catch (err) {
                this.response(err);
                return Promise.reject(err);
            }
            return Promise.resolve(reset);
        }, (result) => {

            if (result.code) {
                this.response(result.err).code(result.code).header(result.header.key, result.header.val);
                return Promise.reject(result.err);
            }
            this.response(result);
            return Promise.reject(result);
        });
    });

    server.ext('onPreAuth', (request, reply) => {

        if (!request.route.settings.plugins.brute) {
            return reply.continue();
        }
        let routeOptions = request.route.settings.plugins.brute;
        if (typeof routeOptions === 'object') {
            validateOptions = internals.schema.validate(routeOptions);
            if (validateOptions.error) {
                return reply(validateOptions.error);
            }
            routeOptions = Object.assign({}, settings, routeOptions);
        }
        else {
            routeOptions = settings;
        }
        if (routeOptions.preResponse) {

            internals.delay('ip', null, request, routeOptions, cache)
            .then(() => (reply.continue())
                , (result) => {

                    if (result.code) {
                        return reply(result.err).code(result.code).header(result.header.key, result.header.val);
                    }
                    return reply(result);
                });
        }
        else {
            return reply.continue();
        }
    });

    return next();
};

exports.register.attributes = {
    name: 'brute',
    version: '1.0.0'
};
