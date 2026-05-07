'use strict';

const { renderAdminLayout } = require('./adminLayout');

const {
  inferCallClass,
  callClassAllowsMissingLeg,
} = require('../services/callClassification');

const {
  canonicalType,
  buildCallDiagnosis,
  computeMissingLeg,
  computeProbableLteReceiveFailure,
} = require('../services/callDiagnosis');

const { formatTs, parseTsMs } = require('./timeFormat');
const {
  MEDIA_ERROR_DESCRIPTIONS,
  SESSION_EVENT_TYPES,
  SUMMARY_MILESTONE_TYPES,
  PROBLEM_ROW_TYPES,
  WARN_ROW_TYPES,
} = require('./callLogCatalogs');
const { escHtml } = require('./callLogHtmlEscape');
const { corrKey } = require('./callLogCorrelationKey');
const { modeLabel } = require('./callLogModeLabel');
const {
  buildQueryString,
  buildToggleQsBase,
  buildExportLinks,
} = require('./callLogQueryHelpers');
const { isConcreteCount } = require('./callLogConcreteCount');
const { preflightOkFromCounts } = require('./callLogPreflightOkFromCounts');
const { isPreflightFamily } = require('./callLogPreflightFamily');
const { isSuspiciousStatsEvent } = require('./callLogSuspiciousStatsEvent');
const { mergeIceErrorDetail } = require('./callLogMergeIceErrorDetail');
const { pickBetterCounts } = require('./callLogPickBetterCounts');
const { shouldShowCandSummary } = require('./callLogShouldShowCandSummary');
const { stageLabel } = require('./callLogStageLabel');
const { buildLegSummary } = require('./callLogLegSummary');
const { deriveAsymmetricDirectionDiagnosis } = require('./callLogAsymmetricDirectionDiagnosis');
const { buildTraceDiagHtml } = require('./callLogTraceDiagBlocks');
const { deriveViewMode } = require('./callLogViewMode');
const { applySummaryTransforms: applySummaryTransforms2 } = require('./callLogSummaryTransforms');
const { fmtRenderProofSummary } = require('./callLogRenderProofSummary');
const {
  fmtPktBits,
  renderRawPayloadDetails,
  renderStatsAnnotation,
} = require('./callLogDisplayHelpers');

/**
 * callLogPage.js
 *
 * WireGuard-only admin page for call/media diagnostic event filtering.
 * URL: /admin/calllogs
 *
 * Features:
 * - Filter by AOR (account@domain), call-id, event type, LTE mode, errors only
 * - Table shows all event fields relevant for LTE media diagnosis
 * - Refresh button reloads without clearing filters
 * - MEDIA error codes highlighted in red
 */

function applySummaryTransforms(events, { includeSession } = {}) {
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
  const seenMilestone = new Set();
  const emittedPreflight = new Set();

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

    out.push({
      _seq: rep._seq,
      ts: rep.ts,
      _serverTs: rep._serverTs,
      type: 'one-way-audio-suspected',
      callId: rep.callId,
      corrId: rep.corrId,
      dir: rep.dir,
      username: rep.username,
      domain: rep.domain,
      aor: rep.aor,
      peer: rep.peer,
      peerDomain: rep.peerDomain,
      peerAor: rep.peerAor,
      lteMode: rep.lteMode,
      mode: rep.mode,
      selectedProfile: rep.selectedProfile,
      icePolicy: rep.icePolicy,
      msg: (d.suspectedMsg || 'One-way audio suspected (derived from stats)') + rcaSuffix,
    });

    const callClass = callClassByKey.get(key) || 'pbx/unknown';
    const shouldEmitProbableLte = computeProbableLteReceiveFailure({
      isMissingLeg: callMissingLeg.has(key),
      callClass,
      diagnosis: d,
    });

    if (shouldEmitProbableLte) {
      out.push({
        _seq: rep._seq,
        ts: rep.ts,
        _serverTs: rep._serverTs,
        type: 'probable-lte-receive-path-failure',
        callId: rep.callId,
        corrId: rep.corrId,
        dir: rep.dir,
        username: rep.username,
        domain: rep.domain,
        aor: rep.aor,
        peer: rep.peer,
        peerDomain: rep.peerDomain,
        peerAor: rep.peerAor,
        lteMode: rep.lteMode,
        mode: rep.mode,
        selectedProfile: rep.selectedProfile,
        icePolicy: rep.icePolicy,
        msg: 'PROBLEM: probable LTE receive-path failure (opposite leg logs missing)' + rcaSuffix,
      });
    }
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
    out.push({
      _seq: rep._seq,
      ts: rep.ts,
      _serverTs: rep._serverTs,
      type: 'incomplete-observability',
      callId: rep.callId,
      corrId: rep.corrId,
      dir: rep.dir,
      username: rep.username,
      domain: rep.domain,
      aor: rep.aor,
      peer: rep.peer,
      peerDomain: rep.peerDomain,
      peerAor: rep.peerAor,
      lteMode: rep.lteMode,
      mode: rep.mode,
      selectedProfile: rep.selectedProfile,
      icePolicy: rep.icePolicy,
      msg: `PROBLEM: incomplete observability — only ${dirs[0] || 'one'} leg logs present for this call`,
    });
  }

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

