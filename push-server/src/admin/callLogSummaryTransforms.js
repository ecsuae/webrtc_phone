'use strict';

const { corrKey, parseTsMs } = require('./callLogCoreUtils');

const {
  isPreflightFamily,
} = require('./callLogStatsHelpers');

const { precomputeSummaryArtifacts } = require('./callLogSummaryPrecompute');
const { buildMediaVerdictSummaryRows } = require('./callLogMediaVerdictSynthesis');
const { buildMediaAnomalySummaryRows } = require('./callLogMediaAnomalySynthesis');
const { filterSynthesizedSummaryRows } = require('./callLogSummarySynthSuppression');

function applySummaryTransforms(events, { includeSession } = {}) {
  const {
    input,
    preflightByKey,
    bucketMs,
    aggCounts,
    aggSkipSeq,
    aggBest,
    out,
    callProblem,
    inboundHasAttached,
    inboundHasTrackOrPlay,
    inboundHasStatsRtp,
    syntheticInboundAttachedEmitted,
    SESSION_EVENT_TYPES,
    SUMMARY_MILESTONE_TYPES,
    isSuspiciousStatsEvent,
    canonicalType,
    fmtRenderProofSummary,
  } = precomputeSummaryArtifacts(events, { includeSession });

  const seenMilestone = new Set();
  const emittedPreflight = new Set();

  // Group B: operator-facing synthesized media verdict rows (summary-only).
  // Emit them before the timeline loop.
  // Then apply merged-parent precedence suppression for call-level synthesized rows.
  out.push(...filterSynthesizedSummaryRows({ input, synthesized: [...buildMediaVerdictSummaryRows(input, { callProblem }), ...buildMediaAnomalySummaryRows(input)], canonicalType, corrKey }));

  for (const ev0 of input) {
    if (ev0._seq !== undefined && aggSkipSeq.has(ev0._seq)) continue;

    const ev = { ...ev0 };
    ev.type = canonicalType(ev);

    // Group A cleanup: normalize CLIENT milestones to a stable dir so summary dedupe
    // does not show duplicates across mixed client versions.
    if ((ev.type === 'profile-selected' || ev.type === 'ua-ice-policy') && !ev.dir) {
      ev.dir = 'session';
    }

    if (ev.type === 'outbound-selected-pair-details') {
      // Compact selected-pair visibility in summary without raw dumps.
      const lc = (typeof ev.localCandidateType === 'string' && ev.localCandidateType) ? ev.localCandidateType : '?';
      const rc = (typeof ev.remoteCandidateType === 'string' && ev.remoteCandidateType) ? ev.remoteCandidateType : '?';
      const rtt = (typeof ev.currentRoundTripTime === 'number' && Number.isFinite(ev.currentRoundTripTime))
        ? ` rtt=${String(ev.currentRoundTripTime).slice(0, 6)}`
        : '';
      const nom = (typeof ev.nominated === 'boolean') ? ` nominated=${String(ev.nominated)}` : '';
      const pair = (typeof ev.selectedPair === 'string' && ev.selectedPair.trim()) ? ev.selectedPair.trim() : '';
      ev.candSummary = `pair=${lc}->${rc}${rtt}${nom}${pair ? ` ${pair}` : ''}`;
    }

    if (ev.type === 'receive-render-proof' || ev0.type === 'outbound-receive-render-proof' || ev0.type === 'inbound-receive-render-proof') {
      const m = fmtRenderProofSummary(ev);
      if (m) ev.msg = m;
    }

    const key = corrKey(ev);

    // Group A: if inbound has track/play evidence but no attached milestone, emit
    // a single synthetic compact AUDIO row in the summary timeline.
    if (key && ev.dir === 'inbound' && !syntheticInboundAttachedEmitted.has(key)) {
      if (!inboundHasAttached.has(key) && (inboundHasTrackOrPlay.has(key) || inboundHasStatsRtp.has(key))) {
        const src = inboundHasTrackOrPlay.get(key) || inboundHasStatsRtp.get(key) || ev;
        syntheticInboundAttachedEmitted.add(key);
        out.push({
          _seq: src._seq,
          ts: src.ts,
          _serverTs: src._serverTs,
          type: 'remote-audio-attached',
          callId: src.callId,
          corrId: src.corrId,
          dir: 'inbound',
          username: src.username,
          domain: src.domain,
          aor: src.aor,
          peer: src.peer,
          peerDomain: src.peerDomain,
          peerAor: src.peerAor,
          lteMode: src.lteMode,
          mode: src.mode,
          selectedProfile: src.selectedProfile,
          icePolicy: src.icePolicy,
          msg: inboundHasTrackOrPlay.has(key)
            ? 'synthetic: inbound audio activity observed (track/play) but attached milestone missing'
            : 'synthetic: inbound RTP observed in media-stats but attached milestone missing',
        });
      }
    }

    const isSession = SESSION_EVENT_TYPES.has(ev.type);
    if (isSession && !includeSession) {
      // Restore: keep key client milestones in summary, but continue to hide
      // profile-badge-rendered unless includeSession is enabled.
      if (!(ev.type === 'profile-selected' || ev.type === 'ua-ice-policy')) {
        continue;
      }
    }

    const isMediaError = (ev.code || '').startsWith('MEDIA-E');
    if (!isMediaError) {
      const allowSession = includeSession && SESSION_EVENT_TYPES.has(ev.type);
      if (!allowSession) {
        if (ev.type.startsWith('media-stats-')) {
          if (!isSuspiciousStatsEvent(ev)) continue;
        } else if (!SUMMARY_MILESTONE_TYPES.has(ev.type)) {
          continue;
        }
      }
    }

    // Prefer call-linked events in main summary (unless session is explicitly included)
    // Regression fix: some milestone rows may legitimately lack corrId/callId; keep them.
    if (!key && !isMediaError) {
      const allowSession = includeSession && SESSION_EVENT_TYPES.has(ev.type);
      const allowMilestone = SUMMARY_MILESTONE_TYPES.has(ev.type) || ev.type.startsWith('media-stats-');
      if (!allowSession && !allowMilestone) continue;
    }

    // Replace any preflight-family row with the canonical preflight-result for this callId+dir (emitted once)
    if (key && (ev.type === 'outbound-preflight-result') && isPreflightFamily(ev0)) {
      const k = `${key}|${ev.dir || ''}`;
      if (emittedPreflight.has(k)) continue;

      const pf = preflightByKey.get(k);
      if (pf) {
        emittedPreflight.add(k);
        const ok = pf.ok;
        ev.type = 'outbound-preflight-result';
        ev.relay = pf.counts.relay;
        ev.host = pf.counts.host;
        ev.srflx = pf.counts.srflx;
        ev.total = pf.counts.total;
        ev.timedOut = pf.counts.timedOut;
        ev.icePolicy = pf.counts.icePolicy;
        ev.candSummary = pf.counts.candSummary;
        ev.selectedPair = pf.counts.selectedPair;
        ev.msg = ok === false ? 'LTE preflight FAIL' : 'LTE preflight OK';
      }
    }

    // Attach aggregated count to representative rows
    if (ev.type === 'preflight-icecandidateerror' && key) {
      const ts = ev.ts || ev._serverTs;
      const ms = parseTsMs(ts);
      if (ms !== null) {
        const bucket = Math.floor(ms / bucketMs);
        const k = `${key}|${ev.type}|${bucket}`;
        const n = aggCounts.get(k) || 1;
        if (n > 1) ev._aggCount = n;

        const best = aggBest.get(k);
        if (best && best.msg) ev.msg = best.msg;
      }
    }

    // 2) Collapse duplicates: only one canonical row per milestone per callId+dir
    const sessionClientDedupeKey = (!key && (ev.type === 'profile-selected' || ev.type === 'ua-ice-policy'))
      ? `session|${ev.aor || ev.username || ''}`
      : '';
    const dedupeKey = key || sessionClientDedupeKey;
    if (dedupeKey) {
      const dedupeStage = (ev.type === 'receive-render-proof')
        ? (() => {
          const m = typeof ev.msg === 'string' ? ev.msg : '';
          if (/\b10s\b/i.test(m)) return '10s';
          if (/\b5s\b/i.test(m)) return '5s';
          if (/\bearly\b/i.test(m)) return 'early';
          return '';
        })()
        : '';
      const k = `${dedupeKey}|${ev.dir || ''}|${isMediaError ? (ev.code || '') : ev.type}${dedupeStage ? `|${dedupeStage}` : ''}`;
      if (seenMilestone.has(k)) continue;
      seenMilestone.add(k);
    }

    out.push(ev);
  }

  return out;
}

module.exports = { applySummaryTransforms };
