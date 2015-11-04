'use strict';
const Code = require('code');
const Lab = require('lab');
const Hapi = require('hapi');
const Brute = require('../');
// const Boom = require('boom');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

describe('Brute', () => {

    it('starts', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                return reply('ok');
            }
        });
        server.register(Brute, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['retry-after']).to.not.exist();
                    done();
                });
            });
        });
    });
    it('does not start if option not set', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            handler: function (request, reply) {

                return reply('ok');
            }
        });
        server.register(Brute, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['retry-after']).to.not.exist();
                    done();
                });
            });
        });
    });
    it('errors if server cache not started', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                return reply('ok');
            }
        });
        server.register({ register: Brute, options:{ preResponse: true } }, (err) => {

            expect(err).to.not.exist();
            server.inject({ method: 'GET', url: '/1' }, (res) => {

                expect(res.statusCode).to.equal(500);
                expect(res.headers['retry-after']).to.not.exist();
                done();
            });
        });
    });
    it('handles brute attempts - no proxy', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: { preResponse: true } } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                return reply('ok');
            }
        });
        server.register({ register: Brute, options:{ initialWait: 200, allowedRetries:2, preResponse: true } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['retry-after']).to.not.exist();
                    let time = Date.now();
                    server.inject({ method: 'GET', url: '/1' }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(Date.now() - time).to.be.at.least(150);
                        expect(res.headers['retry-after']).to.not.exist();
                        time = Date.now();
                        server.inject({ method: 'GET', url: '/1' }, (res) => {

                            expect(res.statusCode).to.equal(200);
                            expect(Date.now() - time).to.be.at.least(350);
                            expect(res.headers['retry-after']).to.not.exist();
                            server.inject({ method: 'GET', url: '/1' }, (res) => {

                                expect(res.statusCode).to.equal(429);
                                expect(res.headers['retry-after']).to.be.at.least(359500);
                                server.inject({ method: 'GET', url: '/1' }, (res) => {

                                    expect(res.statusCode).to.equal(429);
                                    expect(res.headers['retry-after']).to.be.at.least(359500);
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    });
    it('handles proxies - count within limit', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                return reply('ok');
            }
        });
        server.register({ register: Brute, options:{ initialWait: 20, allowedRetries:1, proxyCount: 2, preResponse: true } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1', headers: { 'X-Forwarded-For': '129.78.138.66, 129.78.64.103, 10.100.0.123' } }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['retry-after']).to.not.exist();
                    server.inject({ method: 'GET', url: '/1', headers: { 'X-Forwarded-For': '129.78.138.66, 129.78.64.103, 10.100.0.123' } }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(res.headers['retry-after']).to.not.exist();
                        server.inject({ method: 'GET', url: '/1', headers: { 'X-Forwarded-For': '129.78.138.66, 129.78.64.103, 10.100.0.123' } }, (res) => {

                            expect(res.statusCode).to.equal(429);
                            expect(res.headers['retry-after']).to.be.at.least(30);
                            server.inject({ method: 'GET', url: '/1', headers: { 'X-Forwarded-For': '129.78.138.67, 129.78.64.103, 10.100.0.123' } }, (res) => {

                                expect(res.statusCode).to.equal(200);
                                expect(res.headers['retry-after']).to.not.exist();
                                done();
                            });
                        });
                    });
                });
            });
        });
    });
    it('handles proxies - count out of limit', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                return reply('ok');
            }
        });
        server.register({ register: Brute, options:{ initialWait: 20, allowedRetries:1, proxyCount: 4, preResponse: true } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1', headers: { 'X-Forwarded-For': '129.78.138.66, 129.78.64.103, 10.100.0.123' } }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['retry-after']).to.not.exist();
                    server.inject({ method: 'GET', url: '/1', headers: { 'X-Forwarded-For': '129.78.138.66, 129.78.64.103, 10.100.0.123' } }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(res.headers['retry-after']).to.not.exist();
                        server.inject({ method: 'GET', url: '/1', headers: { 'X-Forwarded-For': '129.78.138.66, 129.78.64.103, 10.100.0.123' } }, (res) => {

                            expect(res.statusCode).to.equal(429);
                            expect(res.headers['retry-after']).to.be.at.least(30);
                            server.inject({ method: 'GET', url: '/1', headers: { 'X-Forwarded-For': '129.78.138.67, 129.78.64.103, 10.100.0.123' } }, (res) => {

                                expect(res.statusCode).to.equal(200);
                                expect(res.headers['retry-after']).to.not.exist();
                                done();
                            });
                        });
                    });
                });
            });
        });
    });
    it('resets attempts - as promised', (done) => {

        const server = new Hapi.Server({ debug: { request: ['error'] } });
        let doReset = false;
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                if (doReset) {
                    reply.brute()
                    .then((reset) => (reset()))
                    .then(() => {

                        reply('didReset');
                    });
                }
                else {
                    reply('ok');
                }
            }
        });
        server.register({ register: Brute, options:{ initialWait: 20, allowedRetries:2, proxyCount: 2, preResponse: true } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['retry-after']).to.not.exist();
                    doReset = true;
                    server.inject({ method: 'GET', url: '/1' }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(res.headers['retry-after']).to.not.exist();
                        server.inject({ method: 'GET', url: '/1' }, (res) => {

                            expect(res.result).to.equal('didReset');
                            expect(res.statusCode).to.equal(200);
                            expect(res.headers['retry-after']).to.not.exist();
                            server.inject({ method: 'GET', url: '/1' }, (res) => {

                                expect(res.statusCode).to.equal(200);
                                expect(res.headers['retry-after']).to.not.exist();
                                done();
                            });
                        });
                    });
                });
            });
        });
    });
    it('resets attempts - with callbacks', (done) => {

        const server = new Hapi.Server({ debug: { request: ['error'] } });
        let doReset = false;
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                if (doReset) {

                    reply.brute((err, reset) => {

                        reset(() => {

                            reply('didReset');
                        });
                    });
                }
                else {
                    reply('ok');
                }
            }
        });
        server.register({ register: Brute, options:{ initialWait: 20, allowedRetries:2, proxyCount: 2, preResponse: true } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['retry-after']).to.not.exist();
                    doReset = true;
                    server.inject({ method: 'GET', url: '/1' }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(res.headers['retry-after']).to.not.exist();
                        server.inject({ method: 'GET', url: '/1' }, (res) => {

                            expect(res.result).to.equal('didReset');
                            expect(res.statusCode).to.equal(200);
                            expect(res.headers['retry-after']).to.not.exist();
                            server.inject({ method: 'GET', url: '/1' }, (res) => {

                                expect(res.statusCode).to.equal(200);
                                expect(res.headers['retry-after']).to.not.exist();
                                done();
                            });
                        });
                    });
                });
            });
        });
    });
    it('catches errors in callbacks', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();

                reply.brute(() => {

                    throw new Error('some error');
                });
            }
        });
        server.register({ register: Brute, options:{ initialWait: 20, allowedRetries:2, proxyCount: 2, preResponse: true } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(500);
                    expect(res.headers['retry-after']).to.not.exist();
                    done();
                });
            });
        });
    });
    it('catches errors in reset callbacks', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                reply.brute((err, reset) => {

                    reset(() => {

                        reply(badVar);
                    });
                });
            }
        });
        server.register({ register: Brute, options:{ initialWait: 20, allowedRetries:2, proxyCount: 2, preResponse: true } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });
    });
    it('honors route options', (done) => {

        const server = new Hapi.Server({ debug: { request: ['error'] } });
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: { initialWait: 500 } } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                reply.brute()
                .then(() => {

                    reply('ok');
                });
            }
        });
        server.register({ register: Brute, options:{ initialWait: 200, allowedRetries:2 } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();

                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('ok');

                    const t = Date.now();
                    expect(res.headers['retry-after']).to.not.exist();
                    server.inject({ method: 'GET', url: '/1' }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(Date.now() - t).to.be.at.least(500);
                        expect(res.headers['retry-after']).to.not.exist();
                        server.inject({ method: 'GET', url: '/1' }, (res) => {

                            expect(res.statusCode).to.equal(200);
                            expect(Date.now() - t).to.be.at.least(950);
                            server.inject({ method: 'GET', url: '/1' }, (res) => {

                                expect(res.statusCode).to.equal(429);
                                expect(Date.now() - t).to.be.at.least(1390);
                                expect(res.headers['retry-after']).to.be.at.least(10850);
                                server.inject({ method: 'GET', url: '/1' }, (res) => {

                                    expect(res.statusCode).to.equal(429);
                                    expect(res.headers['retry-after']).to.be.at.least(359500);
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    });
    it('fails on malformed options', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: { initialWait: 'alot' } } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                reply.brute(new Promise((resolve, reject) => {

                    resolve('ok');
                }));
            }
        });
        server.register({ register: Brute, options:{ initialWait: 200, allowedRetries:2 } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });
    });
    it('function can handle promises', (done) => {

        const server = new Hapi.Server({ debug: { request: ['error'] } });
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                reply.brute()
                .then(() => (new Promise((resolve) => (resolve()))))
                .then(() => {

                    reply('ok');
                });
            }
        });
        server.register({ register: Brute, options:{ initialWait: 200, allowedRetries:2 } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('ok');
                    expect(res.headers['retry-after']).to.not.exist();
                    server.inject({ method: 'GET', url: '/1' }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        const t = Date.now();
                        expect(res.headers['retry-after']).to.not.exist();
                        server.inject({ method: 'GET', url: '/1' }, (res) => {

                            expect(res.statusCode).to.equal(200);
                            expect(Date.now() - t).to.be.at.least(150);
                            server.inject({ method: 'GET', url: '/1' }, (res) => {

                                expect(res.statusCode).to.equal(429);
                                expect(res.headers['retry-after']).to.be.at.least(350);
                                server.inject({ method: 'GET', url: '/1' }, (res) => {

                                    expect(res.statusCode).to.equal(429);
                                    expect(res.headers['retry-after']).to.be.at.least(359500);
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    });
    it('function can handle callbacks', (done) => {

        const server = new Hapi.Server({ debug: { request: ['error'] } });
        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                reply.brute(() => {

                    reply('ok');
                });
            }
        });
        server.register({ register: Brute, options:{ initialWait: 200, allowedRetries:2 } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('ok');
                    expect(res.headers['retry-after']).to.not.exist();
                    server.inject({ method: 'GET', url: '/1' }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        const t = Date.now();
                        expect(res.headers['retry-after']).to.not.exist();
                        server.inject({ method: 'GET', url: '/1' }, (res) => {

                            expect(res.statusCode).to.equal(200);
                            expect(Date.now() - t).to.be.at.least(150);
                            server.inject({ method: 'GET', url: '/1' }, (res) => {

                                expect(res.statusCode).to.equal(429);
                                expect(res.headers['retry-after']).to.be.at.least(350);
                                server.inject({ method: 'GET', url: '/1' }, (res) => {

                                    expect(res.statusCode).to.equal(429);
                                    expect(res.headers['retry-after']).to.be.at.least(359500);
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    });
    it('function respects keys and values', (done) => {

        const server = new Hapi.Server({ debug: { request: ['error'] } });
        let username = 'john';

        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                reply.brute('username', username, () => {

                    reply(username);
                });
            }
        });
        server.register({ register: Brute, options:{ initialWait: 200, allowedRetries:2 } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('john');
                    expect(res.headers['retry-after']).to.not.exist();
                    server.inject({ method: 'GET', url: '/1' }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        const t = Date.now();
                        expect(res.headers['retry-after']).to.not.exist();
                        server.inject({ method: 'GET', url: '/1' }, (res) => {

                            expect(res.statusCode).to.equal(200);
                            expect(Date.now() - t).to.be.at.least(150);
                            server.inject({ method: 'GET', url: '/1' }, (res) => {

                                expect(res.statusCode).to.equal(429);
                                expect(res.headers['retry-after']).to.be.at.least(350);
                                username = 'otherJohn';
                                server.inject({ method: 'GET', url: '/1' }, (res) => {

                                    expect(res.statusCode).to.equal(200);
                                    expect(res.result).to.equal('otherJohn');
                                    expect(res.headers['retry-after']).to.not.exist();
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    });
    it('function fails when invalid parameters are sent', (done) => {

        const server = new Hapi.Server();
        const username = 'john';

        server.connection();
        server.route({
            method: 'GET',
            path: '/1',
            config: { plugins: { brute: true } },
            handler: function (request, reply) {

                expect(reply.brute).to.exist();
                reply.brute('username', () => (username));
            }
        });
        server.register({ register: Brute, options:{ initialWait: 200, allowedRetries:2 } }, (err) => {

            expect(err).to.not.exist();
            server.start((err) => {

                expect(err).to.not.exist();
                server.inject({ method: 'GET', url: '/1' }, (res) => {

                    expect(res.statusCode).to.equal(500);
                    expect(res.result.statusCode).to.equal(500);
                    done();
                });
            });
        });
    });
});
