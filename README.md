# extrovert

> The framework for framework-free JavaScript

Write your application as plain functions, then expose those functions through Express or Netlify. Extrovert keeps routing, request mapping, and response handling at the edge so your application code remains ordinary JavaScript.

```js
const actions = {
  users: {
    getUser: ({ db }) => async({ id }) => db.users.findById(id)
  }
};
```

There are no framework base classes, decorators, or special request objects in this code. The action receives its dependencies when the application starts and a plain parameters object when it runs. You can call it from an HTTP route, a test, a script, or another action.

Extrovert is the small bridge between those functions and the outside world:

- `applySpec()` creates a nested service object from factory functions.
- `objectRouter()` turns a nested object of functions into an Express router.
- `toRoute()` adapts a function to an Express request handler.
- `pureMiddleware()` adapts promise-based request middleware to Express.
- `toNetlifyFunction()` adapts a function to a Netlify Function handler.

## Install

```sh
npm install extrovert
```

## Framework-free actions

Group your actions however you like. Each leaf is a factory that receives shared services and returns the function your application calls:

```js
const actions = {
  users: {
    getUser: ({ db }) => async({ id }) => db.users.findById(id),
    createUser: ({ db }) => async({ name }) => db.users.create({ name })
  }
};
```

`applySpec()` wires in the dependencies while preserving the shape of the object:

```js
const { applySpec } = require('extrovert');

const api = applySpec(actions, { db });
const user = await api.users.getUser({ id: '42' });
```

The resulting `api` is still an object of plain functions. Nothing ties it to HTTP. When you want an HTTP API, pass that same object to the Express adapter:

```js
const express = require('express');
const { applySpec, objectRouter, toRoute } = require('extrovert');

const api = applySpec(actions, { db });
const app = express();

app.use(express.json());
app.use('/api', objectRouter(api, toRoute));
```

This creates routes for all four supported methods at each function path:

```text
GET|PUT|POST|DELETE /api/users/getUser
GET|PUT|POST|DELETE /api/users/createUser
```

An `OPTIONS` handler is also added to each function path.

## Express adapters

### `toRoute(routeHandler)`

`toRoute()` adapts a plain action to Express and calls it as `routeHandler(params, req, res)`. Most actions only need the first argument. The original request and response are available for cases that need lower-level control.

The adapter builds `params` by merging, in increasing precedence:

1. The `authorization` header and headers prefixed with `param-` (with the prefix removed)
2. `req.query`
3. `req.body`
4. `req.params`
5. `req._internals`

Return a string to call `res.send()`, return any other value to call `res.json()`, or return `null`/`undefined` after sending a response yourself. Errors use `error.status` as the HTTP status, defaulting to 500.

An async iterable is written as a server-sent event stream:

```js
const { toRoute } = require('extrovert');

app.get('/events', toRoute(async function* events() {
  yield 'connected';
  yield { count: 1 };
}));
```

### `objectRouter(object, transformRoute, options)`

`objectRouter()` recursively maps object keys to URL path segments and function values to routes. `transformRoute` receives `(fn, fullPath)` and must return an Express request handler. It defaults to the identity function.

Use `formatRoutePath` to customize path segments:

```js
const router = objectRouter(api, toRoute, {
  formatRoutePath: key => `/${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`
});
```

Passing `null` or `undefined` as the object returns `null`.

### `pureMiddleware(fn)`

Use `pureMiddleware()` for middleware that only needs the request and returns a promise:

```js
const { pureMiddleware } = require('extrovert');

app.use(pureMiddleware(async req => {
  req._internals = { user: await loadUser(req) };
}));
```

The wrapper calls `next()` when the promise fulfills and `next(error)` when it rejects.

## Netlify adapter

The same style of plain action can run as a Netlify Function. Export the object returned by `toNetlifyFunction()`:

```js
const { toNetlifyFunction } = require('extrovert');

module.exports = toNetlifyFunction(async function getUser(params, event) {
  return db.users.findById(params.id);
});
```

The adapter combines `param-*` and `authorization` headers, query parameters, and a JSON request body into `params`. Successful results are JSON-encoded with status 200. Thrown errors produce status 500 with a JSON body containing `message` and `extra`, when present. All responses include an `access-control-allow-origin: *` header, and `OPTIONS` requests receive an empty 200 response.

Pass a service factory when the action itself needs to be created per invocation:

```js
module.exports = toNetlifyFunction(
  services => params => services.users.findById(params.id),
  async () => ({ users: await connectToUsers() }),
  'getUser'
);
```

When the request accepts `text/event-stream` and the action returns an async iterable, the response body is an async iterable of server-sent event chunks.

## `applySpec(spec, ...args)`

`applySpec()` is the dependency-wiring piece of Extrovert. It recursively calls every function in `spec` with the supplied arguments and returns an object with the same shape. Properties attached to each factory function are copied onto its result.

```js
const { applySpec } = require('extrovert');

const spec = {
  users: services => ({
    findById: id => services.db.users.findById(id)
  })
};

const api = applySpec(spec, { db });
await api.users.findById('42');
```

## License

Apache-2.0
