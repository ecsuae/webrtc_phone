'use strict';

const { canonicalType } = require('../services/callDiagnosis');

function shouldShowCandSummary(ev, viewMode) {
  if (viewMode !== 'summary') return true;
  if ((ev.code || '').startsWith('MEDIA-E')) return false;
  const t = canonicalType(ev);
  return t === 'outbound-preflight-result'
    || t === 'ice-complete'
    || t === 'preflight-icecandidateerror'
    || t === 'outbound-selected-pair-details'
    || t.startsWith('media-stats-');
}

module.exports = {
  shouldShowCandSummary,
};
