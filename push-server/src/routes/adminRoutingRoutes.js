'use strict';

const {
  readRoutingConfig,
  writeRoutingConfig,
  readCurrentEnvConfig,
  validateRoutingConfig,
} = require('../services/routingConfig');
const { renderRoutingPage } = require('../admin/routingPage');

function attachAdminRoutingRoutes(router, { requireWireGuardAccess }) {
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
    console.log(
      `[admin/routing] Config saved at ${savedAt} — ${pbxMappings.length} PBX mappings, ${trustedIps.length} trusted IPs, ${trustedDomains.length} trusted domains`
    );
    res.json({ ok: true, savedAt });
  });
}

module.exports = { attachAdminRoutingRoutes };
