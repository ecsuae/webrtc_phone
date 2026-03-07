const fs = require('fs');
const path = require('path');
const {
  ensureMetadataDir,
  resolveCanonicalDeviceId,
} = require('./core');

function updateMetadata(incoming) {
  const metadataDir = ensureMetadataDir();
  const canonicalDeviceId = resolveCanonicalDeviceId(metadataDir, incoming);
  const metadataFile = path.join(metadataDir, `${canonicalDeviceId}.json`);

  let existingData = {};
  if (fs.existsSync(metadataFile)) {
    try {
      existingData = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    } catch {
      existingData = {};
    }
  }

  const mergedUsernameHistory = [
    ...(existingData.usernameHistory || []),
    ...(incoming.usernameHistory || []),
  ];
  const uniqueUsernameHistory = [...new Set(mergedUsernameHistory)];
  const normalizedDeviceType = incoming.deviceType || incoming.device || existingData.deviceType || 'unknown';
  const mergedBrowserIds = [...new Set([...(existingData.browserIds || []), ...(incoming.browserId ? [incoming.browserId] : [])])];
  const mergedBrowserFingerprints = [...new Set([...(existingData.browserFingerprints || []), ...(incoming.browserFingerprint ? [incoming.browserFingerprint] : [])])];

  const updatedMetadata = {
    deviceId: canonicalDeviceId,
    deviceType: normalizedDeviceType,
    userAgent: incoming.userAgent || existingData.userAgent,
    url: incoming.url || existingData.url,
    currentUsername: incoming.currentUsername || existingData.currentUsername || 'not-logged-in',
    usernameHistory: uniqueUsernameHistory,
    browserId: incoming.browserId || existingData.browserId || null,
    browserIds: mergedBrowserIds,
    browserFingerprint: incoming.browserFingerprint || existingData.browserFingerprint || null,
    browserFingerprints: mergedBrowserFingerprints,
    deviceFingerprint: incoming.deviceFingerprint || existingData.deviceFingerprint || null,
    debugMode: incoming.debugMode !== undefined ? incoming.debugMode : existingData.debugMode,
    lastSeen: incoming.timestamp || new Date().toISOString(),
    firstSeen: existingData.firstSeen || incoming.timestamp || new Date().toISOString(),
    updateCount: (existingData.updateCount || 0) + 1,
    comment: existingData.comment || '',
  };

  fs.writeFileSync(metadataFile, JSON.stringify(updatedMetadata, null, 2));
  return { metadata: updatedMetadata, canonicalDeviceId, metadataDir };
}

module.exports = { updateMetadata };
