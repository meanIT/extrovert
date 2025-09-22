'use strict';

const applySpec = require('./applySpec');

module.exports = function toNetlifyFunction(factoryOrFn, servicesFactory, name) {
  const handler = async(event, context) => {
    let services = null;

    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'access-control-allow-origin': '*',
          'Access-Control-Allow-Headers': '*'
        },
        body: ''
      };
    }

    let fn = factoryOrFn;
    if (servicesFactory != null) {
      services = await servicesFactory();
      fn = factoryOrFn(services);
    }

    // If the Netlify function is invoked with a flag for streaming/SSE, check for it
    const isSSE =
      (event.headers &&
        (event.headers.accept === 'text/event-stream' ||
          event.headers['accept'] === 'text/event-stream' ||
          event.headers.Accept === 'text/event-stream')) ||
      (event.multiValueHeaders &&
        event.multiValueHeaders.accept &&
        event.multiValueHeaders.accept.includes('text/event-stream'));

    // Netlify doesn't natively support streaming from background functions,
    // but allows using 'callback' (for async response streaming) in their Lambda v1 API.
    // For max compatibility, we support both Promise and callback flavors.
    // Our SSE support will depend on context.succeed / callback support.

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

      const result = await fn(params, event);

      // If async generator and SSE requested, stream as Netlify Lambda streaming response
      if (
        isSSE &&
        result &&
        typeof result === 'object' &&
        typeof result[Symbol.asyncIterator] === 'function'
      ) {
        // If context is given and has succeed (AWS style), use it
        // Otherwise, fallback to Netlify's special return for streaming
        // See: https://docs.netlify.com/functions/deploy-and-invoke/#http-streaming
        // We're going to check if 'context' is present and has 'succeed', else error

        // Helper to build SSE chunk from data
        function sseChunk(data) {
          return `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;
        }

        // Netlify Lambda: streaming supported by returning a special object with a body
        // that is a stream or async iterable (for Node 18+)
        // However, since there's no direct streaming in callback-style for all Netlify invocations (unless using background functions),
        // The officially supported way for synchronous invocations is via 'return' of a special 'body' with '[Symbol.asyncIterator]'.

        // See https://docs.netlify.com/functions/deploy-and-invoke/#http-streaming
        // We'll build and return a response object with a streamed body
        const body = {
          async *[Symbol.asyncIterator]() {
            try {
              for await (const chunk of result) {
                yield sseChunk(chunk);
              }
            } catch (err) {
              // Send SSE error event and then end
              yield `event: error\ndata: ${JSON.stringify({ message: err.message, stack: err.stack })}\n\n`;
            }
          }
        };

        return {
          statusCode: 200,
          headers: {
            'access-control-allow-origin': '*',
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
          },
          body
        };
      }

      // Standard non-streaming response
      console.log(new Date(), 'Result', result);
      return {
        statusCode: 200,
        headers: {
          'access-control-allow-origin': '*'
        },
        body: JSON.stringify(result)
      };
    } catch (error) {
      console.log(error.stack);
      if (error.extra) {
        console.log(error.extra);
      }

      // For an SSE request, emit the error as an SSE event
      const isSSE =
        (event.headers &&
          (event.headers.accept === 'text/event-stream' ||
            event.headers['accept'] === 'text/event-stream' ||
            event.headers.Accept === 'text/event-stream')) ||
        (event.multiValueHeaders &&
          event.multiValueHeaders.accept &&
          event.multiValueHeaders.accept.includes('text/event-stream'));

      if (isSSE) {
        const sseErr =
          `event: error\ndata: ${JSON.stringify({ message: error.message, stack: error.stack, extra: error.extra })}\n\n`;
        // Return as an SSE stream (using async iterable)
        const body = {
          async *[Symbol.asyncIterator]() {
            yield sseErr;
          }
        };
        return {
          statusCode: 500,
          headers: {
            'access-control-allow-origin': '*',
            'Content-Type': 'text/event-stream',
            'Access-Control-Allow-Headers': '*'
          },
          body
        };
      }

      return {
        statusCode: 500,
        headers: {
          'access-control-allow-origin': '*',
          'Access-Control-Allow-Headers': '*'
        },
        body: JSON.stringify({ message: error.message, extra: error.extra })
      };
    }
  };

  return { handler };
};
