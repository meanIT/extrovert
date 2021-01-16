'use strict';

const assert = require('assert');
const axios = require('axios');
const extrovert = require('../');

describe('Extrovert', function() {
  it('works', async function() {
    const app = extrovert();

    app.use(function(req, res) {
      res.end('hello');
    });

    const server = await app.listen(3000);

    const res = await axios.get('http://localhost:3000').
      then(res => res.data);
    assert.strictEqual(res, 'hello');

    await server.close();
  });
});