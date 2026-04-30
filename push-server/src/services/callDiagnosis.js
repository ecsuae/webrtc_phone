'use strict';

const {
  callClassSupportsPeerAudioAssumptions,
  callClassAllowsMissingLeg,
  callClassAllowsProbableLteReceiveFailure,
} = require('./callClassification');

function canonicalType(ev) {
  const t = (ev && ev.type) || '';
  if (!t) return '';

  if (t === 'outbound-invite-sent') return 'invite-sent';
  if (t === 'outbound-remote-audio-attached') return 'remote-audio-attached';
  if (t === 'outbound-call-established') return 'call-established';
  if (t === 'call-established') return 'call-established';
  if (t === 'media-answer-outgoing') return 'call-established';
  if (t === 'outbound-preflight-complete') return 'outbound-preflight-result';
  if (t === 'outbound-preflight-result') return 'outbound-preflight-result';
  if (t === 'preflight-complete') return 'outbound-preflight-result';
  if (t === 'outbound-preflight-start') return 'outbound-preflight-result';
  if (t === 'preflight-ok') return 'outbound-preflight-result';
  if (t === 'preflight-fail') return 'outbound-preflight-result';

  if (t === 'outbound-preflight-icecandidateerror') return 'preflight-icecandidateerror';

  if (t === 'outbound-remote-audio-play-ok') return 'remote-audio-play-ok';
  if (t === 'outbound-remote-audio-play-failed') return 'remote-audio-play-failed';

  if (t === 'outbound-remote-track-added') return 'remote-audio-track-added';

  return t;
}

function getLatestMediaStatsByDir(events) {
  const byDir = { inbound: null, outbound: null };
  const rank = (t) => {
    if (t === 'media-stats-10s') return 3;
    if (t === 'media-stats-5s') return 2;
    if (t === 'media-stats-2s') return 1;
    return 0;
  };
  for (const ev of events || []) {
    const t = (ev && ev.type) || '';
    if (!t.startsWith('media-stats-')) continue;
    const dir = ev.dir === 'inbound' ? 'inbound' : (ev.dir === 'outbound' ? 'outbound' : null);
    if (!dir) continue;
    const prev = byDir[dir];
    if (!prev || rank(t) > rank((prev && prev.type) || '')) byDir[dir] = ev;
  }
  return byDir;
}

function buildCallDiagnosis(events, callClass) {
  const evs = Array.isArray(events) ? events : [];
  const hasEstablished = evs.some((e) => canonicalType(e) === 'call-established');
  const hasIceComplete = evs.some((e) => canonicalType(e) === 'ice-complete');
  const hasMediaError = evs.some((e) => (e && (e.code || '')).startsWith('MEDIA-E'));

  const hasPlayOk = evs.some((e) => canonicalType(e) === 'remote-audio-play-ok');
  const hasPlayFail = evs.some((e) => canonicalType(e) === 'remote-audio-play-failed');
  const hasNoPlay = evs.some((e) => canonicalType(e) === 'no-remote-audio-play');
  const hasRelayMismatch = evs.some((e) => canonicalType(e) === 'selected-pair-relay-mismatch');

  const stats = getLatestMediaStatsByDir(evs);
  const o = stats.outbound;
  const i = stats.inbound;

  const outboundOut = o && o.outboundAudioPacketsSent;
  const outboundIn = o && o.inboundAudioPacketsReceived;
  const inboundOut = i && i.outboundAudioPacketsSent;
  const inboundIn = i && i.inboundAudioPacketsReceived;

  const supportsPeerAssumptions = callClassSupportsPeerAudioAssumptions(callClass);

  const oneWaySuspected = Boolean(
    supportsPeerAssumptions
    && hasEstablished
    && (
      (typeof outboundOut === 'number' && outboundOut > 0 && typeof outboundIn === 'number' && outboundIn === 0)
      || (typeof inboundOut === 'number' && inboundOut > 0 && typeof inboundIn === 'number' && inboundIn === 0)
      || (hasEstablished && !hasPlayOk)
      || hasPlayFail
      || hasNoPlay
      || hasRelayMismatch
    )
  );

  const suspectedMsg = (() => {
    const parts = [];
    if (typeof outboundOut === 'number' || typeof outboundIn === 'number') {
      parts.push(`caller(outbound) sent=${outboundOut ?? '?'} recv=${outboundIn ?? '?'}`);
    }
    if (typeof inboundOut === 'number' || typeof inboundIn === 'number') {
      parts.push(`callee(inbound) sent=${inboundOut ?? '?'} recv=${inboundIn ?? '?'}`);
    }

    if (supportsPeerAssumptions) {
      if (!hasPlayOk) parts.push('missing remote-audio-play-ok');
      if (hasPlayFail) parts.push('remote-audio-play-failed');
      if (hasNoPlay) parts.push('no-remote-audio-play');
    }

    if (hasRelayMismatch) parts.push('selected-pair-relay-mismatch');
    if (!supportsPeerAssumptions) parts.push(`callClass=${callClass} (peer-only rules suppressed)`);

    return parts.join(' | ');
  })();

  return {
    callClass,
    supportsPeerAssumptions,
    hasEstablished,
    hasIceComplete,
    hasMediaError,
    hasPlayOk,
    oneWaySuspected,
    suspectedMsg,
    stats,
  };
}

function computeMissingLeg(events, callClass) {
  if (!callClassAllowsMissingLeg(callClass)) return false;
  const evs = Array.isArray(events) ? events : [];
  const dirs = new Set(evs.map((e) => e && e.dir).filter(Boolean));
  return dirs.size === 1;
}

function computeProbableLteReceiveFailure({ isMissingLeg, callClass, diagnosis }) {
  if (!callClassAllowsProbableLteReceiveFailure(callClass)) return false;
  if (!isMissingLeg) return false;

  const o = diagnosis && diagnosis.stats && diagnosis.stats.outbound;
  const inboundRtp = typeof (o && o.inboundAudioPacketsReceived) === 'number' ? o.inboundAudioPacketsReceived : null;
  if (typeof inboundRtp === 'number' && inboundRtp > 0) {
    return false;
  }

  return true;
}

module.exports = {
  canonicalType,
  getLatestMediaStatsByDir,
  buildCallDiagnosis,
  computeMissingLeg,
  computeProbableLteReceiveFailure,
};
