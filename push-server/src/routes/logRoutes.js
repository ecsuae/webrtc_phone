const express = require('express');
const fs = require('fs');
const path = require('path');
const { LOGS_BASE_DIR, ensureMetadataDir } = require('../services/metadata/core');
const { updateMetadata } = require('../services/metadata/metadataUpdate');

function createLogRoutes({ requireWireGuardAccess }) {
  const router = express.Router();

  function safeReadJson(filepath) {
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch {
      return null;
    }
  }

  function safeWriteJson(filepath, data) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  }

  function sanitizeIdentityPayload(payload) {
    const clean = { ...(payload || {}) };
    if (typeof clean.deviceId !== 'string' || !clean.deviceId.trim()) {
      delete clean.deviceId;
    } else {
      clean.deviceId = clean.deviceId.trim();
    }
    if (typeof clean.browserId !== 'string' || !clean.browserId.trim()) {
      delete clean.browserId;
    } else {
      clean.browserId = clean.browserId.trim();
    }
    if (typeof clean.deviceFingerprint !== 'string' || !clean.deviceFingerprint.trim()) {
      delete clean.deviceFingerprint;
    } else {
      clean.deviceFingerprint = clean.deviceFingerprint.trim();
    }
    return clean;
  }

  router.post('/mobile/metadata', (req, res) => {
    const payload = sanitizeIdentityPayload(req.body || {});
    if (!payload.deviceId && !payload.deviceFingerprint && !payload.browserId) {
      return res.status(400).json({ error: 'Missing identity fields (deviceId/deviceFingerprint/browserId)' });
    }
    try {
      const { canonicalDeviceId } = updateMetadata(payload);
      console.log(`✓ Metadata updated for device ${canonicalDeviceId} (user: ${payload.currentUsername || 'n/a'})`);
      return res.json({ success: true, message: 'Metadata received and updated', deviceId: canonicalDeviceId });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save metadata', message: err.message });
    }
  });

  router.post('/mobile', (req, res) => {
    const cleanBody = sanitizeIdentityPayload(req.body || {});
    const { deviceId, deviceType, userAgent, url, logs, extension, info, batchId, debugMode } = cleanBody;
    if (!deviceId || !Array.isArray(logs)) return res.status(400).json({ error: 'Missing deviceId or logs array' });

    const deviceDir = path.join(LOGS_BASE_DIR, deviceId);
    if (!fs.existsSync(deviceDir)) fs.mkdirSync(deviceDir, { recursive: true });

    try {
      const nowIso = new Date().toISOString();
      const normalizedBatchId = typeof batchId === 'string' && batchId.trim() ? batchId.trim() : null;
      const shouldAggregate = Boolean(normalizedBatchId) || Boolean(debugMode);
      const effectiveBatchId = normalizedBatchId || (debugMode ? 'debug' : null);

      // If batchId is present, append into a single aggregated file for this debug session.
      // Otherwise, keep legacy behavior (one file per POST) for non-debug uploads.
      if (shouldAggregate && effectiveBatchId) {
        const safeBatch = String(effectiveBatchId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
        const filename = `batch_${safeBatch}.json`;
        const filepath = path.join(deviceDir, filename);
        const existing = fs.existsSync(filepath) ? safeReadJson(filepath) : null;

        const mergedLogs = Array.isArray(existing?.logs) ? existing.logs.concat(logs) : logs.slice();
        const meta = {
          deviceId,
          deviceType: deviceType || existing?.meta?.deviceType || 'unknown',
          extension: extension || existing?.meta?.extension || 'unknown',
          userAgent: userAgent || existing?.meta?.userAgent,
          url: url || existing?.meta?.url,
          batchId: safeBatch,
          firstTimestamp: existing?.meta?.firstTimestamp || nowIso,
          lastTimestamp: nowIso,
          logCount: mergedLogs.length,
          info: info || existing?.meta?.info,
        };

        safeWriteJson(filepath, { meta, logs: mergedLogs });
        return res.json({ success: true, message: 'Logs received and appended', deviceId, logCount: logs.length, filename, batchId: safeBatch, aggregated: true });
      }

      const timestamp = nowIso.replace(/[:.]/g, '-');
      const filename = `logs_${timestamp}.json`;
      const filepath = path.join(deviceDir, filename);
      const logData = {
        meta: {
          deviceId,
          deviceType: deviceType || 'unknown',
          extension: extension || 'unknown',
          userAgent,
          url,
          timestamp: nowIso,
          logCount: logs.length,
          info,
        },
        logs,
      };
      safeWriteJson(filepath, logData);
      return res.json({ success: true, message: 'Logs received and saved', deviceId, logCount: logs.length, filename, aggregated: false });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save logs', message: err.message });
    }
  });

  router.get('/mobile', requireWireGuardAccess, (req, res) => {
    if (!fs.existsSync(LOGS_BASE_DIR)) return res.json({ total: 0, devices: [] });

    const metadataDir = ensureMetadataDir();
    const deviceMap = new Map();
    for (const entry of fs.readdirSync(LOGS_BASE_DIR)) {
      if (entry === 'metadata') continue;
      const devicePath = path.join(LOGS_BASE_DIR, entry);
      if (!fs.statSync(devicePath).isDirectory()) continue;

      const files = fs.readdirSync(devicePath).sort().reverse();
      const metadataFile = path.join(metadataDir, `${entry}.json`);
      let metadata = null;
      if (fs.existsSync(metadataFile)) {
        try { metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8')); } catch {}
      }
      deviceMap.set(entry, { deviceId: entry, logFileCount: files.length, latestLogFile: files[0] || null, metadata });
    }

    for (const fileName of fs.readdirSync(metadataDir).filter((n) => n.endsWith('.json'))) {
      const deviceId = fileName.replace(/\.json$/, '');
      if (deviceMap.has(deviceId)) continue;
      let metadata = null;
      try { metadata = JSON.parse(fs.readFileSync(path.join(metadataDir, fileName), 'utf8')); } catch {}
      deviceMap.set(deviceId, { deviceId, logFileCount: 0, latestLogFile: null, metadata });
    }

    const devices = Array.from(deviceMap.values()).sort((a, b) => String(b.metadata?.lastSeen || '').localeCompare(String(a.metadata?.lastSeen || '')));
    return res.json({ total: devices.length, devices });
  });

  router.get('/mobile/:deviceId', requireWireGuardAccess, (req, res) => {
    const { deviceId } = req.params;
    const logsDir = path.join(LOGS_BASE_DIR, deviceId);
    if (!fs.existsSync(logsDir)) return res.status(404).json({ error: 'No logs found for device', deviceId });

    const files = fs.readdirSync(logsDir).sort().reverse();
    const logFiles = files.map((file) => ({ filename: file, path: path.join(deviceId, file), timestamp: file.match(/logs_(.+)\.json/)?.[1] }));
    return res.json({ deviceId, logFiles, count: logFiles.length });
  });

  // Convenience: fetch the most recent log file content for a device.
  router.get('/mobile/:deviceId/latest', requireWireGuardAccess, (req, res) => {
    const { deviceId } = req.params;
    const logsDir = path.join(LOGS_BASE_DIR, deviceId);
    if (!fs.existsSync(logsDir)) return res.status(404).json({ error: 'No logs found for device', deviceId });

    const files = fs.readdirSync(logsDir).sort().reverse();
    const latest = files[0];
    if (!latest) return res.status(404).json({ error: 'No log files found for device', deviceId });

    const filepath = path.join(LOGS_BASE_DIR, deviceId, latest);
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      return res.json({ deviceId, filename: latest, content: JSON.parse(content) });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to read latest log file', message: err.message });
    }
  });

  // Flush logs for a device but keep metadata (device remains visible).
  router.delete('/mobile/:deviceId/logs', requireWireGuardAccess, (req, res) => {
    const { deviceId } = req.params;
    try {
      const deviceDir = path.join(LOGS_BASE_DIR, deviceId);
      if (!fs.existsSync(deviceDir)) {
        return res.json({ success: true, message: 'No logs to flush', deviceId, deleted: 0 });
      }
      const files = fs.readdirSync(deviceDir).filter((f) => f.endsWith('.json'));
      let deleted = 0;
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(deviceDir, file));
          deleted += 1;
        } catch {}
      }
      return res.json({ success: true, message: 'Logs flushed', deviceId, deleted });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to flush logs', message: err.message });
    }
  });

  router.get('/mobile/:deviceId/:filename', requireWireGuardAccess, (req, res) => {
    const { deviceId, filename } = req.params;
    if (filename.includes('/') || filename.includes('..')) return res.status(400).json({ error: 'Invalid filename' });

    const filepath = path.join(LOGS_BASE_DIR, deviceId, filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Log file not found' });

    const realBase = fs.realpathSync(LOGS_BASE_DIR);
    const realFile = fs.realpathSync(filepath);
    if (!realFile.startsWith(realBase)) return res.status(403).json({ error: 'Access denied' });

    try {
      const content = fs.readFileSync(filepath, 'utf8');
      return res.json(JSON.parse(content));
    } catch (err) {
      return res.status(500).json({ error: 'Failed to read log file', message: err.message });
    }
  });

  router.patch('/mobile/:deviceId/comment', requireWireGuardAccess, (req, res) => {
    const { deviceId } = req.params;
    const { comment } = req.body;
    if (comment === undefined) return res.status(400).json({ error: 'Missing comment field' });

    const metadataFile = path.join(ensureMetadataDir(), `${deviceId}.json`);
    if (!fs.existsSync(metadataFile)) return res.status(404).json({ error: 'Device not found', deviceId });

    try {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
      metadata.comment = comment;
      metadata.commentUpdated = new Date().toISOString();
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
      return res.json({ success: true, message: 'Comment updated', deviceId, comment });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update comment', message: err.message });
    }
  });

  router.delete('/mobile/:deviceId', requireWireGuardAccess, (req, res) => {
    const { deviceId } = req.params;

    try {
      // Delete device logs directory
      const deviceDir = path.join(LOGS_BASE_DIR, deviceId);
      if (fs.existsSync(deviceDir)) {
        fs.rmSync(deviceDir, { recursive: true, force: true });
      }

      // Delete metadata file
      const metadataFile = path.join(ensureMetadataDir(), `${deviceId}.json`);
      if (fs.existsSync(metadataFile)) {
        fs.unlinkSync(metadataFile);
      }

      return res.json({ success: true, message: 'Device and logs deleted', deviceId });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete device', message: err.message });
    }
  });

  return router;
}

module.exports = { createLogRoutes };
