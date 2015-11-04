**Brute** adds brute force mitigation to [**hapi**](https://github.com/hapijs/hapi)-based application servers. It creates a Fibonacci sequence to delay responses, if the maximum allowed calls is exhausted, the route returns `429` status with a `Retry-After` header indicating how long a client should wait before attempting to call.

## Installation

```
npm install hapi-brute
```

## Unit tests

```
npm test
```

## Usage

### On preResponse
In this mode the plugin is invoked early in the response cycle and requires no change to route handler. given that it is invoked early the plugin will determine brute attempts based on the `IP address` of the request **only**. 
#### example
```
server.route({
method: 'GET',
        	path: '/1',
        	config: {plugins: {brute: {preResponse: true}},
        	handler: function (request, reply) {
        		return reply('ok');
        	});
```

### User invoked
When you need to limit requests based on an arbitrary condition, for example the username someone is using to log in

#### callback example
```
server.route({
	method: 'GET',
	path: '/1',
	config: {plugins: {brute: true}},
	handler: function (request, reply) {
		const user = request.auth.credentials.username;
		reply.brute('username', user, (err, reset)=> {
			if(validUser(user)) {
				// reset the counter for the user
				// after a valid attempt
				reset((err)=> {
					reply('welcome ' + username);
				});
			} else {
				reply('Invalid username/password');
			}
		});
    	}
});
```
#### promise example
```
server.route({
	method: 'GET',
	path: '/1',
	config: {plugins: {brute: true}},
	handler: function (request, reply) {
		const user = request.auth.credentials.username;
		reply.brute('username', user)
		.then((reset)=> {
			if(validUser(user)) {
				// reset the counter for the user
				// after a valid attempt
				return reset()
				.then(() => {
					reply('welcome ' + username);
				});
			} else {
				reply('Invalid username/password');
			}
		});
    	}
});
```
### Plugin options

```
{
    allowedRetries: 5,	// the number of attempts before the client gets a 429 response
    					// the first attempt will see no delay the second will see 200ms delay
    					// 3rd - 5th attempts will see longer delays calculated using a Fibonacci sequence
    initialWait: 200, 	// the initial delay the client will exhibit after the first attempt
    maxWait: 15000,		// during the allowed retries, the delay will not exceed this value
    timeWindow: 6 * 60 * 1000, // once a client gets a 429, it has to wait for the amount of time to expire
    proxyCount: 0,		// which proxy in the proxy list in the x-forwarded-for header should be used
    					// 0 is disables considering proxies
    preResponse: false	// should the plugin kick-in before before the route handler is invoked
}
```
