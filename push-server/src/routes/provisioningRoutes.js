const express = require('express');

const { provisionDesktop } = require('../services/provisioning/desktopProvisioningService');

function createProvisioningRoutes() {
  const router = express.Router();

  router.post('/desktop', async (req, res) => {
    let result;
    try {
      result = await provisionDesktop(req.body || {});
    } catch (e) {
      return res.status(500).json({ success: false, error_code: 'SERVER_ERROR', message: 'Server error.' });
    }

    if (!result?.ok) {
      return res.status(result?.status || 400).json({
        success: false,
        error_code: result?.error_code || 'UNKNOWN_ERROR',
        message: result?.message || 'Request failed.',
      });
    }

    return res.status(200).json({ success: true, config: result.config });
  });

  return router;
}

module.exports = { createProvisioningRoutes };
