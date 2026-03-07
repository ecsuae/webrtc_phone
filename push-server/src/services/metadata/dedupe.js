const fs = require('fs');
const path = require('path');
const { LOGS_BASE_DIR, ensureMetadataDir, listMetadata } = require('./core');

function mergeUnique(base = [], add = []) {
  return [...new Set([...(base || []), ...(add || [])])];
}

function parseIsoMs(value, fallback = 0) {
  const t = Date.parse(value || '');
  return Number.isFinite(t) ? t : fallback;
}

function mergeDeviceMetadataRecords(records) {
  const sorted = [...records].sort((a, b) => parseIsoMs(b.lastSeen) - parseIsoMs(a.lastSeen));
  const canonical = { ...sorted[0] };

  for (const item of sorted.slice(1)) {
    canonical.usernameHistory = mergeUnique(canonical.usernameHistory, item.usernameHistory);
    canonical.browserIds = mergeUnique(canonical.browserIds, item.browserIds);
    canonical.browserFingerprints = mergeUnique(canonical.browserFingerprints, item.browserFingerprints);
    if (!canonical.comment && item.comment) canonical.comment = item.comment;
    if (canonical.currentUsername === 'not-logged-in' && item.currentUsername && item.currentUsername !== 'not-logged-in') {
      canonical.currentUsername = item.currentUsername;
    }
    if (!canonical.deviceType || canonical.deviceType === 'unknown') canonical.deviceType = item.deviceType || canonical.deviceType;
    if (!canonical.userAgent && item.userAgent) canonical.userAgent = item.userAgent;
    if (!canonical.deviceFingerprint && item.deviceFingerprint) canonical.deviceFingerprint = item.deviceFingerprint;
    if (!canonical.browserId && item.browserId) canonical.browserId = item.browserId;
    if (!canonical.browserFingerprint && item.browserFingerprint) canonical.browserFingerprint = item.browserFingerprint;
  }

  const firstSeenMs = Math.min(...sorted.map((m) => parseIsoMs(m.firstSeen, Date.now())));
  const lastSeenMs = Math.max(...sorted.map((m) => parseIsoMs(m.lastSeen, 0)));
  canonical.firstSeen = new Date(firstSeenMs).toISOString();
  canonical.lastSeen = new Date(lastSeenMs || Date.now()).toISOString();
  canonical.updateCount = sorted.reduce((sum, m) => sum + (Number(m.updateCount) || 0), 0);
  canonical.debugMode = sorted.some((m) => Boolean(m.debugMode));
  return canonical;
}

function mergeDeviceLogDirs(canonicalId, duplicateId) {
  const canonicalDir = path.join(LOGS_BASE_DIR, canonicalId);
  const duplicateDir = path.join(LOGS_BASE_DIR, duplicateId);
  if (!fs.existsSync(duplicateDir)) return;

  if (!fs.existsSync(canonicalDir)) fs.mkdirSync(canonicalDir, { recursive: true });
  for (const fileName of fs.readdirSync(duplicateDir)) {
    const from = path.join(duplicateDir, fileName);
    let to = path.join(canonicalDir, fileName);
    if (fs.existsSync(to)) to = path.join(canonicalDir, `${duplicateId}_${fileName}`);
    fs.renameSync(from, to);
  }
  fs.rmSync(duplicateDir, { recursive: true, force: true });
}

function dedupeMetadataStore() {
  const metadataDir = ensureMetadataDir();
  const archiveDir = path.join(metadataDir, 'archive');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  const all = listMetadata(metadataDir);
  const byKey = new Map();
  for (const m of all) {
    const key = m.deviceFingerprint ? `fp:${m.deviceFingerprint}` : (m.browserId ? `bid:${m.browserId}` : `id:${m.deviceId}`);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(m);
  }

  let mergedGroups = 0;
  let removedRecords = 0;
  for (const group of byKey.values()) {
    if (group.length <= 1) continue;
    const merged = mergeDeviceMetadataRecords(group);
    const canonicalId = merged.deviceId;
    fs.writeFileSync(path.join(metadataDir, `${canonicalId}.json`), JSON.stringify(merged, null, 2));

    for (const item of group) {
      if (item.deviceId === canonicalId) continue;
      const dupFile = path.join(metadataDir, `${item.deviceId}.json`);
      if (fs.existsSync(dupFile)) {
        fs.renameSync(dupFile, path.join(archiveDir, `${item.deviceId}.${Date.now()}.json`));
      }
      mergeDeviceLogDirs(canonicalId, item.deviceId);
      removedRecords += 1;
    }
    mergedGroups += 1;
  }

  return { mergedGroups, removedRecords };
}

module.exports = { dedupeMetadataStore };
