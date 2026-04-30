'use strict';

function safeStr(v) {
  if (v === undefined || v === null) return '';
  return String(v);
}

function localPartFromAorish(v) {
  const s = safeStr(v).trim();
  if (!s) return '';
  const raw = s
    .replace(/^<|>$/g, '')
    .replace(/^sips?:/i, '')
    .replace(/^tel:/i, '');
  const at = raw.indexOf('@');
  return (at >= 0 ? raw.slice(0, at) : raw).trim();
}

function extractPeerTargets(events) {
  const out = new Set();
  for (const ev of Array.isArray(events) ? events : []) {
    const p1 = localPartFromAorish(ev && ev.peer);
    const p2 = localPartFromAorish(ev && ev.peerAor);
    if (p1) out.add(p1);
    if (p2) out.add(p2);
  }
  return [...out];
}

function extractLocalUsernames(events) {
  const out = new Set();
  for (const ev of Array.isArray(events) ? events : []) {
    const u = localPartFromAorish(ev && (ev.username || ev.aor));
    if (u) out.add(u);
  }
  return [...out];
}

function inferCallClass(events) {
  const evs = Array.isArray(events) ? events : [];
  const dirs = new Set(evs.map((e) => e && e.dir).filter(Boolean));

  const peerTargets = extractPeerTargets(evs);
  const localUsers = extractLocalUsernames(evs);
  const hasFeatureCodeTarget = peerTargets.some((t) => /^\*\d{2,}$/.test(t));
  if (hasFeatureCodeTarget) {
    return {
      class: 'feature-code/service',
      reason: `peer target looks like feature code: ${peerTargets.find((t) => /^\*\d{2,}$/.test(t))}`,
    };
  }

  const hasShortServiceTarget = peerTargets.some((t) => /^\d{2,5}$/.test(t));
  const localLooksLikeExtension = localUsers.some((u) => /^\d{6,}$/.test(u));
  if (hasShortServiceTarget && (dirs.size <= 1 || localLooksLikeExtension)) {
    return {
      class: 'feature-code/service',
      reason: `short numeric peer target looks like service/IVR code: ${peerTargets.find((t) => /^\d{2,5}$/.test(t))}`,
    };
  }

  if (dirs.has('outbound') && dirs.has('inbound')) {
    return { class: 'peer', reason: 'both inbound+outbound browser legs present' };
  }

  return { class: 'pbx/unknown', reason: 'default fallback (no clear feature-code target; not two-leg peer trace)' };
}

function callClassSupportsPeerAudioAssumptions(callClass) {
  return callClass === 'peer';
}

function callClassAllowsMissingLeg(callClass) {
  return callClass === 'peer';
}

function callClassAllowsProbableLteReceiveFailure(callClass) {
  return callClass === 'peer';
}

module.exports = {
  inferCallClass,
  callClassSupportsPeerAudioAssumptions,
  callClassAllowsMissingLeg,
  callClassAllowsProbableLteReceiveFailure,
};
