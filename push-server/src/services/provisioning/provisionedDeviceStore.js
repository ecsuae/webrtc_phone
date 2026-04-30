'use strict';

const fs = require('fs');

const { devicesPath } = require('./provisioningPaths');
const { normalizeProvisionedDeviceRows } = require('./provisionedDeviceNormalize');

function safeReadDevices() {
  const filePath = devicesPath();
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.devices) ? parsed.devices : []);
    const normalized = normalizeProvisionedDeviceRows(rows);
    if (normalized.changed) safeWriteDevices(normalized.devices);
    return normalized.devices;
  } catch {
    return [];
  }
}

function safeWriteDevices(devices) {
  const filePath = devicesPath();
  fs.writeFileSync(filePath, JSON.stringify({ devices: devices || [], savedAt: new Date().toISOString() }, null, 2));
  return filePath;
}

function normalizeDevice(incoming) {
  const d = incoming && typeof incoming === 'object' ? { ...incoming } : {};
  const provisioningId = String(d.provisioning_id || d.provisioningId || '').trim();
  const deviceId = String(d.device_id || d.deviceId || '').trim();
  if (!provisioningId || !deviceId) return null;

  const now = new Date().toISOString();
  const active = d.active === true;
  return {
    provisioning_id: provisioningId,
    device_id: deviceId,
    device_name: String(d.device_name || '').trim(),
    platform: String(d.platform || '').trim(),
    app_version: String(d.app_version || '').trim(),

    first_provisioned_at: String(d.first_provisioned_at || '').trim() || now,
    last_provisioned_at: String(d.last_provisioned_at || '').trim() || now,
    first_seen: String(d.first_seen || d.first_provisioned_at || '').trim() || now,
    last_seen: String(d.last_seen || d.last_provisioned_at || '').trim() || now,

    revoked: d.revoked === true,
    revoked_at: d.revoked_at ? String(d.revoked_at) : (d.revoked === true ? now : ''),
    active,
    active_since: active ? (String(d.active_since || '').trim() || now) : '',
    last_login_at: String(d.last_login_at || '').trim(),
    last_logout_at: String(d.last_logout_at || '').trim(),
  };
}

function listProvisionedDevices() {
  return safeReadDevices();
}

function listProvisionedDevicesForAccount(provisioningId) {
  const id = String(provisioningId || '').trim();
  if (!id) return [];
  return safeReadDevices().filter((d) => String(d?.provisioning_id || '').trim() === id);
}

function findProvisionedDevice(provisioningId, deviceId) {
  const pid = String(provisioningId || '').trim();
  const did = String(deviceId || '').trim();
  if (!pid || !did) return null;
  const all = safeReadDevices();
  return all.find((d) => String(d?.provisioning_id || '').trim() === pid && String(d?.device_id || '').trim() === did) || null;
}

function upsertProvisionedDevice(device) {
  const normalized = normalizeDevice(device);
  if (!normalized) return { ok: false, error: 'missing-provisioning-id-or-device-id' };

  const all = safeReadDevices();
  const idx = all.findIndex(
    (d) =>
      String(d?.provisioning_id || '').trim() === normalized.provisioning_id &&
      String(d?.device_id || '').trim() === normalized.device_id
  );

  const now = new Date().toISOString();
  if (idx >= 0) {
    const prev = all[idx] || {};
    const active = normalized.active === true;
    all[idx] = {
      ...prev,
      ...normalized,
      first_provisioned_at: prev.first_provisioned_at || normalized.first_provisioned_at || now,
      last_provisioned_at: now,
      first_seen: prev.first_seen || prev.first_provisioned_at || now,
      last_seen: now,
      active,
      active_since: active ? (prev.active_since || now) : '',
      last_login_at: active ? now : (prev.last_login_at || ''),
    };
  } else {
    all.push({
      ...normalized,
      first_provisioned_at: normalized.first_provisioned_at || now,
      last_provisioned_at: now,
      first_seen: normalized.first_seen || normalized.first_provisioned_at || now,
      last_seen: now,
      active_since: normalized.active ? (normalized.active_since || now) : '',
      last_login_at: normalized.active ? now : (normalized.last_login_at || ''),
    });
  }

  safeWriteDevices(all);
  return { ok: true, provisioning_id: normalized.provisioning_id, device_id: normalized.device_id };
}

function revokeProvisionedDevice(provisioningId, deviceId, revoked = true) {
  const pid = String(provisioningId || '').trim();
  const did = String(deviceId || '').trim();
  if (!pid || !did) return { ok: false, error: 'missing-provisioning-id-or-device-id' };

  const all = safeReadDevices();
  const idx = all.findIndex(
    (d) => String(d?.provisioning_id || '').trim() === pid && String(d?.device_id || '').trim() === did
  );
  if (idx < 0) return { ok: false, error: 'not-found' };

  const now = new Date().toISOString();
  const prev = all[idx] || {};
  all[idx] = {
    ...prev,
    revoked: !!revoked,
    revoked_at: revoked ? (prev.revoked_at || now) : '',
    active: revoked ? false : prev.active === true,
    active_since: revoked ? '' : (prev.active_since || ''),
    last_logout_at: revoked && prev.active === true ? now : (prev.last_logout_at || ''),
    last_seen: now,
  };

  safeWriteDevices(all);
  return { ok: true, provisioning_id: pid, device_id: did, revoked: !!revoked };
}

function releaseProvisionedDevice(provisioningId, deviceId) {
  const pid = String(provisioningId || '').trim();
  const did = String(deviceId || '').trim();
  if (!pid || !did) return { ok: false, error: 'missing-provisioning-id-or-device-id' };

  const all = safeReadDevices();
  const idx = all.findIndex(
    (d) => String(d?.provisioning_id || '').trim() === pid && String(d?.device_id || '').trim() === did
  );
  if (idx < 0) return { ok: false, error: 'not-found' };

  const now = new Date().toISOString();
  const prev = all[idx] || {};
  all[idx] = {
    ...prev,
    active: false,
    active_since: '',
    last_logout_at: now,
    last_seen: now,
  };

  safeWriteDevices(all);
  return { ok: true, provisioning_id: pid, device_id: did, active: false, last_logout_at: now };
}

function deleteProvisionedDevicesForAccount(provisioningId) {
  const pid = String(provisioningId || '').trim();
  if (!pid) return { ok: false, error: 'missing-provisioning-id' };
  const all = safeReadDevices();
  const next = all.filter((d) => String(d?.provisioning_id || '').trim() !== pid);
  const deleted = all.length - next.length;
  if (deleted > 0) safeWriteDevices(next);
  return { ok: true, provisioning_id: pid, deleted };
}

module.exports = {
  listProvisionedDevices,
  listProvisionedDevicesForAccount,
  findProvisionedDevice,
  upsertProvisionedDevice,
  revokeProvisionedDevice,
  releaseProvisionedDevice,
  deleteProvisionedDevicesForAccount,
};
