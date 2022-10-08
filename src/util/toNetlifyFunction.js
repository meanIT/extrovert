'use strict';

const applySpec = require('./applySpec');

module.exports = function toNetlifyFunction(factoryOrFn, servicesFactory) {
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

      Object.assign(
        params,
        event.queryStringParameters,
        JSON.parse(event.body || '{}'),
        { authorization: event.headers.authorization },
        req._internals
      );

      console.log(params);
      
      const res = await fn(params);
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
        body: error.toString()
      };
    }
  };

  return { handler };
};
