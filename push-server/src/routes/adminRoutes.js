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
      username: req.query.username || '',
      domain: req.query.domain || '',
      aor: req.query.aor || '',
      dir: req.query.dir || '',
      mode: req.query.mode || '',
      profile: req.query.profile || req.query.mode || '',
      callId: req.query.callId || '',
      type: req.query.type || '',
      lteOnly: req.query.lteOnly === '1',
      errorsOnly: req.query.errorsOnly === '1',
    };
    const events = queryEvents({
      aor: filter.aor || undefined,
      username: filter.username || undefined,
      domain: filter.domain || undefined,
      callId: filter.callId || undefined,
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
