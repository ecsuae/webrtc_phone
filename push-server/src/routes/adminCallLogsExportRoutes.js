'use strict';

const { buildExportBundle, renderEventsCsv } = require('../services/callLogExport');

function readCallLogFilterFromReq(req) {
  return {
    view: req.query.view || undefined,
    includeSession: req.query.includeSession === '1' || undefined,
    username: req.query.username || undefined,
    domain: req.query.domain || undefined,
    aor: req.query.aor || undefined,
    caller: req.query.caller || undefined,
    receiver: req.query.receiver || undefined,
    dir: req.query.dir || undefined,
    mode: req.query.mode || undefined,
    profile: req.query.profile || req.query.mode || undefined,
    callId: req.query.callId || undefined,
    corrId: req.query.corrId || undefined,
    type: req.query.type || undefined,
    lteOnly: req.query.lteOnly === '1' || undefined,
    errorsOnly: req.query.errorsOnly === '1' || undefined,
    keys: req.query.keys || undefined,
    limit: Math.min(Number(req.query.limit) || 500, 1000),
  };
}

function parseKeysParam(keysRaw) {
  if (!keysRaw) return null;
  const parts = String(keysRaw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
  return parts.length ? new Set(parts) : null;
}

function attachAdminCallLogsExportRoutes(router, { queryEvents, requireWireGuardAccess }) {
  router.get('/calllogs/export.json', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const filter = readCallLogFilterFromReq(req);
    let events = queryEvents(filter);
    const keysSet = parseKeysParam(filter.keys);
    if (keysSet) {
      events = events.filter((ev) => {
        const k = ev.corrId || ev.callId || '';
        return k && keysSet.has(k);
      });
    }

    const bundle = buildExportBundle({
      events,
      filters: filter,
      viewMode: filter.view || 'raw',
    });

    const filename = `calllogs-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(JSON.stringify(bundle, null, 2));
  });

  router.get('/calllogs/export.csv', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const filter = readCallLogFilterFromReq(req);
    let events = queryEvents(filter);
    const keysSet = parseKeysParam(filter.keys);
    if (keysSet) {
      events = events.filter((ev) => {
        const k = ev.corrId || ev.callId || '';
        return k && keysSet.has(k);
      });
    }

    const csv = renderEventsCsv(events);
    const filename = `calllogs-export-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(csv);
  });

  router.get('/calllogs/trace/export.json', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const corrId = req.query.corrId ? String(req.query.corrId) : '';
    const callId = req.query.callId ? String(req.query.callId) : '';
    const key = corrId || callId;
    if (!key) return res.status(400).json({ ok: false, error: 'Missing corrId or callId' });

    const events = queryEvents({
      corrId: corrId || undefined,
      callId: (!corrId && callId) ? callId : undefined,
      limit: 1000,
    });
    const bundle = buildExportBundle({
      events,
      filters: {
        corrId: corrId || undefined,
        callId: (!corrId && callId) ? callId : undefined,
      },
      viewMode: 'raw',
    });

    const filename = `calltrace-${key}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(JSON.stringify(bundle, null, 2));
  });

  router.get('/calllogs/trace/export.csv', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const corrId = req.query.corrId ? String(req.query.corrId) : '';
    const callId = req.query.callId ? String(req.query.callId) : '';
    const key = corrId || callId;
    if (!key) return res.status(400).send('Missing corrId or callId');

    const events = queryEvents({
      corrId: corrId || undefined,
      callId: (!corrId && callId) ? callId : undefined,
      limit: 1000,
    });
    const csv = renderEventsCsv(events);
    const filename = `calltrace-${key}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(csv);
  });
}

module.exports = { attachAdminCallLogsExportRoutes };
