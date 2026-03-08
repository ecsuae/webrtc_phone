const fs = require('fs');
const path = require('path');

const LOGS_BASE_DIR = path.join(process.cwd(), '..', 'backups', 'mobile-logs');
const METADATA_DIR = path.join(LOGS_BASE_DIR, 'metadata');

function ensureMetadataDir() {
  if (!fs.existsSync(METADATA_DIR)) {
    fs.mkdirSync(METADATA_DIR, { recursive: true });
  }
  return METADATA_DIR;
}

function readMetadataById(metadataDir, id) {
  const filePath = path.join(metadataDir, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listMetadata(metadataDir) {
  if (!fs.existsSync(metadataDir)) return [];
  const files = fs.readdirSync(metadataDir).filter((name) => name.endsWith('.json'));
  const items = [];
  for (const fileName of files) {
    const id = fileName.replace(/\.json$/, '');
    const data = readMetadataById(metadataDir, id);
    if (data) items.push(data);
  }
  return items;
}

function resolveCanonicalDeviceId(metadataDir, incoming) {
  const incomingId = typeof incoming.deviceId === 'string' && incoming.deviceId.trim()
    ? incoming.deviceId.trim()
    : null;
  const incomingBrowserId = typeof incoming.browserId === 'string' && incoming.browserId.trim()
    ? incoming.browserId.trim()
    : null;
  const incomingDeviceFp = typeof incoming.deviceFingerprint === 'string' && incoming.deviceFingerprint.trim()
    ? incoming.deviceFingerprint.trim()
    : null;

  if (incomingId && readMetadataById(metadataDir, incomingId)) {
    return incomingId;
  }

  const all = listMetadata(metadataDir);
  const valid = all.filter((m) => typeof m.deviceId === 'string' && m.deviceId.trim());

  if (incomingBrowserId) {
    const byBrowser = valid.find((m) =>
      m.browserId === incomingBrowserId || (Array.isArray(m.browserIds) && m.browserIds.includes(incomingBrowserId))
    );
    if (byBrowser?.deviceId) return byBrowser.deviceId;
  }

  if (incomingDeviceFp) {
    const byDeviceFp = valid
      .filter((m) => m.deviceFingerprint === incomingDeviceFp)
      .sort((a, b) => String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')));
    if (byDeviceFp[0]?.deviceId) return byDeviceFp[0].deviceId;
  }

  if (incomingId) return incomingId;
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = {
  LOGS_BASE_DIR,
  METADATA_DIR,
  ensureMetadataDir,
  readMetadataById,
  listMetadata,
  resolveCanonicalDeviceId,
};
