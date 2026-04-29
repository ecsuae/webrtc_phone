'use strict';

const fs = require('fs');

const { devicesPath } = require('./provisioningPaths');
const { normalizeProvisionedDeviceRows } = require('./provisionedDeviceNormalize');

const ACTIVE_DEVICE_TTL_MS = 30 * 60 * 1000;

function readDevices() {
  const filePath = devicesPath();
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.devices) ? parsed.devices : []);
    return normalizeProvisionedDeviceRows(rows).devices;
  } catch {
    return [];
  }
}

function writeDevices(devices) {
  fs.writeFileSync(devicesPath(), JSON.stringify({ devices: devices || [], savedAt: new Date().toISOString() }, null, 2));
}

function latestActiveTimestamp(d) {
  return String(d?.last_seen || d?.last_login_at || d?.active_since || '').trim();
}

function isStaleActiveDevice(d, nowMs = Date.now()) {
  if (!d || d.revoked === true || d.active !== true) return false;
  const ts = Date.parse(latestActiveTimestamp(d));
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts > ACTIVE_DEVICE_TTL_MS;
}

function releaseStaleActiveDevicesForAccount(provisioningId) {
  const pid = String(provisioningId || '').trim();
  if (!pid) return { released: 0 };

  const all = readDevices();
  const now = new Date();
  const nowIso = now.toISOString();
  let released = 0;
  const next = all.map((d) => {
    if (String(d?.provisioning_id || '').trim() !== pid || !isStaleActiveDevice(d, now.getTime())) return d;
    released += 1;
    return {
      ...d,
      active: false,
      active_since: '',
      last_logout_at: d.last_logout_at || nowIso,
      stale_released_at: nowIso,
      last_seen: nowIso,
    };
  });

  if (released > 0) writeDevices(next);
  return { released };
}

function countLiveActiveDevicesForAccount(provisioningId) {
  const pid = String(provisioningId || '').trim();
  if (!pid) return 0;
  releaseStaleActiveDevicesForAccount(pid);
  return readDevices().filter(
    (d) => String(d?.provisioning_id || '').trim() === pid && d.revoked !== true && d.active === true
  ).length;
}

module.exports = {
  ACTIVE_DEVICE_TTL_MS,
  countLiveActiveDevicesForAccount,
  releaseStaleActiveDevicesForAccount,
};
