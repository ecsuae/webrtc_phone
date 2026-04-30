'use strict';

const { canonicalType } = require('../services/callDiagnosis');

const MEDIA_ERROR_DESCRIPTIONS = {
  'MEDIA-E001': 'Relay not found — TURN unreachable in relay-only mode',
  'MEDIA-E002': 'ICE timeout — gathering timed out before relay candidate found',
  'MEDIA-E003': 'Secure media failed — DTLS/SRTP negotiation did not complete',
  'MEDIA-E004': 'No audio received — zero RTP packets on browser leg',
};

const SESSION_EVENT_TYPES = new Set([
  'profile-selected',
  'ua-ice-policy',
  'profile-badge-rendered',
  'profile-toggle-changed',
]);

const SUMMARY_MILESTONE_TYPES = new Set([
  'profile-selected',
  'ua-ice-policy',
  'outbound-preflight-result',
  'invite-sent',
  'ice-complete',
  'remote-audio-attached',
  'remote-audio-play-ok',
  'remote-audio-play-failed',
  'no-remote-audio-play',
  'receive-render-proof',
  'call-established',
  'call-ended',
  'call-log-post-failed',
  'preflight-icecandidateerror',
  'no-inbound-rtp',
  'no-outbound-rtp',
  'dtls-connected-but-no-rtp',
  'selected-pair-relay-mismatch',
  'one-way-audio-suspected',
  'incomplete-observability',
  'outbound-post-establish-probe',
  'outbound-receive-health-2s',
  'outbound-receive-health-5s',
  'outbound-receive-health-10s',
  'outbound-inbound-rtp-zero',
  'outbound-inbound-rtp-present',
  'outbound-selected-pair-details',
  'outbound-dtls-state',
  'outbound-connection-state',
  'outbound-ice-connection-state',
  'probable-lte-receive-path-failure',
  'call-media-verdict',
  'call-troubleshooting-conclusion',
  'inbound-playback-proof-missing',
  'media-leg-verdict',
  'one-way-audio-diagnosis',
  'android-playback-path-suspect',
  'media-proof-confidence',
  'network-path-interpretation',
  'audio-quality-anomaly',
  'reciprocal-proof-missing',
]);

const PROBLEM_ROW_TYPES = new Set([
  'one-way-audio-suspected',
  'probable-lte-receive-path-failure',
  'incomplete-observability',
  'one-way-audio-diagnosis',
  'android-playback-path-suspect',
  'reciprocal-proof-missing',
  'call-troubleshooting-conclusion',
]);

const WARN_ROW_TYPES = new Set([
  'no-inbound-rtp',
  'no-outbound-rtp',
  'dtls-connected-but-no-rtp',
  'remote-audio-play-failed',
  'no-remote-audio-play',
  'selected-pair-relay-mismatch',
  'call-media-verdict',
  'inbound-playback-proof-missing',
  'audio-quality-anomaly',
]);

function modeLabel(ev) {
  if (ev.selectedProfile) return String(ev.selectedProfile);
  if (ev.mode) return String(ev.mode);
  if (ev.lteMode === true) return 'lte';
  if (ev.lteMode === false) return 'wifi';
  return '';
}

function stageLabel(ev) {
  if ((ev.code || '').startsWith('MEDIA-E')) return 'Error';

  const t = canonicalType(ev);
  switch (t) {
    case 'profile-selected': return 'CLIENT';
    case 'ua-ice-policy': return 'CLIENT';
    case 'outbound-preflight-start': return 'Preflight';
    case 'outbound-preflight-result': {
      if (typeof ev.relay === 'number') return ev.relay > 0 ? 'Preflight OK' : 'Preflight FAIL';
      return 'Preflight result';
    }
    case 'invite-sent': return 'CALL';
    case 'ice-complete': return 'ICE';
    case 'preflight-icecandidateerror': return 'ICE';
    case 'selected-pair-relay-mismatch': return 'ICE';
    case 'outbound-selected-pair-details': return 'ICE';
    case 'outbound-dtls-state': return 'ICE';
    case 'outbound-connection-state': return 'ICE';
    case 'outbound-ice-connection-state': return 'ICE';
    case 'remote-audio-attached': return 'AUDIO';
    case 'remote-audio-play-ok': return 'AUDIO';
    case 'remote-audio-play-failed': return 'AUDIO';
    case 'no-remote-audio-play': return 'AUDIO';
    case 'receive-render-proof': return 'AUDIO';
    case 'call-established': return 'CALL';
    case 'call-ended': return 'CALL';
    case 'call-log-post-failed': return 'POST';
    case 'no-inbound-rtp': return 'AUDIO';
    case 'no-outbound-rtp': return 'AUDIO';
    case 'dtls-connected-but-no-rtp': return 'ICE';
    case 'one-way-audio-suspected': return 'AUDIO';
    case 'incomplete-observability': return 'AUDIO';
    case 'probable-lte-receive-path-failure': return 'AUDIO';
    case 'call-media-verdict': return 'AUDIO';
    case 'call-troubleshooting-conclusion': return 'AUDIO';
    case 'inbound-playback-proof-missing': return 'AUDIO';
    case 'media-leg-verdict': return 'AUDIO';
    case 'one-way-audio-diagnosis': return 'AUDIO';
    case 'android-playback-path-suspect': return 'AUDIO';
    case 'media-proof-confidence': return 'AUDIO';
    case 'network-path-interpretation': return 'ICE';
    case 'audio-quality-anomaly': return 'AUDIO';
    case 'reciprocal-proof-missing': return 'AUDIO';
    case 'preflight-icecandidateerror': return (ev._aggCount > 1)
      ? `Preflight ICE error x${ev._aggCount}`
      : 'Preflight ICE error';
    default: return 'Event';
  }
}

function deriveViewMode(filter, { isTraceView } = {}) {
  if (isTraceView) return 'raw';
  return ((filter && String(filter.view).toLowerCase() === 'raw') ? 'raw' : 'summary');
}

module.exports = {
  MEDIA_ERROR_DESCRIPTIONS,
  SESSION_EVENT_TYPES,
  SUMMARY_MILESTONE_TYPES,
  PROBLEM_ROW_TYPES,
  WARN_ROW_TYPES,
  modeLabel,
  stageLabel,
  deriveViewMode,
};
