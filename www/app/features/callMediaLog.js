/**
 * callMediaLog.js
 *
 * Sends structured call/media diagnostic events to push-server /api/logs/call.
 * Used for server-side LTE media diagnostics when browser console is not accessible.
 *
 * Rules:
 * - Never throws. Network failure is silently ignored.
 * - Does not block or delay call flow.
 * - Batches up to 5 events per POST.
 */

const CALL_LOG_URL = '/api/logs/call';
const MAX_QUEUE = 30;

let _queue = [];
let _sending = false;

export function sendCallMediaEvent(event) {
  const payload = { ts: new Date().toISOString(), ...event };
  _queue.push(payload);
  if (_queue.length > MAX_QUEUE) _queue = _queue.slice(-MAX_QUEUE);
  _flushQueue();
}

async function _flushQueue() {
  if (_sending || _queue.length === 0) return;
  _sending = true;
  const batch = _queue.splice(0, 5);
  try {
    await fetch(CALL_LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      // Short timeout — don't block anything
      signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
    });
  } catch {
    // Silently discard — call flow must never be affected
  } finally {
    _sending = false;
    if (_queue.length > 0) _flushQueue();
  }
}
