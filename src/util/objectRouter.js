'use strict';

const express = require('express');

module.exports = function createObjectRouter(obj, transformRoute, base) {
  if (obj == null) {
    return null;
  }

  const router = express.Router();
  transformRoute = transformRoute || noop;

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = base ? `${base}/${key}` : key;
    if (typeof value === 'function') {
      router.options(`/${key}`, (req, res) => res.send(''));
      router.get(`/${key}`, transformRoute(value, fullPath));
      router.put(`/${key}`, transformRoute(value, fullPath));
      router.post(`/${key}`, transformRoute(value, fullPath));
      router.delete(`/${key}`, transformRoute(value, fullPath));
      continue;
    }

    if (value != null && typeof value === 'object') {
      router.use(`/${key}`, createObjectRouter(value, transformRoute, fullPath));
    }
  }

  return router;
};

function noop(v) {
  return v;
}