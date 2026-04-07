'use strict';

function buildQueryString(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    const s = String(v);
    if (!s) continue;
    usp.set(k, s);
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

function buildToggleQsBase(filter, { includeSession }) {
  return {
    ...filter,
    view: undefined,
    includeSession: includeSession ? '1' : undefined,
  };
}

function buildExportLinks(filter, { isTraceView } = {}) {
  const base = { ...(filter || {}) };
  const viewMode = String(base.view || 'raw');

  const qsFiltered = buildQueryString({
    ...base,
    limit: 1000,
  });

  const filteredJson = `/admin/calllogs/export.json${qsFiltered}`;
  const filteredCsv = `/admin/calllogs/export.csv${qsFiltered}`;

  const traceKeyQs = (() => {
    if (!isTraceView) return '';
    const corrId = base.corrId || '';
    const callId = base.callId || '';
    return buildQueryString({ corrId: corrId || undefined, callId: (!corrId && callId) ? callId : undefined });
  })();

  const traceJson = isTraceView ? `/admin/calllogs/trace/export.json${traceKeyQs}` : '';
  const traceCsv = isTraceView ? `/admin/calllogs/trace/export.csv${traceKeyQs}` : '';

  const latestByCallerQs = (() => {
    const username = base.username || '';
    if (!username) return '';
    return buildQueryString({ username });
  })();
  const latestByCallerJson = latestByCallerQs ? `/admin/calllogs/latest/export.json${latestByCallerQs}` : '';
  const latestByCallerCsv = latestByCallerQs ? `/admin/calllogs/latest/export.csv${latestByCallerQs}` : '';

  const exportCaller = base.exportCaller || '';
  const exportReceiver = base.exportReceiver || '';

  const latestCallerQs = exportCaller ? buildQueryString({ caller: exportCaller }) : '';
  const latestCallerJson = latestCallerQs ? `/admin/calllogs/latest-caller/export.json${latestCallerQs}` : '';
  const latestCallerCsv = latestCallerQs ? `/admin/calllogs/latest-caller/export.csv${latestCallerQs}` : '';
  const latestCallerPdf = latestCallerQs ? `/admin/calllogs/latest-caller/export.pdf${latestCallerQs}` : '';

  const latestReceiverQs = exportReceiver ? buildQueryString({ receiver: exportReceiver }) : '';
  const latestReceiverJson = latestReceiverQs ? `/admin/calllogs/latest-receiver/export.json${latestReceiverQs}` : '';
  const latestReceiverCsv = latestReceiverQs ? `/admin/calllogs/latest-receiver/export.csv${latestReceiverQs}` : '';
  const latestReceiverPdf = latestReceiverQs ? `/admin/calllogs/latest-receiver/export.pdf${latestReceiverQs}` : '';

  const latestPairQs = (exportCaller && exportReceiver) ? buildQueryString({ caller: exportCaller, receiver: exportReceiver }) : '';
  const latestPairJson = latestPairQs ? `/admin/calllogs/latest-pair/export.json${latestPairQs}` : '';
  const latestPairCsv = latestPairQs ? `/admin/calllogs/latest-pair/export.csv${latestPairQs}` : '';
  const latestPairPdf = latestPairQs ? `/admin/calllogs/latest-pair/export.pdf${latestPairQs}` : '';

  return {
    viewMode,
    filteredJson,
    filteredCsv,
    traceJson,
    traceCsv,
    latestByCallerJson,
    latestByCallerCsv,
    latestCallerJson,
    latestCallerCsv,
    latestCallerPdf,
    latestReceiverJson,
    latestReceiverCsv,
    latestReceiverPdf,
    latestPairJson,
    latestPairCsv,
    latestPairPdf,
  };
}

module.exports = {
  buildQueryString,
  buildToggleQsBase,
  buildExportLinks,
};