function renderEventRow(ev, viewMode) {
  const isError = (ev.code || '').startsWith('MEDIA-E');
  const ct = canonicalType(ev);
  const isProblemRow = !isError && PROBLEM_ROW_TYPES.has(ct);
  const isWarnRow = !isError && !isProblemRow && WARN_ROW_TYPES.has(ct);
  const rowClass = isError
    ? ' class="error-row"'
    : (isProblemRow ? ' class="problem-row"' : (isWarnRow ? ' class="warn-row"' : ''));

  const codeOrType = isError ? ev.code : (ev.type || '');
  const stage = viewMode === 'summary' ? stageLabel(ev) : '';
  const eventLabel = (!isError && viewMode === 'summary' && ev._aggCount > 1)
    ? `${codeOrType} x${ev._aggCount}`
    : codeOrType;
  const eventCell = isError
    ? `<td class="code-error" title="${escHtml(MEDIA_ERROR_DESCRIPTIONS[ev.code] || ev.msg)}">${escHtml(eventLabel)}</td>`
    : `<td class="type-cell">${escHtml(eventLabel)}</td>`;

  const candSummary = (ev.relay !== undefined)
    ? `relay=${ev.relay} host=${ev.host ?? '?'} srflx=${ev.srflx ?? '?'} total=${ev.total ?? '?'}`
    : '';
  const selectedPairCell = escHtml(ev.selectedPair || '');

  const profile = modeLabel(ev);
  const modeCell = profile === 'lte'
    ? '<td class="badge-lte">LTE</td>'
    : (profile === 'wifi' ? '<td class="badge-wifi">Wi-Fi</td>' : '<td>—</td>');

  const username = ev.username || (ev.aor ? String(ev.aor).split('@')[0] : '') || '—';
  const domain = ev.domain || (ev.aor ? String(ev.aor).split('@')[1] : '') || '—';
  const aor = ev.aor || (username !== '—' && domain !== '—' ? `${username}@${domain}` : '—');

  const corrIdShort = ev.corrId
    ? (ev.corrId.slice(0, 18) + (ev.corrId.length > 18 ? '…' : ''))
    : '';
  const callIdShort = ev.callId
    ? (ev.callId.slice(0, 18) + (ev.callId.length > 18 ? '…' : ''))
    : '';
  const idCell = (() => {
    if (corrIdShort && callIdShort) return `${corrIdShort} | ${callIdShort}`;
    if (corrIdShort) return corrIdShort;
    if (callIdShort) return callIdShort;
    return '—';
  })();
  const traceLink = ev.corrId
    ? `<a class="trace-link" href="/admin/calllogs${buildQueryString({ corrId: ev.corrId, view: 'raw' })}">trace</a>`
    : (ev.callId
      ? `<a class="trace-link" href="/admin/calllogs${buildQueryString({ callId: ev.callId, view: 'raw' })}">trace</a>`
      : '');

  const peer = ev.peerAor || ev.peer || '—';
  const direction = ev.dir || '—';
  const rawTs = ev.ts || ev._serverTs;
  const ts = formatTs(rawTs);

  const candCell = shouldShowCandSummary(ev, viewMode)
    ? escHtml(ev.candSummary || candSummary || '—')
    : '—';

  const msgMain = isProblemRow
    ? `<span class="rtp-problem">${escHtml(ev.msg || '—')}</span>`
    : escHtml(ev.msg || '—');

  const statsAnnotation = renderStatsAnnotation(ev, { viewMode });

  const msgProof = (viewMode === 'raw')
    ? (() => {
      const parts = [];
      if (ev.sourceBuildId) parts.push(`sourceBuildId=${String(ev.sourceBuildId)}`);
      if (ev.postAttemptId) parts.push(`postAttemptId=${String(ev.postAttemptId)}`);
      if (ev.postStatus !== undefined) parts.push(`postStatus=${String(ev.postStatus)}`);
      if (ev.postError) parts.push(`postError=${String(ev.postError)}`);
      return parts.length ? escHtml(parts.join(' ')) : '';
    })()
    : '';

  const rawPayload = renderRawPayloadDetails(ev, { viewMode });

  const msgCellHtml = [
    msgMain,
    statsAnnotation,
    msgProof ? `<br><span style="color: var(--dim); font-family: var(--mono); font-size: 11px;">${msgProof}</span>` : '',
    rawPayload,
  ].join('');

  const rowKey = ev.corrId || ev.callId || '';
  const selectCell = viewMode === 'summary'
    ? `<td class="sel-cell"><input class="row-sel" type="checkbox" data-key="${escHtml(rowKey)}" ${rowKey ? '' : 'disabled'}></td>`
    : '';

  return `<tr${rowClass}>
    ${selectCell}
    <td class="ts-cell" title="UTC ${escHtml(rawTs || '')}">${escHtml(ts)}</td>
    ${viewMode === 'summary' ? `<td class="stage-cell">${escHtml(stage)}</td>` : ''}
    <td>${escHtml(username)}</td>
    ${viewMode === 'summary' ? '' : `<td>${escHtml(domain)}</td>`}
    <td>${escHtml(aor)}</td>
    <td>${escHtml(direction)}</td>
    <td class="peer-cell">${escHtml(peer)}</td>
    ${eventCell}
    ${modeCell}
    <td class="callid-cell" title="${escHtml(`corrId=${ev.corrId || ''} callId=${ev.callId || ''}`.trim())}">${escHtml(idCell)} ${traceLink}</td>
    <td class="cand-cell" title="${escHtml(selectedPairCell)}">${candCell}</td>
    <td class="msg-cell">${msgCellHtml}</td>
  </tr>`;
}

