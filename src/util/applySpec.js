'use strict';

module.exports = applySpec;

function applySpec(obj) {
  const ret = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'function') {
      ret[key] = value.apply(this, Array.prototype.slice.call(arguments, 1));
    } else if (value != null && typeof value === 'object') {
      ret[key] = applySpec.apply(this, [obj[key]].concat(Array.prototype.slice.call(arguments, 1)));
    }
  }

  return ret;
}
