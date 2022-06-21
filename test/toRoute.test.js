'use strict';

const assert = require('assert');
const { after, before, beforeEach, describe, it } = require('mocha');
const extrovert = require('../');
const mongoose = require('mongoose');
const sinon = require('sinon');

describe('toRoute', function() {
  before(async function() {
    await mongoose.connect('mongodb://localhost:27017/extrovert_test');
    extrovert.registerExtrovertModels();
  });

  after(function() {
    return mongoose.disconnect();
  });

  beforeEach(async function() {
    await mongoose.model('_Task').deleteMany({});
  });

  it('handles tasks', async function() {
    const functionCallParams = [];
    async function test(params) {
      functionCallParams.push(params);
      return { answer: 42 };
    }

    const route = extrovert.toRoute(test);

    const res = { json: sinon.stub() };
    const result = await new Promise((resolve, reject) => {
      route({ headers: {}, body: { hello: 'world' } }, res, function(err) {
        if (err != null) {
          return reject(err);
        }
        resolve(res.json.getCall(0).args[0]);
      });
    });

    assert.deepEqual(result, { answer: 42 });
    assert.equal(functionCallParams.length, 1);
    assert.equal(functionCallParams[0].hello, 'world');

    const tasks = await mongoose.model('_Task').find();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].status, 'success');
    assert.deepEqual(tasks[0].result, { answer: 42 });
  });

  it('handles task errors', async function() {
    async function test() {
      throw new Error('Oops!');
    }

    const route = extrovert.toRoute(test);

    const res = { json: sinon.stub(), status: sinon.stub() };
    const result = await new Promise((resolve, reject) => {
      route({ headers: {}, body: { hello: 'world' } }, res, function(err) {
        if (err != null) {
          return reject(err);
        }
        resolve(res.json.getCall(0).args[0]);
      });
    }).then(() => null, err => err);

    assert.equal(result.message, 'Oops!');
    assert.equal(res.status.getCall(0).args[0], 500);
    assert.equal(res.json.getCall(0).args[0].message, 'Oops!');

    const tasks = await mongoose.model('_Task').find();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].status, 'error');
    assert.deepEqual(tasks[0].error.message, 'Oops!');
  });
});