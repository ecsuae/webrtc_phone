const fs = require('fs');
const path = require('path');

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function resolvePath(mapPath) {
  return path.isAbsolute(mapPath) ? mapPath : path.join(process.cwd(), mapPath);
}

function createPinMapStore({ mapPath }) {
  const absPath = resolvePath(mapPath);
  let cached = null;
  let cachedMtimeMs = 0;

  function load() {
    if (!fs.existsSync(absPath)) return null;
    const st = fs.statSync(absPath);
    if (cached && st.mtimeMs === cachedMtimeMs) return cached;

    const raw = fs.readFileSync(absPath, 'utf8');
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    cached = parsed;
    cachedMtimeMs = st.mtimeMs;
    return cached;
  }

  function findByPinHash(pinHash) {
    const map = load();
    if (!map) return null;
    const byHash = map.pinsByHash && typeof map.pinsByHash === 'object' ? map.pinsByHash : {};
    const entry = byHash[pinHash];
    if (!entry || typeof entry !== 'object') return null;

    const conferenceExtension = String(entry.conferenceExtension || entry.extension || '').trim();
    if (!conferenceExtension) return null;

    return {
      roomName: String(entry.roomName || '').trim(),
      role: String(entry.role || 'participant').trim(),
      conferenceExtension,
    };
  }

  return {
    absPath,
    load,
    findByPinHash,
  };
}

module.exports = { createPinMapStore };
