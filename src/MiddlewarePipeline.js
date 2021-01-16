'use strict';

const Layer = require('./Layer');

class MiddlewarePipeline {
  constructor() {
    this.init();
  }

  init() {
    this._stack = [];
  }

  use(url, middleware) {
    if (arguments.length === 1) {
      middleware = url;
      url = null;
    }
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function!');
    }
    this._stack.push(new Layer(null, url, middleware, { end: false }));
  }

  route(method, url, handler) {
    this._stack.push(new Layer(method, url, handler));
    return this;
  }

  get(url, handler) {
    return this.route('GET', url, handler);
  }

  handle(req, res, callback) {
    let idx = 0;

    const next = (err) => {
      // If an error occurred, bypass the rest of the pipeline. In Express,
      // you would still need to look for error handling middleware, but
      // this example does not support that.
      if (err != null) {
        return setImmediate(() => callback(err));
      }
      if (idx >= this._stack.length) {
        return setImmediate(() => callback());
      }

      let layer = this._stack[idx++];
      // Find the next layer that matches
      while (idx <= this._stack.length && !layer.match(req.method, req.url)) {
        layer = this._stack[idx++];
      }
      // If no more layers, we're done.
      if (layer == null) {
        return setImmediate(() => callback());
      }

      // Decorate `req` with the layer's `params`. Make sure to do it
      // **outside** `setImmediate()` because of concurrency concerns.
      req.params = Object.assign({}, layer.params);

      const originalUrl = req.url;
      req.path = layer.path;
      req.url = req.url.substr(req.path.length);

      try {
        // Switch to using `setImmediate()` in the callback, because `req.url`
        // needs to be reset synchronously before calling `next()`
        const retVal = layer.middleware(req, res, err => {
          setImmediate(() => next(err));
        });
        req.url = originalUrl;
        if (retVal instanceof Promise) {
          retVal.catch(error => next(error));
        }
      } catch(error) {
        req.url = originalUrl;
        next(error);
      }
    };

    next();
  }
}

module.exports = MiddlewarePipeline;