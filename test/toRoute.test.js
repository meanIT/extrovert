'use strict';

const assert = require('assert');
const { describe, it } = require('mocha');
const extrovert = require('../');
const sinon = require('sinon');

describe('toRoute', function() {
  it('should send string response with res.send', async function() {
    const req = {
      headers: {},
      query: {},
      body: {},
      params: {},
      _internals: {}
    };
    const res = {
      send: sinon.spy(),
      json: sinon.spy(),
      headersSent: false
    };
    const next = sinon.spy();

    const handler = sinon.stub().returns('hello world');
    const wrapped = extrovert.toRoute(handler);

    await wrapped(req, res, next);

    assert(res.send.calledOnceWith('hello world'));
    assert(next.calledOnce);
    assert(res.json.notCalled);
  });

  it('should send object response with res.json', async function() {
    const req = {
      headers: {},
      query: {},
      body: {},
      params: {},
      _internals: {}
    };
    const res = {
      send: sinon.spy(),
      json: sinon.spy(),
      headersSent: false
    };
    const next = sinon.spy();

    const handler = sinon.stub().returns({ foo: 'bar' });
    const wrapped = extrovert.toRoute(handler);

    await wrapped(req, res, next);

    assert(res.json.calledOnceWith({ foo: 'bar' }));
    assert(next.calledOnce);
    assert(res.send.notCalled);
  });

  it('should throw if headersSent and data is not nullish', async function() {
    const req = {
      headers: {},
      query: {},
      body: {},
      params: {},
      _internals: {}
    };
    const res = {
      send: sinon.spy(),
      json: sinon.spy(),
      status: sinon.spy(),
      headersSent: true
    };
    const next = sinon.spy();

    const handler = sinon.stub().returns('not null');
    const wrapped = extrovert.toRoute(handler);

    await wrapped(req, res, next);
    assert(res.status.calledOnceWith(500));
    assert(res.json.calledOnce);
    const jsonArg = res.json.firstCall.args[0];
    assert.strictEqual(jsonArg.message, 'Return value must be nullish if headers sent');
  });

  it('should handle errors and send error response', async function() {
    const req = {
      headers: {},
      query: {},
      body: {},
      params: {},
      _internals: {}
    };
    const res = {
      send: sinon.spy(),
      json: sinon.spy(),
      status: sinon.spy(),
      headersSent: false
    };
    const next = sinon.spy();

    const handler = sinon.stub().callsFake(() => Promise.reject(Object.assign(new Error('fail'), { status: 400 })));
    const wrapped = extrovert.toRoute(handler);

    await wrapped(req, res, next);

    assert(res.status.calledOnceWith(400));
    assert(res.json.calledOnce);
    const jsonArg = res.json.firstCall.args[0];
    assert.strictEqual(jsonArg.message, 'fail');
    assert(jsonArg.stack);
  });

  it('should stream async generator as SSE', async function() {
    const req = {
      headers: {},
      query: {},
      body: {},
      params: {},
      _internals: {}
    };
    const headers = {};
    let flushed = false;
    const written = [];
    const res = {
      setHeader: (k, v) => { headers[k] = v; },
      flushHeaders: () => { flushed = true; },
      write: chunk => { written.push(chunk); },
      end: sinon.spy(),
      headersSent: false
    };
    const next = sinon.spy();

    async function* gen() {
      yield 'foo';
      yield { bar: 42 };
    }
    const handler = sinon.stub().returns(gen());
    const wrapped = extrovert.toRoute(handler);

    await wrapped(req, res, next);

    assert.strictEqual(headers['Content-Type'], 'text/event-stream');
    assert.strictEqual(headers['Cache-Control'], 'no-cache');
    assert.strictEqual(headers['Connection'], 'keep-alive');
    assert(flushed);
    assert(written[0].startsWith('data: foo'));
    assert(written[1].startsWith('data: {"bar":42}'));
    assert(res.end.calledOnce);
    assert(next.calledOnce);
  });

  it('should pass combined request params to handler', async function() {
    const req = {
      headers: { authorization: 'token', 'param-x': 'y' },
      query: { a: 1 },
      body: { b: 2 },
      params: { c: 3 },
      _internals: { d: 4 }
    };
    const res = {
      send: sinon.spy(),
      json: sinon.spy(),
      headersSent: false
    };
    const next = sinon.spy();

    let receivedParams;
    const handler = sinon.stub().callsFake((params) => {
      receivedParams = params;
      return 'ok';
    });
    const wrapped = extrovert.toRoute(handler);

    await wrapped(req, res, next);

    assert.deepStrictEqual(receivedParams, {
      authorization: 'token',
      x: 'y',
      a: 1,
      b: 2,
      c: 3,
      d: 4
    });
    assert(res.send.calledOnceWith('ok'));
    assert(next.calledOnce);
  });
});
