'use strict';
const express = require('express');
const {
  readRoutingConfig,
  writeRoutingConfig,
  readCurrentEnvConfig,
  validateRoutingConfig,
} = require('../services/routingConfig');
const { renderRoutingPage } = require('../admin/routingPage');
const { queryEvents, getStats } = require('../services/callLogStore');
const { renderCallLogPage } = require('../admin/callLogPage');
const { buildExportBundle, renderEventsCsv } = require('../services/callLogExport');
const { attachLatestCallerExportRoutes, attachLatestCallerReceiverExportRoutes } = require('./adminCallLogExportRoutes');

function createAdminRoutes({ requireWireGuardAccess }) {
  const router = express.Router();

  // Admin routing config UI page
  router.get('/routing', requireWireGuardAccess, (req, res) => {
    const currentEnv = readCurrentEnvConfig();
    const savedConfig = readRoutingConfig();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderRoutingPage(currentEnv, savedConfig));
  });

  // JSON API: get current env + saved config
  router.get('/routing/config', requireWireGuardAccess, (req, res) => {
    res.json({
      current: readCurrentEnvConfig(),
      saved: readRoutingConfig(),
    });
  });

  // JSON API: save new routing config to routing-config.json
  // Does NOT auto-apply — requires `make routing-apply` + kamailio restart on host.
  router.post('/routing/config', requireWireGuardAccess, (req, res) => {
    const { pbxMappings, trustedIps, trustedDomains } = req.body || {};
    const errors = validateRoutingConfig({
      pbxMappings: pbxMappings || [],
      trustedIps: trustedIps || [],
      trustedDomains: trustedDomains || [],
    });
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }
    const savedAt = writeRoutingConfig({ pbxMappings, trustedIps, trustedDomains });
    console.log(`[admin/routing] Config saved at ${savedAt} — ${pbxMappings.length} PBX mappings, ${trustedIps.length} trusted IPs, ${trustedDomains.length} trusted domains`);
    res.json({ ok: true, savedAt });
  });

  // ---------------------------------------------------------------------------
  // Call media log filter page
  // ---------------------------------------------------------------------------
  router.get('/calllogs', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const filter = {
      view: req.query.view || '',
      includeSession: req.query.includeSession === '1',
      exportCaller: req.query.exportCaller || '',
      exportReceiver: req.query.exportReceiver || '',
      caller: req.query.caller || '',
      receiver: req.query.receiver || '',
      username: req.query.username || '',
      domain: req.query.domain || '',
      aor: req.query.aor || '',
      dir: req.query.dir || '',
      mode: req.query.mode || '',
      profile: req.query.profile || req.query.mode || '',
      callId: req.query.callId || '',
      corrId: req.query.corrId || '',
      type: req.query.type || '',
      lteOnly: req.query.lteOnly === '1',
      errorsOnly: req.query.errorsOnly === '1',
    };
    const events = queryEvents({
      aor: filter.aor || undefined,
      username: filter.username || undefined,
      domain: filter.domain || undefined,
      caller: filter.caller || undefined,
      receiver: filter.receiver || undefined,
      callId: filter.callId || undefined,
      corrId: filter.corrId || undefined,
      type: filter.type || undefined,
      dir: filter.dir || undefined,
      mode: filter.mode || undefined,
      profile: filter.profile || undefined,
      lteOnly: filter.lteOnly || undefined,
      errorsOnly: filter.errorsOnly || undefined,
      limit: 200,
    });
    const stats = getStats();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderCallLogPage(events, stats, filter));
  });

  // ---------------------------------------------------------------------------
  // Call media log export (JSON/CSV)
  // ---------------------------------------------------------------------------
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

  attachLatestCallerExportRoutes(router, { queryEvents, requireWireGuardAccess });
  attachLatestCallerReceiverExportRoutes(router, { queryEvents, requireWireGuardAccess });

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

    const events = queryEvents({ corrId: corrId || undefined, callId: (!corrId && callId) ? callId : undefined, limit: 1000 });
    const bundle = buildExportBundle({ events, filters: { corrId: corrId || undefined, callId: (!corrId && callId) ? callId : undefined }, viewMode: 'raw' });

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

    const events = queryEvents({ corrId: corrId || undefined, callId: (!corrId && callId) ? callId : undefined, limit: 1000 });
    const csv = renderEventsCsv(events);
    const filename = `calltrace-${key}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(csv);
  });

  // JSON API for call log events (for scripted access)
  router.get('/calllogs/json', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const filter = {
      view: req.query.view || undefined,
      includeSession: req.query.includeSession === '1' || undefined,
      aor: req.query.aor || undefined,
      username: req.query.username || undefined,
      domain: req.query.domain || undefined,
      callId: req.query.callId || undefined,
      corrId: req.query.corrId || undefined,
      type: req.query.type || undefined,
      dir: req.query.dir || undefined,
      mode: req.query.mode || undefined,
      profile: req.query.profile || req.query.mode || undefined,
      lteOnly: req.query.lteOnly === '1' || undefined,
      errorsOnly: req.query.errorsOnly === '1' || undefined,
      limit: Math.min(Number(req.query.limit) || 200, 500),
    };
    res.json({ stats: getStats(), events: queryEvents(filter) });
  });

  return router;
}

module.exports = { createAdminRoutes };
