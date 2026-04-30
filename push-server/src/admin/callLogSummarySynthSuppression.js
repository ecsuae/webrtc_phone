'use strict';

function filterSynthesizedSummaryRows({ input, synthesized, canonicalType, corrKey } = {}) {
  const src = Array.isArray(input) ? input : [];
  const syn = Array.isArray(synthesized) ? synthesized : [];

  // Merged-parent precedence: pick a primary key per callId.
  // Prefer correlations that have a corrId (merged/parent) over callId-only keys.
  const primaryKeyByCallId = (() => {
    const best = new Map();
    const scoreFor = (rep) => (rep && rep.corrId ? 2 : (rep && rep.callId ? 1 : 0));
    for (const ev of src) {
      const callId = ev && ev.callId;
      if (!callId) continue;
      const k = corrKey(ev);
      if (!k) continue;
      const prev = best.get(callId);
      if (!prev || scoreFor(ev) > scoreFor(prev)) best.set(callId, ev);
    }
    const out = new Map();
    for (const [callId, rep] of best.entries()) out.set(callId, corrKey(rep));
    return out;
  })();

  const primaryKeyFor = (ev) => {
    const callId = ev && ev.callId;
    if (!callId) return '';
    return primaryKeyByCallId.get(callId) || '';
  };

  const CALL_LEVEL_SYNTH_TYPES = new Set([
    'call-media-verdict',
    'call-troubleshooting-conclusion',
    'inbound-playback-proof-missing',
    'one-way-audio-diagnosis',
    'media-proof-confidence',
    'network-path-interpretation',
    'android-playback-path-suspect',
    'audio-quality-anomaly',
    'reciprocal-proof-missing',
  ]);

  const PER_LEG_SYNTH_TYPES = new Set([
    'media-leg-verdict',
  ]);

  const out = [];
  for (const ev of syn) {
    const t = canonicalType(ev);
    if (CALL_LEVEL_SYNTH_TYPES.has(t)) {
      const pk = primaryKeyFor(ev);
      const k = corrKey(ev);
      if (pk && k && pk !== k) continue;
    }

    // Stronger suppression: after a primary merged-parent exists for a callId, suppress
    // non-primary per-leg synthesized rows when they are low-signal and mostly duplicate.
    // Raw/native rows are not touched.
    if (PER_LEG_SYNTH_TYPES.has(t)) {
      const pk = primaryKeyFor(ev);
      const k = corrKey(ev);
      if (pk && k && pk !== k) continue;
    }

    out.push(ev);
  }

  return out;
}

module.exports = { filterSynthesizedSummaryRows };
