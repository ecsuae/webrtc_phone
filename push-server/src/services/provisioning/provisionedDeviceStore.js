'use strict';

const fs = require('fs');

const { devicesPath } = require('./provisioningPaths');

function safeReadDevices() {
  const filePath = devicesPath();
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.devices) ? parsed.devices : []);
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
  return {
    provisioning_id: provisioningId,
    device_id: deviceId,
    device_name: String(d.device_name || '').trim(),
    platform: String(d.platform || '').trim(),
    app_version: String(d.app_version || '').trim(),

    first_provisioned_at: String(d.first_provisioned_at || '').trim() || now,
    last_provisioned_at: String(d.last_provisioned_at || '').trim() || now,

    revoked: d.revoked === true,
    revoked_at: d.revoked_at ? String(d.revoked_at) : (d.revoked === true ? now : ''),
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
    all[idx] = {
      ...prev,
      ...normalized,
      first_provisioned_at: prev.first_provisioned_at || normalized.first_provisioned_at || now,
      last_provisioned_at: now,
    };
  } else {
    all.push({
      ...normalized,
      first_provisioned_at: normalized.first_provisioned_at || now,
      last_provisioned_at: now,
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
  };

  safeWriteDevices(all);
  return { ok: true, provisioning_id: pid, device_id: did, revoked: !!revoked };
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
  deleteProvisionedDevicesForAccount,
};
