'use strict';

const MiddlewarePipeline = require('./src/MiddlewarePipeline');
const http = require('http');

function Extrovert() {
  if (!(this instanceof Extrovert)) {
    return new Extrovert();
  }

  MiddlewarePipeline.prototype.init.call(this);
}

Extrovert.prototype = Object.create(MiddlewarePipeline.prototype);

Extrovert.prototype.listen = function listen(port, callback) {
  const handler = (req, res) => {
    this.handle(req, res, err => {
      if (err) {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });
  };
  return http.createServer(handler).listen({ port }, callback);
}

module.exports = Extrovert;