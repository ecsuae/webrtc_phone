'use strict';

function attachAdminProvisioningAccountManagementRoutes(
  router,
  {
    requireWireGuardAccess,
    updateProvisioningAccount,
    deleteProvisioningAccount,
    findProvisioningAccountById,
    deleteProvisionedDevicesForAccount,
    sanitizeProvisioningAccountForAdmin,
  }
) {
  router.post('/provisioning/account/update', requireWireGuardAccess, (req, res) => {
    const errors = [];
    const provisioningId = typeof req.body?.provisioning_id === 'string' ? req.body.provisioning_id.trim() : '';
    if (!provisioningId) errors.push('provisioning_id is required');

    const patch = {};

    if (req.body?.enabled !== undefined) {
      if (typeof req.body.enabled !== 'boolean') errors.push('enabled must be boolean');
      else patch.enabled = req.body.enabled;
    }
    if (req.body?.auto_provision_enabled !== undefined) {
      if (typeof req.body.auto_provision_enabled !== 'boolean') errors.push('auto_provision_enabled must be boolean');
      else patch.auto_provision_enabled = req.body.auto_provision_enabled;
    }
    if (req.body?.max_devices !== undefined) {
      const n = Number(req.body.max_devices);
      if (!Number.isInteger(n) || n < 1) errors.push('max_devices must be an integer >= 1');
      else patch.max_devices = n;
    }

    if (req.body?.label !== undefined) {
      if (typeof req.body.label !== 'string') errors.push('label must be string');
      else patch.label = String(req.body.label || '').trim();
    }
    if (req.body?.internal_label !== undefined) {
      if (typeof req.body.internal_label !== 'string') errors.push('internal_label must be string');
      else patch.internal_label = String(req.body.internal_label || '').trim();
    }
    if (req.body?.sip_username !== undefined) {
      if (typeof req.body.sip_username !== 'string') errors.push('sip_username must be string');
      else {
        const v = String(req.body.sip_username || '').trim();
        if (!v) errors.push('sip_username must be non-empty');
        else patch.sip_username = v;
      }
    }
    if (req.body?.sip_domain !== undefined) {
      if (typeof req.body.sip_domain !== 'string') errors.push('sip_domain must be string');
      else {
        const v = String(req.body.sip_domain || '').trim();
        if (!v) errors.push('sip_domain must be non-empty');
        else patch.sip_domain = v;
      }
    }
    if (req.body?.websocket_url !== undefined) {
      if (typeof req.body.websocket_url !== 'string') errors.push('websocket_url must be string');
      else {
        const v = String(req.body.websocket_url || '').trim();
        if (!v) errors.push('websocket_url must be non-empty');
        else patch.websocket_url = v;
      }
    }

    if (errors.length > 0) return res.status(400).json({ ok: false, errors });

    const r = updateProvisioningAccount(provisioningId, patch);
    if (!r?.ok) {
      return res.status(404).json({ ok: false, errors: [r.error || 'update-failed'] });
    }

    const account = findProvisioningAccountById(provisioningId);
    return res.json({ ok: true, account: sanitizeProvisioningAccountForAdmin(account) });
  });

  router.post('/provisioning/account/delete', requireWireGuardAccess, (req, res) => {
    const errors = [];
    const provisioningId = typeof req.body?.provisioning_id === 'string' ? req.body.provisioning_id.trim() : '';
    if (!provisioningId) errors.push('provisioning_id is required');
    if (errors.length > 0) return res.status(400).json({ ok: false, errors });

    const r = deleteProvisioningAccount(provisioningId);
    if (!r?.ok) return res.status(404).json({ ok: false, errors: [r?.error || 'delete-failed'] });

    const d = deleteProvisionedDevicesForAccount(provisioningId);
    return res.json({ ok: true, provisioning_id: provisioningId, deleted_devices: d?.deleted || 0 });
  });
}

module.exports = { attachAdminProvisioningAccountManagementRoutes };
