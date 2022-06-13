'use strict';

module.exports = function pureMiddleware(fn) {
  return function wrappedMiddleware(req, res, next) {
    fn(req).then(() => next(), err => next(err));
  };
};