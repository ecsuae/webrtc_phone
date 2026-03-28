'use strict';

/**
 * callLogStore.js
 *
 * In-memory ring buffer for call/media diagnostic events received from browser clients
 * via POST /api/logs/call.
 *
 * Design:
 * - Single global store (module singleton)
 * - Capped at MAX_EVENTS — oldest entries dropped when full
 * - Each event carries: ts, type, aor, callId, dir, lteMode, candidate counts, msg
 * - Filtering helpers for admin page queries
 *
 * This is intentionally in-memory only:
 * - Events are transient diagnostics, not persistent audit records
 * - No disk I/O — zero impact on call flow
 * - Store survives container restarts only if the process is long-running
 */

const MAX_EVENTS = 500;

// Ring buffer: array of event objects, newest appended.
// Trimmed to MAX_EVENTS when pushing.
let _events = [];

// Monotonic sequence number for stable sort
let _seq = 0;

/**
 * Accept an array of raw event objects from the browser POST payload.
 * Each event should already have a `ts` field (ISO timestamp from browser).
 * We add `_seq` and `_serverTs` for server-side ordering.
 *
 * Input events are validated minimally — we only accept objects with a string `type`.
 * Malformed entries are silently discarded to prevent log-flooding from scan traffic.
 */
function ingestEvents(rawEvents, sourceIp) {
  if (!Array.isArray(rawEvents)) return 0;
  let accepted = 0;
  for (const ev of rawEvents) {
    if (!ev || typeof ev !== 'object') continue;
    if (typeof ev.type !== 'string' || !ev.type.trim()) continue;

    // Sanitize: keep only expected scalar fields, drop anything unexpected
    const sanitized = {
      _seq: ++_seq,
      _serverTs: new Date().toISOString(),
      _sourceIp: sourceIp || null,
      ts: typeof ev.ts === 'string' ? ev.ts : new Date().toISOString(),
      type: String(ev.type).trim().slice(0, 64),
      code: typeof ev.code === 'string' ? ev.code.slice(0, 32) : undefined,
      aor: typeof ev.aor === 'string' ? ev.aor.slice(0, 128) : undefined,
      callId: typeof ev.callId === 'string' ? ev.callId.slice(0, 128) : undefined,
      dir: typeof ev.dir === 'string' ? ev.dir.slice(0, 16) : undefined,
      lteMode: typeof ev.lteMode === 'boolean' ? ev.lteMode : undefined,
      relay: typeof ev.relay === 'number' ? ev.relay : undefined,
      host: typeof ev.host === 'number' ? ev.host : undefined,
      srflx: typeof ev.srflx === 'number' ? ev.srflx : undefined,
      total: typeof ev.total === 'number' ? ev.total : undefined,
      timedOut: typeof ev.timedOut === 'boolean' ? ev.timedOut : undefined,
      icePolicy: typeof ev.icePolicy === 'string' ? ev.icePolicy.slice(0, 32) : undefined,
      msg: typeof ev.msg === 'string' ? ev.msg.slice(0, 256) : undefined,
    };

    // Remove undefined fields
    for (const key of Object.keys(sanitized)) {
      if (sanitized[key] === undefined) delete sanitized[key];
    }

    _events.push(sanitized);
    accepted++;
  }

  // Trim to cap — keep newest
  if (_events.length > MAX_EVENTS) {
    _events = _events.slice(_events.length - MAX_EVENTS);
  }

  return accepted;
}

/**
 * Return events matching optional filter criteria.
 * All filters are substring/exact matches; case-insensitive for string fields.
 *
 * @param {object} filter
 * @param {string}  [filter.aor]      - substring match on event.aor
 * @param {string}  [filter.callId]   - substring match on event.callId
 * @param {string}  [filter.type]     - exact or substring match on event.type
 * @param {boolean} [filter.lteOnly]  - if true, only events where lteMode === true
 * @param {boolean} [filter.errorsOnly] - if true, only events where code starts with "MEDIA-E"
 * @param {number}  [filter.limit]    - max results (default 200)
 * @returns {object[]} newest-first
 */
function queryEvents(filter = {}) {
  const limit = Math.min(filter.limit || 200, MAX_EVENTS);
  const aorLower = filter.aor ? String(filter.aor).toLowerCase() : null;
  const callIdLower = filter.callId ? String(filter.callId).toLowerCase() : null;
  const typeLower = filter.type ? String(filter.type).toLowerCase() : null;

  const matches = _events.filter((ev) => {
    if (aorLower && !(ev.aor || '').toLowerCase().includes(aorLower)) return false;
    if (callIdLower && !(ev.callId || '').toLowerCase().includes(callIdLower)) return false;
    if (typeLower && !(ev.type || '').toLowerCase().includes(typeLower)) return false;
    if (filter.lteOnly && ev.lteMode !== true) return false;
    if (filter.errorsOnly && !(ev.code || '').startsWith('MEDIA-E')) return false;
    return true;
  });

  // Return newest-first, capped at limit
  return matches.slice(-limit).reverse();
}

function getStats() {
  const total = _events.length;
  const errors = _events.filter((e) => (e.code || '').startsWith('MEDIA-E')).length;
  const lte = _events.filter((e) => e.lteMode === true).length;
  const oldest = _events[0]?._serverTs || null;
  const newest = _events[_events.length - 1]?._serverTs || null;
  return { total, errors, lte, oldest, newest, capacity: MAX_EVENTS };
}

function clearAll() {
  _events = [];
  _seq = 0;
}

module.exports = { ingestEvents, queryEvents, getStats, clearAll };
