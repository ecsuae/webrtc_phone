'use strict';

function renderEventRow(ev, {
  viewMode,
  canonicalType,
  PROBLEM_ROW_TYPES,
  WARN_ROW_TYPES,
  MEDIA_ERROR_DESCRIPTIONS,
  stageLabel,
  modeLabel,
  shouldShowCandSummary,
  buildQueryString,
  formatTs,
  escHtml,
  renderStatsAnnotation,
  renderRawPayloadDetails,
} = {}) {
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

function renderEventTableHtml({ viewMode, rowsHtml } = {}) {
  return `<div class="table-wrap">
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
    ${rowsHtml}
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
</div>`;
}

module.exports = {
  renderEventRow,
  renderEventTableHtml,
};
