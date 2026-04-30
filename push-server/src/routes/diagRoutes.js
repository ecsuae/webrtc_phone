/**
 * Registration Diagnostics Admin Routes — diagRoutes.js
 *
 * Route: GET /diagnostics/errors
 * Access: WireGuard / localhost only (requireWireGuardAccess middleware)
 * Purpose: Admin reference page listing all REG-E error codes with full
 *          technical explanations, likely layers, causes, and recommended checks.
 */

const express = require('express');
const { renderDiagPage } = require('../dashboard/diagPage');

function createDiagRoutes({ requireWireGuardAccess }) {
  const router = express.Router();

  router.get('/errors', requireWireGuardAccess, (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderDiagPage());
  });

  return router;
}

module.exports = { createDiagRoutes };
