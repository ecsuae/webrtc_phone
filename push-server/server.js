// Push Notification Server
// Handles WebRTC incoming call notifications

const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const LISTEN_HOST = process.env.PUSH_LISTEN_HOST || '127.0.0.1';
const WG_CIDR_PREFIX = process.env.WG_CIDR_PREFIX || '10.252.253.';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory storage for subscriptions
// Format: { extension: [{ subscription, timestamp }] }
const subscriptions = new Map();

function normalizeIp(ip) {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function getClientIp(req) {
  const xRealIp = req.headers['x-real-ip'];
  if (typeof xRealIp === 'string' && xRealIp.trim()) {
    return normalizeIp(xRealIp.trim());
  }
  return normalizeIp(req.ip || '');
}

function isWireGuardOrLocalIp(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip.startsWith(WG_CIDR_PREFIX);
}

function requireWireGuardAccess(req, res, next) {
  const ip = getClientIp(req);
  if (isWireGuardOrLocalIp(ip)) return next();
  return res.status(403).json({
    error: 'Forbidden',
    message: 'This endpoint is only available via WireGuard.',
    ip,
  });
}

function ensureMetadataDir() {
  const metadataDir = path.join(__dirname, '..', 'backups', 'mobile-logs', 'metadata');
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }
  return metadataDir;
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
  const incomingId = incoming.deviceId;
  const incomingBrowserId = incoming.browserId;
  const incomingDeviceFp = incoming.deviceFingerprint;

  // 1) Exact existing file by incoming deviceId
  if (incomingId && readMetadataById(metadataDir, incomingId)) {
    return incomingId;
  }

  const all = listMetadata(metadataDir);

  // 2) Exact browser ID match (same browser installation)
  if (incomingBrowserId) {
    const byBrowser = all.find((m) =>
      m.browserId === incomingBrowserId || Array.isArray(m.browserIds) && m.browserIds.includes(incomingBrowserId)
    );
    if (byBrowser?.deviceId) return byBrowser.deviceId;
  }

  // 3) Same physical device fingerprint (possibly different browser)
  if (incomingDeviceFp) {
    const byDeviceFp = all
      .filter((m) => m.deviceFingerprint === incomingDeviceFp)
      .sort((a, b) => String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')));
    if (byDeviceFp.length > 0 && byDeviceFp[0].deviceId) {
      return byDeviceFp[0].deviceId;
    }
  }

  // 4) Fall back to incoming ID (or create one if missing)
  if (incomingId) return incomingId;
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

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

function mergeDeviceLogDirs(logsBaseDir, canonicalId, duplicateId) {
  const canonicalDir = path.join(logsBaseDir, canonicalId);
  const duplicateDir = path.join(logsBaseDir, duplicateId);
  if (!fs.existsSync(duplicateDir)) return;

  if (!fs.existsSync(canonicalDir)) {
    fs.mkdirSync(canonicalDir, { recursive: true });
  }

  const files = fs.readdirSync(duplicateDir);
  for (const fileName of files) {
    const from = path.join(duplicateDir, fileName);
    let to = path.join(canonicalDir, fileName);
    if (fs.existsSync(to)) {
      to = path.join(canonicalDir, `${duplicateId}_${fileName}`);
    }
    fs.renameSync(from, to);
  }
  fs.rmSync(duplicateDir, { recursive: true, force: true });
}

function dedupeMetadataStore() {
  const metadataDir = ensureMetadataDir();
  const logsBaseDir = path.join(__dirname, '..', 'backups', 'mobile-logs');
  const archiveDir = path.join(metadataDir, 'archive');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const all = listMetadata(metadataDir);
  const byKey = new Map();

  for (const m of all) {
    const key = m.deviceFingerprint
      ? `fp:${m.deviceFingerprint}`
      : (m.browserId ? `bid:${m.browserId}` : `id:${m.deviceId}`);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(m);
  }

  let mergedGroups = 0;
  let removedRecords = 0;
  for (const [_, group] of byKey.entries()) {
    if (group.length <= 1) continue;

    const merged = mergeDeviceMetadataRecords(group);
    const canonicalId = merged.deviceId;
    const canonicalFile = path.join(metadataDir, `${canonicalId}.json`);
    fs.writeFileSync(canonicalFile, JSON.stringify(merged, null, 2));

    for (const item of group) {
      if (item.deviceId === canonicalId) continue;

      const dupFile = path.join(metadataDir, `${item.deviceId}.json`);
      if (fs.existsSync(dupFile)) {
        const archivedFile = path.join(archiveDir, `${item.deviceId}.${Date.now()}.json`);
        fs.renameSync(dupFile, archivedFile);
      }

      mergeDeviceLogDirs(logsBaseDir, canonicalId, item.deviceId);
      removedRecords += 1;
    }
    mergedGroups += 1;
  }

  if (mergedGroups > 0) {
    console.log(`✓ Metadata dedupe complete: ${mergedGroups} groups merged, ${removedRecords} duplicate records archived`);
  } else {
    console.log('✓ Metadata dedupe complete: no duplicate groups found');
  }
}

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('✓ VAPID keys configured');
} else {
  console.warn('⚠ VAPID keys not configured! Run: npm run generate-keys');
  console.warn('⚠ Then update .env file with the generated keys');
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    subscriptions: subscriptions.size,
    vapidConfigured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
  });
});

