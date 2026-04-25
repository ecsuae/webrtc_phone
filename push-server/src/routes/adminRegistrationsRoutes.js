'use strict';

const { renderRegistrationsPage } = require('../admin/registrationsPage');
const { readLiveRegistrations } = require('../services/registrations/readLiveRegistrations');

function attachAdminRegistrationsRoutes(router, { requireWireGuardAccess }) {
  // ---------------------------------------------------------------------------
  // Live registrations comparison page (Kamailio usrloc vs PBX)
  // ---------------------------------------------------------------------------
  router.get('/registrations', requireWireGuardAccess, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const snapshot = await readLiveRegistrations();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderRegistrationsPage(snapshot));
  });
}

module.exports = { attachAdminRegistrationsRoutes };
