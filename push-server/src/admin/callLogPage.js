'use strict';

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

const MEDIA_ERROR_DESCRIPTIONS = {
  'MEDIA-E001': 'Relay not found — TURN unreachable in relay-only mode',
  'MEDIA-E002': 'ICE timeout — gathering timed out before relay candidate found',
  'MEDIA-E003': 'Secure media failed — DTLS/SRTP negotiation did not complete',
  'MEDIA-E004': 'No audio received — zero RTP packets on browser leg',
};

function escHtml(v) {
  if (v === undefined || v === null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderEventRow(ev) {
  const isError = (ev.code || '').startsWith('MEDIA-E');
  const rowClass = isError ? ' class="error-row"' : '';
  const codeCell = isError
    ? `<td class="code-error" title="${escHtml(MEDIA_ERROR_DESCRIPTIONS[ev.code] || ev.msg)}">${escHtml(ev.code)}</td>`
    : `<td>${escHtml(ev.type)}</td>`;

  const candSummary = (ev.relay !== undefined)
    ? `relay=${ev.relay} host=${ev.host ?? '?'} srflx=${ev.srflx ?? '?'} total=${ev.total ?? '?'}`
    : '';

  const lteCell = ev.lteMode === true
    ? '<td class="badge-lte">LTE</td>'
    : (ev.lteMode === false ? '<td class="badge-wifi">Wi-Fi</td>' : '<td>—</td>');

  return `<tr${rowClass}>
    <td class="ts-cell">${escHtml((ev.ts || ev._serverTs || '').replace('T', ' ').slice(0, 19))}</td>
    ${codeCell}
    <td>${escHtml(ev.aor || '—')}</td>
    <td class="callid-cell" title="${escHtml(ev.callId || '')}">${escHtml(ev.callId ? ev.callId.slice(0, 28) + (ev.callId.length > 28 ? '…' : '') : '—')}</td>
    ${lteCell}
    <td>${escHtml(candSummary || '—')}</td>
    <td class="msg-cell">${escHtml(ev.msg || '—')}</td>
  </tr>`;
}

function renderCallLogPage(events, stats, filter) {
  const rows = events.length > 0
    ? events.map(renderEventRow).join('\n')
    : '<tr><td colspan="7" class="no-results">No events match the current filter.</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Call Media Logs — WebRTC SBC Admin</title>
<style>
  :root {
    --bg: #0f1117; --bg2: #1a1d27; --bg3: #22263a;
    --border: #2e3350; --text: #c8cde4; --dim: #6b7399;
    --accent: #4f8ef7; --red: #e05a5a; --green: #4caf80; --yellow: #e0a84a;
    --lte: #e06a20; --wifi: #4caf80;
    --font: 'Segoe UI', system-ui, sans-serif; --mono: 'Cascadia Code', 'Fira Mono', monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; padding: 24px; }
  h1 { color: var(--accent); font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: var(--dim); font-size: 12px; margin-bottom: 20px; }
  .stats-bar { display: flex; gap: 24px; margin-bottom: 20px; }
  .stat { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 10px 18px; }
  .stat-label { font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: .05em; }
  .stat-val { font-size: 22px; font-weight: 600; color: var(--accent); }
  .stat-val.red { color: var(--red); }
  .filter-form { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
  .filter-group { display: flex; flex-direction: column; gap: 4px; }
  .filter-group label { font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: .05em; }
  .filter-group input, .filter-group select { background: var(--bg3); border: 1px solid var(--border); color: var(--text); border-radius: 4px; padding: 6px 10px; font-size: 13px; min-width: 160px; }
  .filter-group input:focus, .filter-group select:focus { outline: 2px solid var(--accent); }
  .btn { background: var(--accent); color: #fff; border: none; border-radius: 4px; padding: 7px 18px; font-size: 13px; cursor: pointer; align-self: flex-end; }
  .btn:hover { opacity: .85; }
  .btn-clear { background: var(--bg3); color: var(--dim); border: 1px solid var(--border); }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: var(--bg3); color: var(--dim); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
  td { padding: 7px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:hover td { background: var(--bg2); }
  .error-row td { background: rgba(224,90,90,.07); }
  .code-error { color: var(--red); font-weight: 600; font-family: var(--mono); font-size: 12px; white-space: nowrap; cursor: help; }
  .badge-lte { color: var(--lte); font-weight: 600; font-size: 12px; }
  .badge-wifi { color: var(--wifi); font-size: 12px; }
  .ts-cell { color: var(--dim); font-family: var(--mono); font-size: 12px; white-space: nowrap; }
  .callid-cell { font-family: var(--mono); font-size: 11px; color: var(--dim); }
  .msg-cell { color: var(--dim); max-width: 320px; word-break: break-word; }
  .no-results { text-align: center; color: var(--dim); padding: 32px; }
  .legend { margin-top: 20px; padding: 14px 18px; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; color: var(--dim); }
  .legend h3 { color: var(--text); font-size: 13px; margin-bottom: 8px; }
  .legend-item { display: flex; gap: 10px; margin-bottom: 4px; }
  .legend-code { color: var(--red); font-family: var(--mono); font-weight: 600; min-width: 90px; }
  .legend-ok { color: var(--green); font-family: var(--mono); font-weight: 600; min-width: 90px; }
  .nav-links { margin-bottom: 16px; font-size: 12px; }
  .nav-links a { color: var(--accent); text-decoration: none; margin-right: 16px; }
  .nav-links a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="nav-links">
  <a href="/dashboard">← Dashboard</a>
  <a href="/admin/routing">Routing Config</a>
  <a href="/diagnostics/errors">Diagnostics</a>
</div>
<h1>Call Media Logs</h1>
<p class="subtitle">Real-time call/media diagnostic events from browser clients — in-memory, not persisted across restarts</p>

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
  <div class="filter-group">
    <label>AOR / Account</label>
    <input type="text" name="aor" value="${escHtml(filter.aor || '')}" placeholder="e.g. 900900@fusn01.srve.cc">
  </div>
  <div class="filter-group">
    <label>Call-ID</label>
    <input type="text" name="callId" value="${escHtml(filter.callId || '')}" placeholder="SIP Call-ID substring">
  </div>
  <div class="filter-group">
    <label>Event type</label>
    <input type="text" name="type" value="${escHtml(filter.type || '')}" placeholder="e.g. MEDIA-E001">
  </div>
  <div class="filter-group">
    <label>LTE mode</label>
    <select name="lteOnly">
      <option value="">All</option>
      <option value="1"${filter.lteOnly ? ' selected' : ''}>LTE only</option>
    </select>
  </div>
  <div class="filter-group">
    <label>Show</label>
    <select name="errorsOnly">
      <option value="">All events</option>
      <option value="1"${filter.errorsOnly ? ' selected' : ''}>Errors only (MEDIA-E*)</option>
    </select>
  </div>
  <button type="submit" class="btn">Filter</button>
  <a href="/admin/calllogs" class="btn btn-clear">Clear</a>
</form>

<div class="table-wrap">
<table>
  <thead>
    <tr>
      <th>Timestamp</th>
      <th>Event / Code</th>
      <th>AOR</th>
      <th>Call-ID</th>
      <th>Mode</th>
      <th>Candidates</th>
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

<script>
  // Auto-refresh every 15s if no filter is active (default view)
  const hasFilter = ${JSON.stringify(!!(filter.aor || filter.callId || filter.type || filter.lteOnly || filter.errorsOnly))};
  if (!hasFilter) {
    setTimeout(() => window.location.reload(), 15000);
  }
</script>
</body>
</html>`;
}

module.exports = { renderCallLogPage };
