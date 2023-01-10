'use strict';

const applySpec = require('../src/util/applySpec');
const assert = require('assert');
const { describe, it } = require('mocha');

describe('applySpec', function() {
  it('applies function properties to result', function() {
    const obj = {
      fn: () => getAnswer
    };
    obj.fn.hideFromAPI = true;

    const res = applySpec(obj);
    assert.strictEqual(res.fn.hideFromAPI, true);
    assert.strictEqual(res.fn, getAnswer);

    function getAnswer() { return 42; }
  });
});