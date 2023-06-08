'use strict';

const applySpec = require('./applySpec');

module.exports = function toNetlifyFunction(factoryOrFn, servicesFactory, name) {
  const handler = async(event) => {
    let services = null;
    let fn = factoryOrFn;
    if (servicesFactory != null) {
      services = await servicesFactory();
      fn = factoryOrFn(services);
    }

    try {
      const params = {};

      const req = { headers: event.headers, _internals: {} };

      const headersToPass = Object.keys(req.headers || {}).filter(header => header === 'authorization' || header.startsWith('param-'));
      const headers = headersToPass.reduce((obj, key) => ({ ...obj, [key.replace(/^param-/, '')]: req.headers[key] }), {});

      Object.assign(
        params,
        headers,
        event.queryStringParameters,
        JSON.parse(event.body || '{}'),
        { authorization: event.headers.authorization },
        req._internals
      );

      console.log(new Date(), 'Calling', name || fn.name);
      console.log(new Date(), 'Params', params);
      
      const res = await fn(params);
      console.log(new Date(), 'Result', res);
      return {
        statusCode: 200,
        body: JSON.stringify(res)
      };
    } catch (error) {
      console.log(error.stack);
      if (error.extra) {
        console.log(error.extra);
      }
      return {
        statusCode: 500,
        body: JSON.stringify({ message: error.message })
      };
    }
  };

  return { handler };
};
