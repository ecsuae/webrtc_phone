'use strict';

function isConcreteCount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

module.exports = {
  isConcreteCount,
};