// Get VAPID public key
app.get('/api/push/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications
app.post('/api/push/subscribe', (req, res) => {
  const { extension, subscription } = req.body;

  if (!extension || !subscription) {
    return res.status(400).json({ error: 'Missing extension or subscription' });
  }

  if (!subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Invalid subscription format' });
  }

  // Store subscription for this extension
  if (!subscriptions.has(extension)) {
    subscriptions.set(extension, []);
  }

  const subs = subscriptions.get(extension);
  
  // Check if subscription already exists
  const existingIndex = subs.findIndex(s => s.subscription.endpoint === subscription.endpoint);
  if (existingIndex >= 0) {
    // Update existing subscription
    subs[existingIndex] = {
      subscription,
      timestamp: Date.now()
    };
    console.log(`✓ Updated push subscription for extension ${extension}`);
  } else {
    // Add new subscription
    subs.push({
      subscription,
      timestamp: Date.now()
    });
    console.log(`✓ New push subscription for extension ${extension} (total: ${subs.length})`);
  }

  res.json({
    success: true,
    message: 'Subscription saved',
    extension,
    totalSubscriptions: subs.length
  });
});

// Unsubscribe from push notifications
app.post('/api/push/unsubscribe', (req, res) => {
  const { extension, endpoint } = req.body;

  if (!extension || !endpoint) {
    return res.status(400).json({ error: 'Missing extension or endpoint' });
  }

  if (!subscriptions.has(extension)) {
    return res.status(404).json({ error: 'Extension not found' });
  }

  const subs = subscriptions.get(extension);
  const filteredSubs = subs.filter(s => s.subscription.endpoint !== endpoint);

  if (filteredSubs.length === 0) {
    subscriptions.delete(extension);
    console.log(`✓ Removed last subscription for extension ${extension}`);
  } else {
    subscriptions.set(extension, filteredSubs);
    console.log(`✓ Removed subscription for extension ${extension} (remaining: ${filteredSubs.length})`);
  }

  res.json({
    success: true,
    message: 'Subscription removed'
  });
});

// Send push notification (triggered by incoming call)
app.post('/api/push/notify', async (req, res) => {
  const { extension, from, callId, title, body } = req.body;

  if (!extension) {
    return res.status(400).json({ error: 'Missing extension' });
  }

  if (!subscriptions.has(extension)) {
    console.log(`⚠ No subscriptions found for extension ${extension}`);
    return res.status(404).json({
      error: 'No subscriptions found',
      extension
    });
  }

  const subs = subscriptions.get(extension);
  console.log(`→ Sending push notification to ${subs.length} device(s) for extension ${extension}`);
  console.log(`  From: ${from || 'Unknown'}, Call ID: ${callId || 'N/A'}`);

  const payload = JSON.stringify({
    title: title || 'Incoming Call',
    body: body || `From: ${from || 'Unknown Caller'}`,
    from: from,
    callId: callId,
    url: '/',
    timestamp: Date.now()
  });

  const results = [];
  const failedSubs = [];

  // Send notification to all subscriptions for this extension
  for (let i = 0; i < subs.length; i++) {
    const { subscription } = subs[i];
    
    try {
      const result = await webpush.sendNotification(subscription, payload);
      results.push({
        success: true,
        statusCode: result.statusCode,
        endpoint: subscription.endpoint.substring(0, 50) + '...'
      });
      console.log(`  ✓ Sent to device ${i + 1}: ${result.statusCode}`);
    } catch (error) {
      console.error(`  ✗ Failed to send to device ${i + 1}:`, error.message);
      
      // If subscription is invalid (410 Gone), mark for removal
      if (error.statusCode === 410 || error.statusCode === 404) {
        failedSubs.push(i);
      }
      
      results.push({
        success: false,
        error: error.message,
        statusCode: error.statusCode,
        endpoint: subscription.endpoint.substring(0, 50) + '...'
      });
    }
  }

  // Remove failed subscriptions
  if (failedSubs.length > 0) {
    const updatedSubs = subs.filter((_, index) => !failedSubs.includes(index));
    if (updatedSubs.length === 0) {
      subscriptions.delete(extension);
      console.log(`  Removed all invalid subscriptions for extension ${extension}`);
    } else {
      subscriptions.set(extension, updatedSubs);
      console.log(`  Removed ${failedSubs.length} invalid subscription(s)`);
    }
  }

  const successCount = results.filter(r => r.success).length;
  
  res.json({
    success: successCount > 0,
    message: `Sent to ${successCount}/${subs.length} device(s)`,
    extension,
    results
  });
});

// Receive device metadata (always sent, regardless of debug mode)
app.post('/api/logs/mobile/metadata', (req, res) => {
  const {
    deviceId,
    deviceType,
    device,
    userAgent,
    url,
    currentUsername,
    usernameHistory,
    debugMode,
    timestamp,
    browserId,
    browserFingerprint,
    deviceFingerprint,
  } = req.body;

  if (!deviceId && !deviceFingerprint && !browserId) {
    return res.status(400).json({ error: 'Missing identity fields (deviceId/deviceFingerprint/browserId)' });
  }

  const metadataDir = ensureMetadataDir();
  const canonicalDeviceId = resolveCanonicalDeviceId(metadataDir, req.body);

  // Metadata file for this device
  const metadataFile = path.join(metadataDir, `${canonicalDeviceId}.json`);
  
  // Load existing metadata if it exists
  let existingData = {};
  if (fs.existsSync(metadataFile)) {
    try {
      existingData = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    } catch (e) {
      // Ignore parse errors, will overwrite
    }
  }

  // Merge username history (union of old and new)
  const mergedUsernameHistory = [
    ...(existingData.usernameHistory || []),
    ...(usernameHistory || [])
  ];
  const uniqueUsernameHistory = [...new Set(mergedUsernameHistory)];
  const normalizedDeviceType = deviceType || device || existingData.deviceType || 'unknown';
  const mergedBrowserIds = [...new Set([
    ...(existingData.browserIds || []),
    ...(browserId ? [browserId] : []),
  ])];
  const mergedBrowserFingerprints = [...new Set([
    ...(existingData.browserFingerprints || []),
    ...(browserFingerprint ? [browserFingerprint] : []),
  ])];

  // Update metadata
  const updatedMetadata = {
    deviceId: canonicalDeviceId,
    deviceType: normalizedDeviceType,
    userAgent: userAgent || existingData.userAgent,
    url: url || existingData.url,
    currentUsername: currentUsername || existingData.currentUsername || 'not-logged-in',
    usernameHistory: uniqueUsernameHistory,
    browserId: browserId || existingData.browserId || null,
    browserIds: mergedBrowserIds,
    browserFingerprint: browserFingerprint || existingData.browserFingerprint || null,
    browserFingerprints: mergedBrowserFingerprints,
    deviceFingerprint: deviceFingerprint || existingData.deviceFingerprint || null,
    debugMode: debugMode !== undefined ? debugMode : existingData.debugMode,
    lastSeen: timestamp || new Date().toISOString(),
    firstSeen: existingData.firstSeen || timestamp || new Date().toISOString(),
    updateCount: (existingData.updateCount || 0) + 1,
    comment: existingData.comment || '' // Preserve admin comments
  };

  // Write metadata file
  try {
    fs.writeFileSync(metadataFile, JSON.stringify(updatedMetadata, null, 2));
    console.log(`✓ Metadata updated for device ${canonicalDeviceId} (user: ${currentUsername || 'n/a'})`);
    res.json({
      success: true,
      message: 'Metadata received and updated',
      deviceId: canonicalDeviceId
    });
  } catch (err) {
    console.error(`✗ Failed to save metadata for device ${canonicalDeviceId}:`, err.message);
    res.status(500).json({
      error: 'Failed to save metadata',
      message: err.message
    });
  }
});

// Receive mobile logs from remote devices
app.post('/api/logs/mobile', (req, res) => {
  const { deviceId, deviceType, userAgent, url, logs, extension, info } = req.body;

  if (!deviceId || !logs || !Array.isArray(logs)) {
    return res.status(400).json({ error: 'Missing deviceId or logs array' });
  }

  // Ensure logs directory exists
  const logsDir = path.join(__dirname, '..', 'backups', 'mobile-logs');
  const deviceDir = path.join(logsDir, deviceId);
  
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  if (!fs.existsSync(deviceDir)) {
    fs.mkdirSync(deviceDir, { recursive: true });
  }

  // Create filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `logs_${timestamp}.json`;
  const filepath = path.join(deviceDir, filename);

  // Prepare log data with metadata
  const logData = {
    meta: {
      deviceId,
      deviceType: deviceType || 'unknown',
      extension: extension || 'unknown',
      userAgent,
      url,
      timestamp: new Date().toISOString(),
      logCount: logs.length,
      info
    },
    logs
  };

  // Write to file
  try {
    fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
    console.log(`✓ Mobile logs saved for device ${deviceId}: ${logs.length} entries`);
    res.json({
      success: true,
      message: 'Logs received and saved',
      deviceId,
      logCount: logs.length,
      filename
    });
  } catch (err) {
    console.error(`✗ Failed to save mobile logs for device ${deviceId}:`, err.message);
    res.status(500).json({
      error: 'Failed to save logs',
      message: err.message
    });
  }
});

// Get mobile logs for a specific device
app.get('/api/logs/mobile/:deviceId', requireWireGuardAccess, (req, res) => {
  const { deviceId } = req.params;
  const logsDir = path.join(__dirname, '..', 'backups', 'mobile-logs', deviceId);

  if (!fs.existsSync(logsDir)) {
    return res.status(404).json({
      error: 'No logs found for device',
      deviceId
    });
  }

  try {
    const files = fs.readdirSync(logsDir).sort().reverse();
    const logs = files.map(file => ({
      filename: file,
      path: path.join(deviceId, file),
      timestamp: file.match(/logs_(.+)\.json/)?.[1]
    }));

    res.json({
      deviceId,
      logFiles: logs,
      count: logs.length
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to read device logs',
      message: err.message
    });
  }
});

// Get specific log file content
app.get('/api/logs/mobile/:deviceId/:filename', requireWireGuardAccess, (req, res) => {
  const { deviceId, filename } = req.params;
  
  // Sanitize filename to prevent directory traversal
  if (filename.includes('/') || filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filepath = path.join(__dirname, '..', 'backups', 'mobile-logs', deviceId, filename);

  // Ensure the file is within the allowed directory
  const realpath = fs.realpathSync(path.join(__dirname, '..', 'backups', 'mobile-logs'));
  if (!fs.realpathSync(filepath).startsWith(realpath)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Log file not found' });
  }

  try {
    const content = fs.readFileSync(filepath, 'utf8');
    res.json(JSON.parse(content));
  } catch (err) {
    res.status(500).json({
      error: 'Failed to read log file',
      message: err.message
    });
  }
});

// List mobile logs (for debugging)
app.get('/api/logs/mobile', requireWireGuardAccess, (req, res) => {
  const logsDir = path.join(__dirname, '..', 'backups', 'mobile-logs');
  const metadataDir = path.join(logsDir, 'metadata');

  if (!fs.existsSync(logsDir)) {
    return res.json({
      total: 0,
      devices: []
    });
  }

  try {
    const entries = fs.readdirSync(logsDir);
    const deviceMap = new Map();

    for (const entry of entries) {
      // Skip metadata directory itself
      if (entry === 'metadata') continue;

      const devicePath = path.join(logsDir, entry);
      const stat = fs.statSync(devicePath);
      
      if (!stat.isDirectory()) continue;

      const files = fs.readdirSync(devicePath).sort().reverse();
      const latestFile = files[0];
      
      // Load metadata from metadata directory
      let metadata = null;
      const metadataFile = path.join(metadataDir, `${entry}.json`);
      if (fs.existsSync(metadataFile)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        } catch (e) {
          // Ignore parse errors
        }
      }

      deviceMap.set(entry, {
        deviceId: entry,
        logFileCount: files.length,
        latestLogFile: latestFile,
        metadata
      });
    }

    // Include metadata-only devices (devices that never enabled debug logs yet)
    if (fs.existsSync(metadataDir)) {
      const metadataFiles = fs.readdirSync(metadataDir).filter((name) => name.endsWith('.json'));
      for (const fileName of metadataFiles) {
        const deviceId = fileName.replace(/\.json$/, '');
        if (deviceMap.has(deviceId)) continue;

        let metadata = null;
        try {
          metadata = JSON.parse(fs.readFileSync(path.join(metadataDir, fileName), 'utf8'));
        } catch (e) {
          // Ignore bad metadata file
        }

        deviceMap.set(deviceId, {
          deviceId,
          logFileCount: 0,
          latestLogFile: null,
          metadata
        });
      }
    }

    const deviceList = Array.from(deviceMap.values());

    // Sort by last seen (most recent first)
    deviceList.sort((a, b) => {
      const aLastSeen = a.metadata?.lastSeen || '';
      const bLastSeen = b.metadata?.lastSeen || '';
      return bLastSeen.localeCompare(aLastSeen);
    });

    res.json({
      total: deviceList.length,
      devices: deviceList
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to read mobile logs',
      message: err.message
    });
  }
});

// Update device comment (for admin identification)
app.patch('/api/logs/mobile/:deviceId/comment', requireWireGuardAccess, (req, res) => {
  const { deviceId } = req.params;
  const { comment } = req.body;

  if (comment === undefined) {
    return res.status(400).json({ error: 'Missing comment field' });
  }

  const metadataDir = path.join(__dirname, '..', 'backups', 'mobile-logs', 'metadata');
  const metadataFile = path.join(metadataDir, `${deviceId}.json`);

  if (!fs.existsSync(metadataFile)) {
    return res.status(404).json({
      error: 'Device not found',
      deviceId
    });
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    metadata.comment = comment;
    metadata.commentUpdated = new Date().toISOString();
    
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    
    console.log(`✓ Comment updated for device ${deviceId}`);
    res.json({
      success: true,
      message: 'Comment updated',
      deviceId,
      comment
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to update comment',
      message: err.message
    });
  }
});


app.get('/api/push/subscriptions', (req, res) => {
  const list = [];
  subscriptions.forEach((subs, extension) => {
    list.push({
      extension,
      devices: subs.length,
      lastUpdate: Math.max(...subs.map(s => s.timestamp))
    });
  });
  
  res.json({
    total: subscriptions.size,
    subscriptions: list
  });
});

// Clear all subscriptions (for testing)
app.post('/api/push/clear-all', (req, res) => {
  const count = subscriptions.size;
  subscriptions.clear();
  console.log(`✓ Cleared all ${count} subscriptions`);
  res.json({
    success: true,
    message: `Cleared ${count} subscriptions`
  });
});

// Serve debug dashboard
app.get('/dashboard', requireWireGuardAccess, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// One-time dedupe pass at startup to clean historical duplicate device records.
dedupeMetadataStore();

// Start server
app.listen(PORT, LISTEN_HOST, () => {
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  WebRTC Push Notification Server');
  console.log('════════════════════════════════════════');
  console.log(`  Host: ${LISTEN_HOST}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  VAPID: ${process.env.VAPID_PUBLIC_KEY ? '✓ Configured' : '✗ Not configured'}`);
  console.log('════════════════════════════════════════');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
