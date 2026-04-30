'use strict';

const { inferCallClass, callClassAllowsMissingLeg } = require('../services/callClassification');
const { canonicalType, buildCallDiagnosis, computeMissingLeg, computeProbableLteReceiveFailure } = require('../services/callDiagnosis');
const { parseTsMs, corrKey } = require('./callLogCoreUtils');
const { SESSION_EVENT_TYPES, SUMMARY_MILESTONE_TYPES } = require('./callLogPresentationCatalogs');
const { preflightOkFromCounts, isPreflightFamily, mergeIceErrorDetail, pickBetterCounts, isSuspiciousStatsEvent } = require('./callLogStatsHelpers');
const { fmtPktBits, fmtRenderProofSummary } = require('./callLogRenderHelpers');

function precomputeSummaryArtifacts(events, { includeSession } = {}) {
  const input = Array.isArray(events) ? events : [];

  // Pre-compute call-level diagnosis for synthetic PROBLEM rows.
  const byCorr = new Map();
  for (const ev of input) {
    const k = corrKey(ev);
    if (!k) continue;
    if (!byCorr.has(k)) byCorr.set(k, []);
    byCorr.get(k).push(ev);
  }

  const callClassByKey = new Map();
  for (const [key, evs] of byCorr.entries()) {
    callClassByKey.set(key, inferCallClass(evs).class);
  }

  const callProblem = new Map();
  for (const [key, evs] of byCorr.entries()) {
    const callClass = callClassByKey.get(key) || 'pbx/unknown';
    const d = buildCallDiagnosis(evs, callClass);
    if (d.oneWaySuspected) callProblem.set(key, d);
  }

  const callMissingLeg = new Set();
  for (const [key, evs] of byCorr.entries()) {
    const callClass = callClassByKey.get(key) || 'pbx/unknown';
    if (computeMissingLeg(evs, callClass)) callMissingLeg.add(key);
  }

  // 0) Build one canonical preflight row per callId+dir
  const preflightByKey = new Map();
  for (const ev of input) {
    const key = corrKey(ev);
    if (!key) continue;
    if (!isPreflightFamily(ev)) continue;
    const dir = ev.dir || '';
    const k = `${key}|${dir}`;
    const prev = preflightByKey.get(k);
    const ts = ev.ts || ev._serverTs;

    const okFromCounts = preflightOkFromCounts(ev);
    const ok = (ev.type === 'preflight-ok')
      ? true
      : (ev.type === 'preflight-fail' ? false : okFromCounts);

    if (!prev) {
      preflightByKey.set(k, {
        base: ev,
        ts,
        ok,
        counts: pickBetterCounts({}, ev),
      });
      continue;
    }

    const mergedCounts = pickBetterCounts(prev.counts, ev);
    const mergedOk = (prev.ok === true || ok === true)
      ? true
      : ((prev.ok === false || ok === false) ? false : null);

    preflightByKey.set(k, {
      base: prev.base,
      ts: ts || prev.ts,
      ok: mergedOk,
      counts: mergedCounts,
    });
  }

  // 1) Aggregate repeated preflight icecandidateerror spam into buckets
  // Bucket window: 5s. Group by callId+dir+bucket.
  const bucketMs = 5000;
  const aggCounts = new Map();
  const aggSkipSeq = new Set();
  const aggBest = new Map();
  const aggRepSeq = new Map();

  for (const ev of input) {
    const t = canonicalType(ev);
    if (t !== 'preflight-icecandidateerror') continue;
    const key = corrKey(ev);
    if (!key) continue;
    const ts = ev.ts || ev._serverTs;
    const ms = parseTsMs(ts);
    if (ms === null) continue;
    const bucket = Math.floor(ms / bucketMs);
    const k = `${key}|${t}|${bucket}`;

    aggCounts.set(k, (aggCounts.get(k) || 0) + 1);
    const best = aggBest.get(k) || {};
    aggBest.set(k, mergeIceErrorDetail(best, ev));

    // Keep exactly one representative row per bucket; skip the rest.
    if (ev._seq !== undefined) {
      if (!aggRepSeq.has(k)) {
        aggRepSeq.set(k, ev._seq);
      } else if (aggRepSeq.get(k) !== ev._seq) {
        aggSkipSeq.add(ev._seq);
      }
    }
  }

  const out = [];

  // Group A: if inbound audio is clearly present but we never got an explicit
  // remote-audio-attached milestone (client timing/emit gaps), synthesize one
  // compact AUDIO row in summary for RCA. Summary-only; raw view unchanged.
  const inboundHasAttached = new Set();
  const inboundHasTrackOrPlay = new Map();
  const inboundHasStatsRtp = new Map();
  for (const ev of input) {
    const t = canonicalType(ev);
    const key = corrKey(ev);
    if (!key) continue;
    if (ev.dir !== 'inbound') continue;
    if (t === 'remote-audio-attached') {
      inboundHasAttached.add(key);
      continue;
    }
    if (t === 'remote-audio-track-added' || t === 'remote-audio-play-ok') {
      if (!inboundHasTrackOrPlay.has(key)) inboundHasTrackOrPlay.set(key, ev);
      continue;
    }
    if (t && t.startsWith('media-stats-')) {
      const recv = (typeof ev.inboundAudioPacketsReceived === 'number' && Number.isFinite(ev.inboundAudioPacketsReceived))
        ? ev.inboundAudioPacketsReceived
        : null;
      if (recv !== null && recv > 0) {
        if (!inboundHasStatsRtp.has(key)) inboundHasStatsRtp.set(key, ev);
      }
    }
  }
  const syntheticInboundAttachedEmitted = new Set();

  // Emit one synthetic PROBLEM row per callId (newest-first ordering).
  for (const [key, d] of callProblem.entries()) {
    const rep = (byCorr.get(key) || [])[0] || {};

    const rcaBits = [
      fmtPktBits(d && d.stats && d.stats.outbound, 'caller'),
      fmtPktBits(d && d.stats && d.stats.inbound, 'callee'),
    ].filter(Boolean);
    const rcaSuffix = rcaBits.length ? ` | ${rcaBits.join(' | ')}` : '';

    out.push({ _seq: rep._seq, ts: rep.ts, _serverTs: rep._serverTs, type: 'one-way-audio-suspected', callId: rep.callId, corrId: rep.corrId, dir: rep.dir, username: rep.username, domain: rep.domain, aor: rep.aor, peer: rep.peer, peerDomain: rep.peerDomain, peerAor: rep.peerAor, lteMode: rep.lteMode, mode: rep.mode, selectedProfile: rep.selectedProfile, icePolicy: rep.icePolicy, msg: (d.suspectedMsg || 'One-way audio suspected (derived from stats)') + rcaSuffix });

    const callClass = callClassByKey.get(key) || 'pbx/unknown';
    const shouldEmitProbableLte = computeProbableLteReceiveFailure({
      isMissingLeg: callMissingLeg.has(key),
      callClass,
      diagnosis: d,
    });

    if (shouldEmitProbableLte) out.push({ _seq: rep._seq, ts: rep.ts, _serverTs: rep._serverTs, type: 'probable-lte-receive-path-failure', callId: rep.callId, corrId: rep.corrId, dir: rep.dir, username: rep.username, domain: rep.domain, aor: rep.aor, peer: rep.peer, peerDomain: rep.peerDomain, peerAor: rep.peerAor, lteMode: rep.lteMode, mode: rep.mode, selectedProfile: rep.selectedProfile, icePolicy: rep.icePolicy, msg: 'PROBLEM: probable LTE receive-path failure (opposite leg logs missing)' + rcaSuffix });
  }

  // Emit incomplete-observability row for calls with only one leg present
  // (even when one-way audio is not yet diagnosed — the missing leg is itself a problem).
  for (const key of callMissingLeg) {
    if (callProblem.has(key)) continue; // already covered above
    const callClass = callClassByKey.get(key) || 'pbx/unknown';
    if (!callClassAllowsMissingLeg(callClass)) continue;
    const evs = byCorr.get(key) || [];
    const rep = evs[0] || {};
    const dirs = [...new Set(evs.map((e) => e.dir).filter(Boolean))];
    out.push({ _seq: rep._seq, ts: rep.ts, _serverTs: rep._serverTs, type: 'incomplete-observability', callId: rep.callId, corrId: rep.corrId, dir: rep.dir, username: rep.username, domain: rep.domain, aor: rep.aor, peer: rep.peer, peerDomain: rep.peerDomain, peerAor: rep.peerAor, lteMode: rep.lteMode, mode: rep.mode, selectedProfile: rep.selectedProfile, icePolicy: rep.icePolicy, msg: `PROBLEM: incomplete observability — only ${dirs[0] || 'one'} leg logs present for this call` });
  }

  return { input, includeSession: !!includeSession, byCorr, callProblem, preflightByKey, bucketMs, aggCounts, aggSkipSeq, aggBest, out, inboundHasAttached, inboundHasTrackOrPlay, inboundHasStatsRtp, syntheticInboundAttachedEmitted, SESSION_EVENT_TYPES, SUMMARY_MILESTONE_TYPES, isSuspiciousStatsEvent, canonicalType, fmtRenderProofSummary };
}

module.exports = {
  precomputeSummaryArtifacts,
};
