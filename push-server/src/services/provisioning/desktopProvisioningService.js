'use strict';

const { hashPin } = require('../../conference/pinHash');
const {
  findProvisioningAccountById,
} = require('./provisioningAccountStore');
const {
  findProvisionedDevice,
  listProvisionedDevicesForAccount,
  upsertProvisionedDevice,
} = require('./provisionedDeviceStore');

function err(error_code, message, status = 400) {
  return { ok: false, status, error_code, message };
}

function ok(config, meta) {
  return { ok: true, status: 200, config, meta: meta || undefined };
}

function normalizeId(v) {
  return String(v || '').trim();
}

function pickConfigFromAccount(a) {
  return {
    display_name: String(a?.display_name || '').trim(),
    sip_username: String(a?.sip_username || '').trim(),
    sip_password: String(a?.sip_password || '').trim(),
    sip_domain: String(a?.sip_domain || '').trim(),
    websocket_url: String(a?.websocket_url || '').trim(),
    transport: String(a?.transport || '').trim(),
  };
}

function validateConfigShape(cfg) {
  if (!cfg.sip_username || !cfg.sip_password || !cfg.sip_domain) return false;
  return true;
}

function countActiveDevices(devices) {
  return (devices || []).filter((d) => d && d.revoked !== true).length;
}

function hashProvisioningPin(pin) {
  const pepper = String(process.env.PROVISIONING_PIN_PEPPER || '').trim();
  return hashPin(pin, pepper);
}

async function provisionDesktop(payload) {
  const provisioning_id = normalizeId(payload?.provisioning_id);
  const pin = normalizeId(payload?.pin);
  const device_id = normalizeId(payload?.device_id);

  const pepper = String(process.env.PROVISIONING_PIN_PEPPER || '').trim();
  if (!pepper) {
    return err('SERVER_MISCONFIGURED', 'Provisioning service is not configured.', 500);
  }

  if (!provisioning_id || !pin || !device_id) {
    return err('INVALID_REQUEST', 'Missing provisioning_id, pin, or device_id.', 400);
  }

  const account = findProvisioningAccountById(provisioning_id);
  if (!account) {
    return err('INVALID_CREDENTIALS', 'Invalid provisioning credentials.', 403);
  }

  if (account.enabled !== true) {
    return err('ACCOUNT_DISABLED', 'This provisioning account is disabled.', 403);
  }

  if (account.auto_provision_enabled !== true) {
    return err('AUTO_PROVISION_DISABLED', 'Auto provisioning is disabled for this account.', 403);
  }

  const expectedHash = String(account.pin_hash || '').trim();
  const gotHash = hashProvisioningPin(pin);
  if (!expectedHash || !gotHash || expectedHash !== gotHash) {
    return err('INVALID_CREDENTIALS', 'Invalid provisioning credentials.', 403);
  }

  const existing = findProvisionedDevice(provisioning_id, device_id);
  if (existing && existing.revoked === true) {
    return err('DEVICE_REVOKED', 'This device has been revoked.', 403);
  }

  if (!existing) {
    const allDevices = listProvisionedDevicesForAccount(provisioning_id);
    const maxDevicesRaw = Number(account.max_devices);
    const maxDevices = Number.isFinite(maxDevicesRaw) && maxDevicesRaw > 0 ? maxDevicesRaw : 1;
    const activeCount = countActiveDevices(allDevices);
    if (activeCount >= maxDevices) {
      return err('DEVICE_LIMIT_REACHED', 'Maximum allowed devices reached.', 403);
    }
  }

  const config = pickConfigFromAccount(account);
  if (!validateConfigShape(config)) {
    return err('ACCOUNT_CONFIG_INVALID', 'Provisioning account configuration is incomplete.', 500);
  }

  const devicePatch = {
    provisioning_id,
    device_id,
    device_name: normalizeId(payload?.device_name),
    platform: normalizeId(payload?.platform),
    app_version: normalizeId(payload?.app_version),
    revoked: false,
  };
  upsertProvisionedDevice(devicePatch);

  return ok(config, { provisioning_id, device_id });
}

module.exports = {
  provisionDesktop,
};
