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
        if (res.headersSent) {
          if (data != null) {
            throw new Error('Return value must be nullish if headers sent');
          }
        } else if (typeof data === 'string') {
          res.send(data);
        } else {
          res.json(data);
        }

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
        let status = err.status;
        if (err != null && err.status == null && err._isArchetypeError) {
          status = 400;
        }
        if (status == null) {
          status = 500;
        }
        res.status(status);

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
  return Object.assign({}, req.headers, req.query, req.body, req.params, {
    task
  }, { ...req._internals }); // `_internals` are properties set trusted middleware
}
