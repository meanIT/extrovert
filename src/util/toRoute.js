'use strict';

const logger = require('./logger');

module.exports = function toRoute(fn) {
  return function routeWrapper(req, res, next) {
    logger(`${req.method} ${req.url}`);
    fn(combineRequestParams(req), req, res).
      then(data => res.json(data)).
      catch(err => {
        logger(`Error in ${req.method} ${req.url}`);
        logger(err.stack);
        if (err.status) {
          res.status(err.status);
        }
        next(err);
      });
  };
};

function combineRequestParams(req) {
  return Object.assign({}, req.query, req.body, req.params, {
    authorization: req.headers.authorization
  }, { ...req._internals }); // `_internals` are properties set trusted middleware
}