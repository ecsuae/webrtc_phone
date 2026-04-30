'use strict';

const { canonicalType } = require('../services/callDiagnosis');

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
    case 'preflight-icecandidateerror': return (ev._aggCount > 1)
      ? `Preflight ICE error x${ev._aggCount}`
      : 'Preflight ICE error';
    default: return 'Event';
  }
}

module.exports = {
  stageLabel,
};
