const express = require('express');
const path = require('path');

function createSystemRoutes({ isVapidConfigured, requireWireGuardAccess, getSubscriptionsCount }) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      subscriptions: getSubscriptionsCount(),
      vapidConfigured: isVapidConfigured(),
    });
  });

  router.get('/dashboard', requireWireGuardAccess, (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dashboard.html'));
  });

  return router;
}

module.exports = { createSystemRoutes };
