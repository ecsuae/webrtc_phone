'use strict';

const { hashPin } = require('../conference/pinHash');
const { renderProvisioningPage } = require('../admin/provisioningPage');
const { attachAdminProvisioningCreateAccountRoute } = require('./adminProvisioningCreateAccountRoute');
const { attachAdminProvisioningAccountManagementRoutes } = require('./adminProvisioningAccountManagementRoutes');
const {
  listProvisioningAccounts,
  findProvisioningAccountById,
  upsertProvisioningAccount,
  updateProvisioningAccount,
  deleteProvisioningAccount,
} = require('../services/provisioning/provisioningAccountStore');
const {
  listProvisionedDevices,
  findProvisionedDevice,
  releaseProvisionedDevice,
  revokeProvisionedDevice,
  deleteProvisionedDevicesForAccount,
} = require('../services/provisioning/provisionedDeviceStore');

function sanitizeProvisioningAccountForAdmin(a) {
  return {
    provisioning_id: a?.provisioning_id,
    label: a?.label,
    internal_label: a?.internal_label,
    enabled: a?.enabled,
    auto_provision_enabled: a?.auto_provision_enabled,
    max_devices: a?.max_devices,
    sip_username: a?.sip_username,
    sip_domain: a?.sip_domain,
    websocket_url: a?.websocket_url,
  };
}

function sanitizeProvisionedDeviceForAdmin(d) {
  return {
    provisioning_id: d?.provisioning_id,
    device_id: d?.device_id,
    device_name: d?.device_name,
    platform: d?.platform,
    app_version: d?.app_version,
    first_provisioned_at: d?.first_provisioned_at,
    last_provisioned_at: d?.last_provisioned_at,
    first_seen: d?.first_seen,
    last_seen: d?.last_seen,
    active: d?.active,
    active_since: d?.active_since,
    last_login_at: d?.last_login_at,
    last_logout_at: d?.last_logout_at,
    revoked: d?.revoked,
    revoked_at: d?.revoked_at,
  };
}

function attachAdminProvisioningRoutes(router, { requireWireGuardAccess }) {
  // ---------------------------------------------------------------------------
  // Provisioning accounts/devices page (read-only)
  // ---------------------------------------------------------------------------
  router.get('/provisioning', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const accounts = listProvisioningAccounts();
    const devices = listProvisionedDevices();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderProvisioningPage({ accounts, devices }));
  });

  attachAdminProvisioningCreateAccountRoute(router, {
    requireWireGuardAccess,
    hashPin,
    findProvisioningAccountById,
    upsertProvisioningAccount,
    sanitizeProvisioningAccountForAdmin,
  });

  attachAdminProvisioningAccountManagementRoutes(router, {
    requireWireGuardAccess,
    updateProvisioningAccount,
    deleteProvisioningAccount,
    findProvisioningAccountById,
    deleteProvisionedDevicesForAccount,
    sanitizeProvisioningAccountForAdmin,
  });

  router.post('/provisioning/account/reset-pin', requireWireGuardAccess, (req, res) => {
    const errors = [];
    const provisioningId = typeof req.body?.provisioning_id === 'string' ? req.body.provisioning_id.trim() : '';
    const newPin = typeof req.body?.new_pin === 'string' ? req.body.new_pin.trim() : '';

    if (!provisioningId) errors.push('provisioning_id is required');
    if (!newPin) errors.push('new_pin is required');
    if (newPin && !/^[0-9]+$/.test(newPin)) errors.push('new_pin must be numeric');
    if (newPin && newPin.length !== 4) errors.push('new_pin must be exactly 4 digits');

    const pepper = String(process.env.PROVISIONING_PIN_PEPPER || '').trim();
    if (!pepper) {
      return res.status(500).json({ ok: false, error_code: 'SERVER_MISCONFIGURED', errors: ['PROVISIONING_PIN_PEPPER is not set'] });
    }

    if (errors.length > 0) return res.status(400).json({ ok: false, errors });

    const pin_hash = hashPin(newPin, pepper);
    const r = updateProvisioningAccount(provisioningId, { pin_hash, provisioning_pin: newPin });
    if (!r?.ok) {
      return res.status(404).json({ ok: false, errors: [r.error || 'update-failed'] });
    }

    const account = findProvisioningAccountById(provisioningId);
    return res.json({ ok: true, account: sanitizeProvisioningAccountForAdmin(account) });
  });

  router.post('/provisioning/account/change-sip-password', requireWireGuardAccess, (req, res) => {
    const errors = [];
    const provisioningId = typeof req.body?.provisioning_id === 'string' ? req.body.provisioning_id.trim() : '';
    const sipPassword = typeof req.body?.sip_password === 'string' ? req.body.sip_password : '';

    if (!provisioningId) errors.push('provisioning_id is required');
    if (!sipPassword) errors.push('sip_password is required');
    if (sipPassword && sipPassword.length < 6) errors.push('sip_password must be at least 6 characters');

    if (errors.length > 0) return res.status(400).json({ ok: false, errors });

    const r = updateProvisioningAccount(provisioningId, { sip_password: sipPassword });
    if (!r?.ok) {
      return res.status(404).json({ ok: false, errors: [r.error || 'update-failed'] });
    }

    const account = findProvisioningAccountById(provisioningId);
    return res.json({ ok: true, account: sanitizeProvisioningAccountForAdmin(account) });
  });

  router.post('/provisioning/device/revoke', requireWireGuardAccess, (req, res) => {
    const errors = [];
    const provisioningId = typeof req.body?.provisioning_id === 'string' ? req.body.provisioning_id.trim() : '';
    const deviceId = typeof req.body?.device_id === 'string' ? req.body.device_id.trim() : '';

    if (!provisioningId) errors.push('provisioning_id is required');
    if (!deviceId) errors.push('device_id is required');

    if (req.body?.revoked === undefined) errors.push('revoked is required');
    else if (typeof req.body.revoked !== 'boolean') errors.push('revoked must be boolean');

    if (errors.length > 0) return res.status(400).json({ ok: false, errors });

    const r = revokeProvisionedDevice(provisioningId, deviceId, req.body.revoked);
    if (!r?.ok) {
      return res.status(404).json({ ok: false, errors: [r.error || 'revoke-failed'] });
    }

    const device = findProvisionedDevice(provisioningId, deviceId);
    return res.json({ ok: true, device: sanitizeProvisionedDeviceForAdmin(device) });
  });

  router.post('/provisioning/device/release-active', requireWireGuardAccess, (req, res) => {
    const provisioningId = typeof req.body?.provisioning_id === 'string' ? req.body.provisioning_id.trim() : '';
    const deviceId = typeof req.body?.device_id === 'string' ? req.body.device_id.trim() : '';
    const errors = [];
    if (!provisioningId) errors.push('provisioning_id is required');
    if (!deviceId) errors.push('device_id is required');
    if (errors.length > 0) return res.status(400).json({ ok: false, errors });

    const r = releaseProvisionedDevice(provisioningId, deviceId);
    if (!r?.ok) return res.status(404).json({ ok: false, errors: [r.error || 'release-failed'] });

    const device = findProvisionedDevice(provisioningId, deviceId);
    return res.json({ ok: true, device: sanitizeProvisionedDeviceForAdmin(device) });
  });
}

module.exports = { attachAdminProvisioningRoutes };
