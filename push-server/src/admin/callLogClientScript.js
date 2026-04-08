'use strict';

function buildCallLogClientScriptHtml() {
  return `<script>
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
}

module.exports = {
  buildCallLogClientScriptHtml,
};
