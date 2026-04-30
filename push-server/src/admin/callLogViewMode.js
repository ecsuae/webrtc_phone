'use strict';

function deriveViewMode(filter, { isTraceView } = {}) {
  if (isTraceView) return 'raw';
  return ((filter && String(filter.view).toLowerCase() === 'raw') ? 'raw' : 'summary');
}

module.exports = {
  deriveViewMode,
};
