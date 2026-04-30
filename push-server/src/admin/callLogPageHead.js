'use strict';

function buildCallLogPageHeadHtml({
  viewMode,
  escHtml,
  summaryHref,
  rawHref,
  isTraceView,
} = {}) {
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
  .export-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
  .export-right { display: flex; gap: 10px; flex-wrap: wrap; }
  .sel-cell { width: 32px; }
  .row-sel { transform: translateY(1px); }
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
  .stage-cell { font-size: 12px; font-weight: 600; white-space: nowrap; }
  .callid-cell { font-family: var(--mono); font-size: 11px; color: var(--dim); }
  .trace-link { color: var(--accent); text-decoration: none; margin-left: 8px; font-size: 11px; }
  .trace-link:hover { text-decoration: underline; }
  .msg-cell { color: var(--dim); max-width: 320px; word-break: break-word; }
  body.view-raw .msg-cell { max-width: none; word-break: normal; }
  body.view-raw .cand-cell { max-width: none; word-break: normal; }
  body.view-raw .peer-cell { max-width: none; word-break: normal; }
  .peer-cell { max-width: 220px; word-break: break-word; }
  .cand-cell { max-width: 260px; word-break: break-word; }
  .type-cell { font-family: var(--mono); font-size: 12px; white-space: nowrap; }
  .no-results { text-align: center; color: var(--dim); padding: 32px; }
  .problem-row td { background: rgba(224,90,90,.12); }
  .problem-row .stage-cell { color: var(--red) !important; font-weight: 700; }
  .warn-row td { background: rgba(224,168,74,.07); }
  .warn-row .stage-cell { color: var(--yellow) !important; font-weight: 700; }
  .rtp-problem { color: var(--red); font-weight: 700; }
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
<body class="view-${escHtml(viewMode)}">
<div class="nav-links">
  <a href="/dashboard">← Dashboard</a>
  <a href="/admin/calllogs">Call Logs</a>
  <a href="/admin/routing">Routing Config</a>
  <a href="/diagnostics/errors">Diagnostics</a>
</div>
<div class="nav-links">
  <span style="color: var(--dim); margin-right: 10px;">View:</span>
  <a href="${escHtml(summaryHref)}"${viewMode === 'summary' ? ' style="font-weight: 700;"' : ''}>Summary</a>
  <a href="${escHtml(rawHref)}"${viewMode === 'raw' ? ' style="font-weight: 700;"' : ''}>Raw</a>
  ${isTraceView ? '<span style="color: var(--dim); margin-left: 14px;">(per-call trace defaults to Raw)</span>' : ''}
</div>
<h1>Call Media Logs</h1>
<p class="subtitle">Real-time call/media diagnostic events from browser clients — in-memory, not persisted across restarts</p>
<p style="font-size: 11px; color: var(--dim); font-family: var(--mono); margin-bottom: 4px;">CALLLOGS_BUILD_MARKER: 2026-03-29-fix2</p>`;
}

module.exports = { buildCallLogPageHeadHtml };
