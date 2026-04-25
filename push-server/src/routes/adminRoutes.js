'use strict';
const express = require('express');
const { attachAdminRoutingRoutes } = require('./adminRoutingRoutes');
const { attachAdminCallLogsRoutes } = require('./adminCallLogsRoutes');
const { attachAdminRegistrationsRoutes } = require('./adminRegistrationsRoutes');
const { attachAdminProvisioningRoutes } = require('./adminProvisioningRoutes');

function createAdminRoutes({ requireWireGuardAccess }) {
  const router = express.Router();

  attachAdminRoutingRoutes(router, { requireWireGuardAccess });
  attachAdminCallLogsRoutes(router, { requireWireGuardAccess });
  attachAdminRegistrationsRoutes(router, { requireWireGuardAccess });
  attachAdminProvisioningRoutes(router, { requireWireGuardAccess });

  return router;
}

module.exports = { createAdminRoutes };
