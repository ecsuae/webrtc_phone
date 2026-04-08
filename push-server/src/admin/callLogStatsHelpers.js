'use strict';

const { canonicalType } = require('../services/callDiagnosis');

function isConcreteCount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function preflightOkFromCounts(ev) {
  if (typeof ev.relay === 'number') return ev.relay > 0;
  if (typeof ev.total === 'number') return ev.total > 0;
  return null;
}

function isPreflightFamily(ev) {
  const t = (ev.type || '');
  return t === 'outbound-preflight-start'
    || t === 'outbound-preflight-complete'
    || t === 'outbound-preflight-result'
    || t === 'preflight-complete'
    || t === 'preflight-ok'
    || t === 'preflight-fail';
}

function isSuspiciousStatsEvent(ev) {
  if (!ev || typeof ev !== 'object') return false;
  const inP = typeof ev.inboundAudioPacketsReceived === 'number' ? ev.inboundAudioPacketsReceived : null;
  const outP = typeof ev.outboundAudioPacketsSent === 'number' ? ev.outboundAudioPacketsSent : null;
  if (inP === null && outP === null) return false;
  if (inP === 0 && outP > 0) return true;
  if (outP === 0 && inP > 0) return true;
  return false;
}

function mergeIceErrorDetail(best, ev) {
  const out = { ...best };
  const msg = ev.msg || '';
  if (!out.msg && msg) out.msg = msg;
  if (out.msg && msg && msg.length > out.msg.length) out.msg = msg;

  // Try to preserve useful single-line details if present
  for (const k of ['code', 'url', 'transport', 'error', 'errorText']) {
    if (out[k] === undefined && ev[k] !== undefined) out[k] = ev[k];
  }

  return out;
}

function pickBetterCounts(best, ev) {
  const next = { ...best };
  for (const k of ['relay', 'host', 'srflx', 'total']) {
    const cur = next[k];
    const cand = ev[k];
    if (!isConcreteCount(cur) && isConcreteCount(cand)) next[k] = cand;
    if (isConcreteCount(cur) && isConcreteCount(cand) && cand > cur) next[k] = cand;
  }
  if (next.icePolicy === undefined && typeof ev.icePolicy === 'string') next.icePolicy = ev.icePolicy;
  if (next.timedOut === undefined && typeof ev.timedOut === 'boolean') next.timedOut = ev.timedOut;
  if (next.selectedPair === undefined && typeof ev.selectedPair === 'string') next.selectedPair = ev.selectedPair;
  if (next.candSummary === undefined && typeof ev.candSummary === 'string') next.candSummary = ev.candSummary;
  return next;
}

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
  isConcreteCount,
  preflightOkFromCounts,
  isPreflightFamily,
  isSuspiciousStatsEvent,
  mergeIceErrorDetail,
  pickBetterCounts,
  shouldShowCandSummary,
};
