'use strict';

const {
  inferCallClass,
  callClassAllowsMissingLeg,
} = require('../services/callClassification');

const { buildCallDiagnosis } = require('../services/callDiagnosis');

const { formatTs } = require('./timeFormat');
const { escHtml } = require('./callLogHtmlEscape');
const { buildLegSummary } = require('./callLogLegSummary');
const { deriveAsymmetricDirectionDiagnosis } = require('./callLogAsymmetricDirectionDiagnosis');

function renderLegSummaryBlock(events) {
  const callClass = inferCallClass(events).class;
  const caller = buildLegSummary(events, 'outbound');
  const callee = buildLegSummary(events, 'inbound');

  const boolCell = (v) => {
    if (v === true) return 'yes';
    if (v === false) return 'no';
    return 'unknown';
  };

  const shouldWarnMissingLeg = callClassAllowsMissingLeg(callClass);
  const warn = shouldWarnMissingLeg && (!caller.any || !callee.any)
    ? `<div class="legend" style="margin-top: 0; margin-bottom: 12px; border-color: rgba(224,90,90,.45);">
  <h3 style="color: var(--red);">WARNING: ${!caller.any ? 'caller leg logs missing' : ''}${(!caller.any && !callee.any) ? ' and ' : ''}${!callee.any ? 'callee leg logs missing' : ''}</h3>
  <div style="margin-top: 6px;">PROBLEM: incomplete observability for ${!caller.any ? 'caller' : 'callee'} leg</div>
</div>`
    : '';

  const asym = shouldWarnMissingLeg ? deriveAsymmetricDirectionDiagnosis(events) : null;
  const asymHtml = asym
    ? `<div class="legend" style="margin-top: 0; margin-bottom: 12px; border-color: rgba(224,90,90,.45);">
  <h3 style="color: var(--red);">${escHtml(asym.problem)}</h3>
  <pre style="white-space: pre-wrap; font-family: var(--mono); color: var(--dim); font-size: 12px; line-height: 1.4;">${escHtml(asym.lines.join('\n'))}</pre>
</div>`
    : '';

  const row = (title, s) => {
    return `<div class="legend" style="margin-top: 0; margin-bottom: 12px;">
  <h3>${escHtml(title)}</h3>
  <pre style="white-space: pre-wrap; font-family: var(--mono); color: var(--dim); font-size: 12px; line-height: 1.4;">${escHtml(
    `established: ${boolCell(s.established)}\n`
    + `remote track: ${boolCell(s.remoteTrack)}\n`
    + `remote audio play: ${s.remoteAudioPlayOk ? 'yes' : (s.remoteAudioPlayFail ? 'failed' : 'no/unknown')}\n`
    + `inbound RTP: ${boolCell(s.inboundRtp)}\n`
    + `outbound RTP: ${boolCell(s.outboundRtp)}\n`
    + `latest stats ts: ${s.latestStatsTs ? formatTs(s.latestStatsTs) : '—'}`
  )}</pre>
</div>`;
  };

  return `${asymHtml}${warn}${row(`Caller leg (outbound)${caller.username ? ` — ${caller.username}` : ''}`, caller)}${row(`Callee leg (inbound)${callee.username ? ` — ${callee.username}` : ''}`, callee)}`;
}

function renderMediaDiagnosisBlock(events) {
  const callClass = inferCallClass(events).class;
  const diag = buildCallDiagnosis(events, callClass);
  const setup = diag.hasEstablished ? 'OK' : 'UNKNOWN';
  const ice = diag.hasIceComplete ? 'OK' : 'UNKNOWN';
  const dtls = (diag.stats.outbound?.dtlsState || diag.stats.inbound?.dtlsState) ? 'OK' : 'UNKNOWN';

  const lines = [
    `setup: ${setup}`,
    `ICE: ${ice}`,
    `DTLS: ${dtls}`,
    `caller outbound RTP: ${typeof diag.stats.outbound?.outboundAudioPacketsSent === 'number' ? (diag.stats.outbound.outboundAudioPacketsSent > 0 ? 'yes' : 'no') : 'unknown'}`,
    `caller inbound RTP: ${typeof diag.stats.outbound?.inboundAudioPacketsReceived === 'number' ? (diag.stats.outbound.inboundAudioPacketsReceived > 0 ? 'yes' : 'no') : 'unknown'}`,
    `callee outbound RTP: ${typeof diag.stats.inbound?.outboundAudioPacketsSent === 'number' ? (diag.stats.inbound.outboundAudioPacketsSent > 0 ? 'yes' : 'no') : 'unknown'}`,
    `callee inbound RTP: ${typeof diag.stats.inbound?.inboundAudioPacketsReceived === 'number' ? (diag.stats.inbound.inboundAudioPacketsReceived > 0 ? 'yes' : 'no') : 'unknown'}`,
    `suspected issue: ${diag.oneWaySuspected ? 'one-way audio' : 'none detected'}`,
  ];

  const details = diag.oneWaySuspected ? `\n${escHtml(diag.suspectedMsg)}` : '';

  return `<div class="legend" style="margin-top: 0; margin-bottom: 16px;">
  <h3>Media diagnosis (derived)</h3>
  <pre style="white-space: pre-wrap; font-family: var(--mono); color: var(--dim); font-size: 12px; line-height: 1.4;">${escHtml(lines.join('\n'))}${details}</pre>
</div>`;
}

function buildTraceDiagHtml(events, { isTraceView }) {
  return isTraceView ? (renderLegSummaryBlock(events) + renderMediaDiagnosisBlock(events)) : '';
}

module.exports = {
  renderLegSummaryBlock,
  renderMediaDiagnosisBlock,
  buildTraceDiagHtml,
};
