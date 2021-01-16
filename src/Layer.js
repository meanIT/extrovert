'use strict';

const pathToRegexp = require('path-to-regexp');

class Layer {
  constructor(method, url, middleware, opts) {
    this.method = method;
    this.path = '';
    if (url != null) {
      this.keys = [];
      this.url = pathToRegexp(url, this.keys, opts);
    }
    this.middleware = middleware;
  }

  match(method, url) {
    // Matching method is easy: if specified, check to see if it matches
    if (this.method != null && this.method !== method) {
      return false;
    }
    // Matching URL is harder: need to check if the regexp matches, and
    // then pull out the URL params.
    if (this.url != null) {
      const match = this.url.exec(url);
      // If the URL doesn't match, this layer doesn't match
      if (match == null) {
        return false;
      }
      // Store the part of the URL that matched, so `this.path` will
      // contain `/hello` if we do `app.use('/hello', fn)` and
      // get `/hello/world`
      this.path = match[0];

      // Copy over params
      this.params = {};
      for (let i = 1; i < match.length; ++i) {
        // First element of the `match` array is always the part of the URL
        // that matched.
        this.params[this.keys[i - 1].name] = decodeURIComponent(match[i]);
      }
    }

    return true;
  }
}

module.exports = Layer;