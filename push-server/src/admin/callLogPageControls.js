'use strict';

function buildCallLogExportBarHtml({ isTraceView, escHtml, exportLinks } = {}) {
  return isTraceView
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
}

function buildCallLogExportPanelHtml({ isTraceView, escHtml, exportLinks, filter } = {}) {
  if (isTraceView) return '';

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
}

function buildCallLogStatsBarHtml({ stats } = {}) {
  return `<div class="stats-bar">
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
</div>`;
}

function buildCallLogFilterFormHtml({ viewMode, includeSession, escHtml, filter } = {}) {
  return `<form class="filter-form" method="get" action="/admin/calllogs">
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
    <input type="text" name="domain" value="${escHtml(filter.domain || '')}" placeholder="e.g. fusn01.srve.cc">
  </div>
  <div class="filter-group">
    <label>AOR / Account</label>
    <input type="text" name="aor" value="${escHtml(filter.aor || '')}" placeholder="e.g. 900900@fusn01.srve.cc">
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
</form>`;
}

module.exports = {
  buildCallLogExportBarHtml,
  buildCallLogExportPanelHtml,
  buildCallLogStatsBarHtml,
  buildCallLogFilterFormHtml,
};