function renderCallLogPage(events, stats, filter) {
  const isTraceView = !!(filter && (filter.callId || filter.corrId));
  const viewMode = deriveViewMode(filter, { isTraceView });

  const includeSession = !!(filter && filter.includeSession);

  const traceDiagHtml = buildTraceDiagHtml(events, { isTraceView });

  const pageEvents = viewMode === 'summary'
    ? applySummaryTransforms2(events, { includeSession })
    : (Array.isArray(events) ? events : []);

  const emptyColspan = viewMode === 'summary' ? 12 : 11;
  const rows = pageEvents.length > 0
    ? pageEvents.map((ev) => renderEventRow(ev, viewMode)).join('\n')
    : `<tr><td colspan="${emptyColspan}" class="no-results">No events match the current filter.</td></tr>`;

  const toggleQsBase = buildToggleQsBase(filter, { includeSession });
  const summaryHref = `/admin/calllogs${buildQueryString({ ...toggleQsBase, view: 'summary' })}`;
  const rawHref = `/admin/calllogs${buildQueryString({ ...toggleQsBase, view: 'raw' })}`;

  const exportLinks = buildExportLinks(filter, { isTraceView });

  const exportBar = isTraceView
    ? `<div class="export-bar">
  <div class="export-left"><span style="color: var(--dim); font-family: var(--mono); font-size: 11px;">Export trace</span></div>
  <div class="export-right">
    <a class="btn btn-clear" href="${escHtml(exportLinks.traceJson)}">Export this trace (JSON)</a>
    <a class="btn btn-clear" href="${escHtml(exportLinks.traceCsv)}">Export this trace (CSV)</a>
  </div>
</div>`
    : `<div class="export-bar">
  <div class="export-left"><span style="color: var(--dim); font-family: var(--mono); font-size: 11px;">Export list</span></div>
  <div class="export-right">
    <a class="btn btn-clear" href="${escHtml(exportLinks.filteredJson)}">Export filtered (JSON)</a>
    <a class="btn btn-clear" href="${escHtml(exportLinks.filteredCsv)}">Export filtered (CSV)</a>
    <button type="button" class="btn btn-clear" id="exportSelectedJson">Export selected (JSON)</button>
    <button type="button" class="btn btn-clear" id="exportSelectedCsv">Export selected (CSV)</button>
  </div>
</div>`;

  const exportSection = isTraceView ? '' : (() => {
    const c = (filter && filter.exportCaller) ? String(filter.exportCaller) : '';
    const r = (filter && filter.exportReceiver) ? String(filter.exportReceiver) : '';

    const callerJson0 = exportLinks.latestCallerJson || '';
    const callerCsv0 = exportLinks.latestCallerCsv || '';
    const callerPdf0 = exportLinks.latestCallerPdf || '';
    const receiverJson0 = exportLinks.latestReceiverJson || '';
    const receiverCsv0 = exportLinks.latestReceiverCsv || '';
    const receiverPdf0 = exportLinks.latestReceiverPdf || '';
    const pairJson0 = exportLinks.latestPairJson || '';
    const pairCsv0 = exportLinks.latestPairCsv || '';
    const pairPdf0 = exportLinks.latestPairPdf || '';

    return `<div class="export-panel" style="background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
  <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
    <div>
      <div style="font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: .05em;">Export latest correlated call</div>
      <div style="font-size: 12px; color: var(--dim); margin-top: 4px;">Export-only lookup controls (do not filter the visible list)</div>
    </div>
  </div>

  <div class="export-form" style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; margin-top: 12px;">
    <div class="filter-group">
      <label>Caller (export)</label>
      <input type="text" id="exportCaller" value="${escHtml(c)}" placeholder="e.g. 900900">
    </div>
    <div class="filter-group">
      <label>Receiver (export)</label>
      <input type="text" id="exportReceiver" value="${escHtml(r)}" placeholder="e.g. 600600">
    </div>
    <button type="button" class="btn btn-clear" id="updateExportFields">Update export fields</button>
  </div>

  <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top: 12px;">
    <div id="exportScopeCaller" data-show="flex" style="display:flex; gap:8px; align-items:center; ${c ? '' : 'display:none;'}">
      <select id="exportFormatCaller" class="btn btn-clear" style="padding: 7px 10px;">
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
        <option value="pdf">PDF</option>
      </select>
      <button type="button" class="btn btn-clear" id="exportLatestCaller">Export latest for caller</button>
      <span style="display:none;" id="exportLatestCallerJson0">${escHtml(callerJson0)}</span>
      <span style="display:none;" id="exportLatestCallerCsv0">${escHtml(callerCsv0)}</span>
      <span style="display:none;" id="exportLatestCallerPdf0">${escHtml(callerPdf0)}</span>
    </div>

    <div id="exportScopeReceiver" data-show="flex" style="display:flex; gap:8px; align-items:center; ${r ? '' : 'display:none;'}">
      <select id="exportFormatReceiver" class="btn btn-clear" style="padding: 7px 10px;">
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
        <option value="pdf">PDF</option>
      </select>
      <button type="button" class="btn btn-clear" id="exportLatestReceiver">Export latest for receiver</button>
      <span style="display:none;" id="exportLatestReceiverJson0">${escHtml(receiverJson0)}</span>
      <span style="display:none;" id="exportLatestReceiverCsv0">${escHtml(receiverCsv0)}</span>
      <span style="display:none;" id="exportLatestReceiverPdf0">${escHtml(receiverPdf0)}</span>
    </div>

    <div id="exportScopePair" data-show="flex" style="display:flex; gap:8px; align-items:center; ${(c && r) ? '' : 'display:none;'}">
      <select id="exportFormatPair" class="btn btn-clear" style="padding: 7px 10px;">
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
        <option value="pdf">PDF</option>
      </select>
      <button type="button" class="btn btn-clear" id="exportLatestPair">Export latest for caller+receiver</button>
      <span style="display:none;" id="exportLatestPairJson0">${escHtml(pairJson0)}</span>
      <span style="display:none;" id="exportLatestPairCsv0">${escHtml(pairCsv0)}</span>
      <span style="display:none;" id="exportLatestPairPdf0">${escHtml(pairPdf0)}</span>
    </div>
  </div>
</div>`;
  })();

  const headExtra = `<style>
  .admin-shell .calllogs-page {
    --bg: #0f1117; --bg2: #1a1d27; --bg3: #22263a;
    --border: #2e3350; --text: #c8cde4; --dim: #6b7399;
    --accent: #4f8ef7; --red: #e05a5a; --green: #4caf80; --yellow: #e0a84a;
    --lte: #e06a20; --wifi: #4caf80;
    --font: 'Segoe UI', system-ui, sans-serif; --mono: 'Cascadia Code', 'Fira Mono', monospace;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    padding: 24px;
    border-radius: 14px;
    border: 1px solid var(--border);
  }
  .admin-shell .calllogs-page * { box-sizing: border-box; margin: 0; padding: 0; }
  .admin-shell .calllogs-page h1 { color: var(--accent); font-size: 20px; margin-bottom: 4px; }
  .admin-shell .calllogs-page .subtitle { color: var(--dim); font-size: 12px; margin-bottom: 20px; }
  .admin-shell .calllogs-page .stats-bar { display: flex; gap: 24px; margin-bottom: 20px; }
  .admin-shell .calllogs-page .stat { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 10px 18px; }
  .admin-shell .calllogs-page .stat-label { font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: .05em; }
  .admin-shell .calllogs-page .stat-val { font-size: 22px; font-weight: 600; color: var(--accent); }
  .admin-shell .calllogs-page .stat-val.red { color: var(--red); }
  .admin-shell .calllogs-page .filter-form { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
  .admin-shell .calllogs-page .filter-group { display: flex; flex-direction: column; gap: 4px; }
  .admin-shell .calllogs-page .filter-group label { font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: .05em; }
  .admin-shell .calllogs-page .filter-group input, .admin-shell .calllogs-page .filter-group select { background: var(--bg3); border: 1px solid var(--border); color: var(--text); border-radius: 4px; padding: 6px 10px; font-size: 13px; min-width: 160px; }
  .admin-shell .calllogs-page .filter-group input:focus, .admin-shell .calllogs-page .filter-group select:focus { outline: 2px solid var(--accent); }
  .admin-shell .calllogs-page .btn { background: var(--accent); color: #fff; border: none; border-radius: 4px; padding: 7px 18px; font-size: 13px; cursor: pointer; align-self: flex-end; }
  .admin-shell .calllogs-page .btn:hover { opacity: .85; }
  .admin-shell .calllogs-page .btn-clear { background: var(--bg3); color: var(--dim); border: 1px solid var(--border); }
  .admin-shell .calllogs-page .export-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
  .admin-shell .calllogs-page .export-right { display: flex; gap: 10px; flex-wrap: wrap; }
  .admin-shell .calllogs-page .sel-cell { width: 32px; }
  .admin-shell .calllogs-page .row-sel { transform: translateY(1px); }
  .admin-shell .calllogs-page .table-wrap { overflow-x: auto; }
  .admin-shell .calllogs-page table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .admin-shell .calllogs-page th { background: var(--bg3); color: var(--dim); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .admin-shell .calllogs-page td { padding: 7px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
  .admin-shell .calllogs-page tr:hover td { background: var(--bg2); }
  .admin-shell .calllogs-page .error-row td { background: rgba(224,90,90,.07); }
  .admin-shell .calllogs-page .code-error { color: var(--red); font-weight: 600; font-family: var(--mono); font-size: 12px; white-space: nowrap; cursor: help; }
  .admin-shell .calllogs-page .badge-lte { color: var(--lte); font-weight: 600; font-size: 12px; }
  .admin-shell .calllogs-page .badge-wifi { color: var(--wifi); font-size: 12px; }
  .admin-shell .calllogs-page .ts-cell { color: var(--dim); font-family: var(--mono); font-size: 12px; white-space: nowrap; }
  .admin-shell .calllogs-page .stage-cell { font-size: 12px; font-weight: 600; white-space: nowrap; }
  .admin-shell .calllogs-page .callid-cell { font-family: var(--mono); font-size: 11px; color: var(--dim); }
  .admin-shell .calllogs-page .trace-link { color: var(--accent); text-decoration: none; margin-left: 8px; font-size: 11px; }
  .admin-shell .calllogs-page .trace-link:hover { text-decoration: underline; }
  .admin-shell .calllogs-page .msg-cell { color: var(--dim); max-width: 320px; word-break: break-word; }
  .admin-shell .calllogs-page.view-raw .msg-cell { max-width: none; word-break: normal; }
  .admin-shell .calllogs-page.view-raw .cand-cell { max-width: none; word-break: normal; }
  .admin-shell .calllogs-page.view-raw .peer-cell { max-width: none; word-break: normal; }
  .admin-shell .calllogs-page .peer-cell { max-width: 220px; word-break: break-word; }
  .admin-shell .calllogs-page .cand-cell { max-width: 260px; word-break: break-word; }
  .admin-shell .calllogs-page .type-cell { font-family: var(--mono); font-size: 12px; white-space: nowrap; }
  .admin-shell .calllogs-page .no-results { text-align: center; color: var(--dim); padding: 32px; }
  .admin-shell .calllogs-page .problem-row td { background: rgba(224,90,90,.12); }
  .admin-shell .calllogs-page .problem-row .stage-cell { color: var(--red) !important; font-weight: 700; }
  .admin-shell .calllogs-page .warn-row td { background: rgba(224,168,74,.07); }
  .admin-shell .calllogs-page .warn-row .stage-cell { color: var(--yellow) !important; font-weight: 700; }
  .admin-shell .calllogs-page .rtp-problem { color: var(--red); font-weight: 700; }
  .admin-shell .calllogs-page .legend { margin-top: 20px; padding: 14px 18px; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; color: var(--dim); }
  .admin-shell .calllogs-page .legend h3 { color: var(--text); font-size: 13px; margin-bottom: 8px; }
  .admin-shell .calllogs-page .legend-item { display: flex; gap: 10px; margin-bottom: 4px; }
  .admin-shell .calllogs-page .legend-code { color: var(--red); font-family: var(--mono); font-weight: 600; min-width: 90px; }
  .admin-shell .calllogs-page .legend-ok { color: var(--green); font-family: var(--mono); font-weight: 600; min-width: 90px; }
  .admin-shell .calllogs-page .nav-links { margin-bottom: 16px; font-size: 12px; }
  .admin-shell .calllogs-page .nav-links a { color: var(--accent); text-decoration: none; margin-right: 16px; }
  .admin-shell .calllogs-page .nav-links a:hover { text-decoration: underline; }
  </style>`;

  const content = `<div class="calllogs-page view-${escHtml(viewMode)}">
<div class="nav-links">
  <span style="color: var(--dim); margin-right: 10px;">View:</span>
  <a href="${escHtml(summaryHref)}"${viewMode === 'summary' ? ' style="font-weight: 700;"' : ''}>Summary</a>
  <a href="${escHtml(rawHref)}"${viewMode === 'raw' ? ' style="font-weight: 700;"' : ''}>Raw</a>
  ${isTraceView ? '<span style="color: var(--dim); margin-left: 14px;">(per-call trace defaults to Raw)</span>' : ''}
</div>
<h1>Call Media Logs</h1>
<p class="subtitle">Real-time call/media diagnostic events from browser clients — in-memory, not persisted across restarts</p>
<p style="font-size: 11px; color: var(--dim); font-family: var(--mono); margin-bottom: 4px;">CALLLOGS_BUILD_MARKER: 2026-03-29-fix2</p>

${traceDiagHtml}

${exportSection}

${exportBar}

<div class="stats-bar">
  <div class="stat">
    <div class="stat-label">Total events</div>
    <div class="stat-val">${stats.total}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Media errors</div>
    <div class="stat-val red">${stats.errors}</div>
  </div>
  <div class="stat">
    <div class="stat-label">LTE events</div>
    <div class="stat-val">${stats.lte}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Buffer capacity</div>
    <div class="stat-val">${stats.total} / ${stats.capacity}</div>
  </div>
</div>

<form class="filter-form" method="get" action="/admin/calllogs">
  <input type="hidden" name="view" value="${escHtml(viewMode)}">
  <input type="hidden" name="exportCaller" value="${escHtml(filter.exportCaller || '')}">
  <input type="hidden" name="exportReceiver" value="${escHtml(filter.exportReceiver || '')}">
  <div class="filter-group">
    <label>Caller</label>
    <input type="text" name="caller" value="${escHtml(filter.caller || '')}" placeholder="e.g. 900900">
  </div>
  <div class="filter-group">
    <label>Receiver</label>
    <input type="text" name="receiver" value="${escHtml(filter.receiver || '')}" placeholder="e.g. 600600">
  </div>
  <div class="filter-group">
    <label>Username / Ext</label>
    <input type="text" name="username" value="${escHtml(filter.username || '')}" placeholder="e.g. 900900">
  </div>
  <div class="filter-group">
    <label>Domain</label>
    <input type="text" name="domain" value="${escHtml(filter.domain || '')}" placeholder="e.g. pbx.example.com">
  </div>
  <div class="filter-group">
    <label>AOR / Account</label>
    <input type="text" name="aor" value="${escHtml(filter.aor || '')}" placeholder="e.g. 900900@pbx.example.com">
  </div>
  <div class="filter-group">
    <label>Direction</label>
    <select name="dir">
      <option value="">All</option>
      <option value="inbound"${filter.dir === 'inbound' ? ' selected' : ''}>Inbound</option>
      <option value="outbound"${filter.dir === 'outbound' ? ' selected' : ''}>Outbound</option>
    </select>
  </div>
  <div class="filter-group">
    <label>Profile</label>
    <select name="profile">
      <option value="">All</option>
      <option value="wifi"${(filter.profile || filter.mode) === 'wifi' ? ' selected' : ''}>Wi-Fi</option>
      <option value="lte"${(filter.profile || filter.mode) === 'lte' ? ' selected' : ''}>LTE</option>
    </select>
  </div>
  <div class="filter-group">
    <label>Call-ID</label>
    <input type="text" name="callId" value="${escHtml(filter.callId || '')}" placeholder="SIP Call-ID substring">
  </div>
  <div class="filter-group">
    <label>Corr ID</label>
    <input type="text" name="corrId" value="${escHtml(filter.corrId || '')}" placeholder="X-WebRTC-CorrId">
  </div>
  <div class="filter-group">
    <label>Event type</label>
    <input type="text" name="type" value="${escHtml(filter.type || '')}" placeholder="e.g. MEDIA-E001">
  </div>
  <div class="filter-group">
    <label>Show</label>
    <select name="errorsOnly">
      <option value="">All events</option>
      <option value="1"${filter.errorsOnly ? ' selected' : ''}>Errors only (MEDIA-E*)</option>
    </select>
  </div>
  <div class="filter-group">
    <label>Session</label>
    <select name="includeSession">
      <option value=""${includeSession ? '' : ' selected'}>Hide session events</option>
      <option value="1"${includeSession ? ' selected' : ''}>Include session events</option>
    </select>
  </div>
  <button type="submit" class="btn">Filter</button>
  <a href="/admin/calllogs" class="btn btn-clear">Clear</a>
</form>

<div class="table-wrap">
<table>
  <thead>
    <tr>
      ${viewMode === 'summary' ? '<th></th>' : ''}
      <th>Timestamp</th>
      ${viewMode === 'summary' ? '<th>Stage</th>' : ''}
      <th>Username</th>
      ${viewMode === 'summary' ? '' : '<th>Domain</th>'}
      <th>AOR</th>
      <th>Direction</th>
      <th>Peer</th>
      <th>Event</th>
      <th>Profile</th>
      <th>Call-ID</th>
      <th>Candidate summary</th>
      <th>Message</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
</div>

<div class="legend">
  <h3>Event types reference</h3>
  <div class="legend-item"><span class="legend-code">MEDIA-E001</span><span>Relay not found — TURN unreachable in relay-only mode (zero relay candidates gathered)</span></div>
  <div class="legend-item"><span class="legend-code">MEDIA-E002</span><span>ICE timeout — gathering timed out, no candidates found in time</span></div>
  <div class="legend-item"><span class="legend-code">MEDIA-E003</span><span>Secure media failed — DTLS/SRTP did not complete (server-side only, not client-reported)</span></div>
  <div class="legend-item"><span class="legend-code">MEDIA-E004</span><span>No audio — call established but zero RTP packets on browser leg</span></div>
  <div class="legend-item"><span class="legend-ok">ice-relay-ok</span><span>LTE mode — relay candidates found, media path should be viable</span></div>
  <div class="legend-item"><span class="legend-ok">ua-ice-policy</span><span>UA built — ICE policy logged (relay = LTE mode active)</span></div>
  <div class="legend-item"><span class="legend-ok">ice-complete</span><span>ICE gathering completed — candidate summary</span></div>
</div>

</div>`;

  const scripts = `<script>
  // No auto-refresh. Manual reload only (prevents log jumping while reading).

  (function() {
    function buildQs(params) {
      const usp = new URLSearchParams();
      for (const k in params) {
        if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
        const v = params[k];
        if (v === undefined || v === null) continue;
        const s = String(v);
        if (!s) continue;
        usp.set(k, s);
      }
      const q = usp.toString();
      return q ? ('?' + q) : '';
    }

    function selectedKeys() {
      const nodes = document.querySelectorAll('input.row-sel:checked');
      const out = [];
      nodes.forEach((n) => {
        const k = n.getAttribute('data-key') || '';
        if (k) out.push(k);
      });
      return out;
    }

    function currentFilters() {
      const f = document.querySelector('form.filter-form');
      if (!f) return {};
      const fd = new FormData(f);
      const o = {};
      fd.forEach((v, k) => { o[k] = String(v); });
      return o;
    }

    function setDisplay(node, show) {
      if (!node) return;
      const d = node.getAttribute('data-show') || '';
      node.style.display = show ? d : 'none';
    }

    function updateLatestExportLinks() {
      const callerEl = document.getElementById('exportCaller');
      const receiverEl = document.getElementById('exportReceiver');
      const caller = callerEl ? String(callerEl.value || '').trim() : '';
      const receiver = receiverEl ? String(receiverEl.value || '').trim() : '';

      const filterForm = document.querySelector('form.filter-form');
      if (filterForm) {
        const hc = filterForm.querySelector('input[name="exportCaller"]');
        const hr = filterForm.querySelector('input[name="exportReceiver"]');
        if (hc) hc.value = caller;
        if (hr) hr.value = receiver;
      }

      const callerJson = caller ? ('/admin/calllogs/latest-caller/export.json?caller=' + encodeURIComponent(caller)) : '';
      const callerCsv = caller ? ('/admin/calllogs/latest-caller/export.csv?caller=' + encodeURIComponent(caller)) : '';
      const callerPdf = caller ? ('/admin/calllogs/latest-caller/export.pdf?caller=' + encodeURIComponent(caller)) : '';
      const receiverJson = receiver ? ('/admin/calllogs/latest-receiver/export.json?receiver=' + encodeURIComponent(receiver)) : '';
      const receiverCsv = receiver ? ('/admin/calllogs/latest-receiver/export.csv?receiver=' + encodeURIComponent(receiver)) : '';
      const receiverPdf = receiver ? ('/admin/calllogs/latest-receiver/export.pdf?receiver=' + encodeURIComponent(receiver)) : '';
      const pairJson = (caller && receiver)
        ? ('/admin/calllogs/latest-pair/export.json?caller=' + encodeURIComponent(caller) + '&receiver=' + encodeURIComponent(receiver))
        : '';
      const pairCsv = (caller && receiver)
        ? ('/admin/calllogs/latest-pair/export.csv?caller=' + encodeURIComponent(caller) + '&receiver=' + encodeURIComponent(receiver))
        : '';
      const pairPdf = (caller && receiver)
        ? ('/admin/calllogs/latest-pair/export.pdf?caller=' + encodeURIComponent(caller) + '&receiver=' + encodeURIComponent(receiver))
        : '';

      const scopeCaller = document.getElementById('exportScopeCaller');
      const scopeReceiver = document.getElementById('exportScopeReceiver');
      const scopePair = document.getElementById('exportScopePair');

      const cJson0 = document.getElementById('exportLatestCallerJson0');
      const cCsv0 = document.getElementById('exportLatestCallerCsv0');
      const cPdf0 = document.getElementById('exportLatestCallerPdf0');
      const rJson0 = document.getElementById('exportLatestReceiverJson0');
      const rCsv0 = document.getElementById('exportLatestReceiverCsv0');
      const rPdf0 = document.getElementById('exportLatestReceiverPdf0');
      const pJson0 = document.getElementById('exportLatestPairJson0');
      const pCsv0 = document.getElementById('exportLatestPairCsv0');
      const pPdf0 = document.getElementById('exportLatestPairPdf0');

      if (cJson0) cJson0.textContent = callerJson;
      if (cCsv0) cCsv0.textContent = callerCsv;
      if (cPdf0) cPdf0.textContent = callerPdf;
      if (rJson0) rJson0.textContent = receiverJson;
      if (rCsv0) rCsv0.textContent = receiverCsv;
      if (rPdf0) rPdf0.textContent = receiverPdf;
      if (pJson0) pJson0.textContent = pairJson;
      if (pCsv0) pCsv0.textContent = pairCsv;
      if (pPdf0) pPdf0.textContent = pairPdf;

      setDisplay(scopeCaller, !!caller);
      setDisplay(scopeReceiver, !!receiver);
      setDisplay(scopePair, !!(caller && receiver));
    }

    function readUrlFromSpan(id) {
      const el = document.getElementById(id);
      return el ? String(el.textContent || '').trim() : '';
    }

    function wireLatest(scopeBtnId, formatSelId, urls) {
      const btn = document.getElementById(scopeBtnId);
      const sel = document.getElementById(formatSelId);
      if (!btn || !sel) return;
      btn.addEventListener('click', () => {
        const fmt = String(sel.value || 'json');
        const url = (fmt === 'csv') ? readUrlFromSpan(urls.csv)
          : (fmt === 'pdf') ? readUrlFromSpan(urls.pdf)
            : readUrlFromSpan(urls.json);
        if (url) window.location.href = url;
      });
    }

    function wire(btnId, path) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const keys = selectedKeys();
        const filters = currentFilters();
        const url = path + buildQs({ ...filters, keys: keys.join(',') });
        window.location.href = url;
      });
    }

    const updateBtn = document.getElementById('updateExportFields');
    if (updateBtn) {
      updateBtn.addEventListener('click', (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        updateLatestExportLinks();
      });
    }

    updateLatestExportLinks();
    wireLatest('exportLatestCaller', 'exportFormatCaller', { json: 'exportLatestCallerJson0', csv: 'exportLatestCallerCsv0', pdf: 'exportLatestCallerPdf0' });
    wireLatest('exportLatestReceiver', 'exportFormatReceiver', { json: 'exportLatestReceiverJson0', csv: 'exportLatestReceiverCsv0', pdf: 'exportLatestReceiverPdf0' });
    wireLatest('exportLatestPair', 'exportFormatPair', { json: 'exportLatestPairJson0', csv: 'exportLatestPairCsv0', pdf: 'exportLatestPairPdf0' });
    wire('exportSelectedJson', '/admin/calllogs/export.json');
    wire('exportSelectedCsv', '/admin/calllogs/export.csv');
  })();
</script>`;

  return renderAdminLayout({
    active: 'calllogs',
    title: 'Call Logs',
    subtitle: 'Real-time call/media diagnostic events from browser clients — in-memory, not persisted across restarts',
    content,
    headExtra,
    scripts,
  });
}

module.exports = { renderCallLogPage };
