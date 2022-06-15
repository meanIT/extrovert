'use strict';

const db = require('../db');

const env = process.env.NODE_ENV;
const isProduction = env === 'production';
const isTest = env === 'test';

module.exports = function toRoute(fn) {
  return function routeWrapper(req, res, next) {
    let initialPromise = Promise.resolve();
    let task = null;
    if (db.db != null) {
      const { _Task } = db.db.models;
      initialPromise = initialPromise.
        then(() => _Task.create({
          method: req.method,
          url: req.url,
          params: req.body
        })).
        then(newTask => { task = newTask; });
    }

    initialPromise.
      then(() => fn(combineRequestParams(req, task), req, res)).
      then(data => {
        res.json(data);

        if (task != null) {
          task.status = 'success';
          task.result = data;
          return task.save();
        }
      }).
      then(() => next()).
      catch(err => {
        if (!isTest) {
          console.log(`Error in ${req.method} ${req.url}`);
          console.log(err.stack);
        }
        if (err.status) {
          res.status(err.status);
        }

        const result = { message: err.message };
        if (!isProduction) {
          result.stack = err.stack;
        }
        res.json(result);

        if (task != null) {
          task.status = 'error';
          task.error.message = err.message;
          task.error.stack = err.stack;
          task.save().then(() => next(err), () => next(err));
        } else {
          next(err);
        }
      });
  };
};

function combineRequestParams(req, task) {
  return Object.assign({}, req.query, req.body, req.params, {
    authorization: req.headers.authorization,
    task
  }, { ...req._internals }); // `_internals` are properties set trusted middleware
}