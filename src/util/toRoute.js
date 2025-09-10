'use strict';

const env = process.env.NODE_ENV;
const isProduction = env === 'production';

module.exports = function toRoute(routeHandler) {
  return function routeWrapper(req, res, next) {
    return Promise.resolve(routeHandler(combineRequestParams(req), req, res)).
      then(async data => {
        // Check if routeHandler returned an async generator
        if (data && typeof data[Symbol.asyncIterator] === 'function') {
          // Set SSE headers
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.flushHeaders && res.flushHeaders();

          try {
            for await (const chunk of data) {
              // Send each chunk as SSE event
              res.write(`data: ${typeof chunk === 'string' ? chunk : JSON.stringify(chunk)}\n\n`);
            }
            res.end();
          } catch (err) {
            console.log('Error occurred during streaming:', err);
            // If error occurs during streaming, handle below
            throw err;
          }
        } else {
          if (res.headersSent) {
            if (data != null) {
              throw new Error('Return value must be nullish if headers sent');
            }
          } else if (typeof data === 'string') {
            res.send(data);
          } else {
            res.json(data);
          }
        }
      }).
      then(() => next()).
      catch(err => {
        let status = err.status;
        if (status == null) {
          status = 500;
        }
        res.status(status);

        if (res.headersSent) {
          const result = { message: err.message };
          if (!isProduction) {
            result.stack = err.stack;
          }
          if (res.getHeader('Content-Type') === 'text/event-stream') {
            // Send SSE error event
            res.write(`event: error\ndata: ${JSON.stringify(result)}\n\n`);
            res.end();
          } else {
            res.write(JSON.stringify(result));
            res.end();
          }
        } else {
          const result = { message: err.message };
          if (!isProduction) {
            result.stack = err.stack;
          }
          res.json(result);
        }


      });
  };
};

function combineRequestParams(req) {
  const headersToPass = Object.keys(req.headers || {}).filter(header => header === 'authorization' || header.startsWith('param-'));
  const headers = headersToPass.reduce((obj, key) => ({ ...obj, [key.replace(/^param-/, '')]: req.headers[key] }), {});
  return Object.assign({}, headers, req.query, req.body, req.params, { ...req._internals }); // `_internals` are properties set trusted middleware
}
