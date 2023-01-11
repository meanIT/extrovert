'use strict';

const express = require('express');

module.exports = function createObjectRouter(obj, transformRoute, options, base) {
  if (obj == null) {
    return null;
  }

  const router = express.Router();
  transformRoute = transformRoute || noop;
  const formatRoutePath = options && options.formatRoutePath || (v => `/${v}`);

  for (const [key, value] of Object.entries(obj)) {
    const formattedKey = formatRoutePath(key, base);
    const fullPath = base ? `${base}${formattedKey}` : formattedKey;
    if (typeof value === 'function') {
      router.options(formattedKey, (req, res) => res.send(''));
      router.get(formattedKey, transformRoute(value, fullPath));
      router.put(formattedKey, transformRoute(value, fullPath));
      router.post(formattedKey, transformRoute(value, fullPath));
      router.delete(formattedKey, transformRoute(value, fullPath));
      continue;
    }

    if (value != null && typeof value === 'object') {
      router.use(formattedKey, createObjectRouter(value, transformRoute, options, fullPath));
    }
  }

  return router;
};

function noop(v) {
  return v;
}