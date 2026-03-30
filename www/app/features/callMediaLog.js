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
const MAX_QUEUE = 200;

const LS_KEY = 'webrtc_call_media_log_queue_v1';
const MAX_PERSIST = 200;
const FLUSH_BATCH = 5;
const FLUSH_RETRY_MS = 2500;
const GAP_AGE_MS = 12000;
const GAP_QUEUE_LEN = 25;

let _queue = [];
let _sending = false;
let _pendingPostFailure = null;
let _loaded = false;
let _lastCtx = {};
let _lastBufferedDiagAt = 0;
let _postAttemptSeq = 0;

function _sourceBuildId() {
  try {
    return window?.CALL_MEDIA_SOURCE_BUILD_ID || undefined;
  } catch {
    return undefined;
  }
}

function _probeBuildId() {
  try {
    return window?.OUTBOUND_CALLER_PROBE_BUILD_ID || localStorage.getItem('OUTBOUND_CALLER_PROBE_BUILD_ID') || undefined;
  } catch {
    return undefined;
  }
}

function _safeNowIso() {
  try { return new Date().toISOString(); } catch { return undefined; }
}

function _loadPersistedQueue() {
  if (_loaded) return;
  _loaded = true;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    _queue = parsed.slice(-MAX_PERSIST);
  } catch {
    // ignore
  }
}

function _persistQueue() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(_queue.slice(-MAX_PERSIST)));
  } catch {
    // ignore
  }
}

function _isDiagType(t) {
  return t === 'call-log-post-buffered'
    || t === 'call-log-post-flush-ok'
    || t === 'call-log-post-flush-failed'
    || t === 'outbound-event-delivery-gap';
}

function _maybeEmitDeliveryGap(base) {
  try {
    if (!_queue.length) return;
    const oldestTs = _queue[0]?.ts;
    const oldestAge = oldestTs ? (Date.now() - Date.parse(oldestTs)) : null;
    if ((_queue.length >= GAP_QUEUE_LEN) || (typeof oldestAge === 'number' && oldestAge > GAP_AGE_MS)) {
      const ctx = { ..._lastCtx, ...base };
      const ev = {
        ts: _safeNowIso(),
        type: 'outbound-event-delivery-gap',
        ...ctx,
        probeBuildId: ctx?.probeBuildId || _probeBuildId(),
        queuedCount: _queue.length,
        oldestQueuedAgeMs: typeof oldestAge === 'number' && Number.isFinite(oldestAge) ? oldestAge : undefined,
        msg: 'Call log delivery gap: events are buffered and not flushing',
      };
      _queue.push(ev);
      if (_queue.length > MAX_PERSIST) _queue = _queue.slice(-MAX_PERSIST);
      _persistQueue();
    }
  } catch {
    // ignore
  }
}

export function sendCallMediaEvent(event) {
  _loadPersistedQueue();
  const base = { ts: _safeNowIso() || new Date().toISOString(), probeBuildId: _probeBuildId(), sourceBuildId: _sourceBuildId(), ...event };

  try {
    if (!_isDiagType(base.type)) {
      _lastCtx = {
        username: base.username,
        domain: base.domain,
        aor: base.aor,
        dir: base.dir,
        selectedProfile: base.selectedProfile,
        peer: base.peer,
        callId: base.callId,
        probeBuildId: base.probeBuildId,
      };
    }
  } catch {
    // ignore
  }

  _queue.push(base);
  if (_queue.length > MAX_PERSIST) _queue = _queue.slice(-MAX_PERSIST);

  // Emit a buffered diagnostic (but never recursively for diagnostics themselves)
  try {
    if (!_isDiagType(base.type)) {
      const now = Date.now();
      // Throttle to avoid flooding the queue (which can otherwise evict real events).
      if (now - _lastBufferedDiagAt < 1500) {
        // skip
      } else {
        _lastBufferedDiagAt = now;
        const ctx = { ..._lastCtx, ...base };
        _queue.push({
          ts: _safeNowIso() || new Date().toISOString(),
          type: 'call-log-post-buffered',
          probeBuildId: ctx.probeBuildId,
          username: ctx.username,
          domain: ctx.domain,
          aor: ctx.aor,
          dir: ctx.dir,
          selectedProfile: ctx.selectedProfile,
          peer: ctx.peer,
          callId: ctx.callId,
          queuedCount: _queue.length,
          msg: 'Call log event buffered',
        });
        if (_queue.length > MAX_PERSIST) _queue = _queue.slice(-MAX_PERSIST);
      }
    }
  } catch {
    // ignore
  }

  // Keep legacy cap in memory too
  if (_queue.length > MAX_QUEUE) _queue = _queue.slice(-Math.max(MAX_QUEUE, 10));
  _persistQueue();
  _maybeEmitDeliveryGap({
    username: base.username,
    domain: base.domain,
    aor: base.aor,
    dir: base.dir,
    selectedProfile: base.selectedProfile,
    peer: base.peer,
    callId: base.callId,
    probeBuildId: base.probeBuildId,
  });
  _flushQueue();
 }

async function _flushQueue() {
  _loadPersistedQueue();
  if (_sending || _queue.length === 0) return;
  _sending = true;
  const batch = _queue.slice(0, FLUSH_BATCH);
  try {
    const postAttemptId = `${Date.now()}-${++_postAttemptSeq}`;
    const postUrl = CALL_LOG_URL;

    const outgoingBase = (() => {
      if (!_pendingPostFailure) return batch;
      const failureEv = {
        ts: _safeNowIso() || new Date().toISOString(),
        type: 'call-log-post-failed',
        ..._pendingPostFailure,
        msg: 'Previous call log POST failed',
      };
      _pendingPostFailure = null;
      return [failureEv, ...batch].slice(0, FLUSH_BATCH);
    })();

    const outgoing = outgoingBase.map((ev) => ({
      ...ev,
      sourceBuildId: ev.sourceBuildId || _sourceBuildId(),
      postAttemptId,
      postBatchSize: outgoingBase.length,
      postUrl,
    }));

    const resp = await fetch(CALL_LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: outgoing }),
      // Short timeout — don't block anything
      signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
    });
    if (!resp?.ok) {
      let respText = '';
      try {
        respText = await resp.text();
      } catch {
        respText = '';
      }
      _pendingPostFailure = {
        postOk: false,
        postStatus: resp?.status,
        postStatusText: resp?.statusText,
        postError: respText ? String(respText).slice(0, 160) : undefined,
        postAttemptId,
        postBatchSize: outgoing.length,
        postUrl,
      };
      try {
        const ctx = { ..._lastCtx };
        _queue.push({
          ts: _safeNowIso() || new Date().toISOString(),
          type: 'call-log-post-flush-failed',
          probeBuildId: ctx.probeBuildId,
          sourceBuildId: ctx.sourceBuildId || _sourceBuildId(),
          username: ctx.username,
          domain: ctx.domain,
          aor: ctx.aor,
          dir: ctx.dir,
          selectedProfile: ctx.selectedProfile,
          peer: ctx.peer,
          callId: ctx.callId,
          postOk: false,
          postStatus: resp?.status,
          postStatusText: resp?.statusText,
          postError: respText ? String(respText).slice(0, 160) : undefined,
          postAttemptId,
          postBatchSize: outgoing.length,
          postUrl,
          queuedCount: _queue.length,
          msg: 'Call log POST failed',
        });
      } catch {}
      _persistQueue();
      setTimeout(() => { try { _flushQueue(); } catch {} }, FLUSH_RETRY_MS);
      return;
    }

    // Success: remove the batch we actually attempted (not the failureEv)
    _queue = _queue.slice(batch.length);
    try {
      const ctx = { ..._lastCtx };
      _queue.unshift({
        ts: _safeNowIso() || new Date().toISOString(),
        type: 'call-log-post-flush-ok',
        probeBuildId: ctx.probeBuildId,
        sourceBuildId: ctx.sourceBuildId || _sourceBuildId(),
        username: ctx.username,
        domain: ctx.domain,
        aor: ctx.aor,
        dir: ctx.dir,
        selectedProfile: ctx.selectedProfile,
        peer: ctx.peer,
        callId: ctx.callId,
        postOk: true,
        postStatus: resp?.status,
        postStatusText: resp?.statusText,
        postAttemptId,
        postBatchSize: outgoing.length,
        postUrl,
        flushedCount: batch.length,
        queuedCount: _queue.length,
        msg: 'Call log POST ok',
      });
    } catch {}
    _persistQueue();
  } catch {
    // Silently discard — call flow must never be affected
    const postAttemptId = `${Date.now()}-${++_postAttemptSeq}`;
    let errMsg = 'fetch-failed';
    try {
      // eslint-disable-next-line no-undef
      errMsg = String(arguments?.[0]?.message || arguments?.[0] || 'fetch-failed').slice(0, 160);
    } catch {}
    _pendingPostFailure = {
      postOk: false,
      postError: errMsg,
      postAttemptId,
      postBatchSize: batch.length,
      postUrl: CALL_LOG_URL,
    };
    try {
      const ctx = { ..._lastCtx };
      _queue.push({
        ts: _safeNowIso() || new Date().toISOString(),
        type: 'call-log-post-flush-failed',
        probeBuildId: ctx.probeBuildId,
        sourceBuildId: ctx.sourceBuildId || _sourceBuildId(),
        username: ctx.username,
        domain: ctx.domain,
        aor: ctx.aor,
        dir: ctx.dir,
        selectedProfile: ctx.selectedProfile,
        peer: ctx.peer,
        callId: ctx.callId,
        postOk: false,
        postError: errMsg,
        postAttemptId,
        postBatchSize: batch.length,
        postUrl: CALL_LOG_URL,
        queuedCount: _queue.length,
        msg: 'Call log POST failed (fetch)',
      });
    } catch {}
    _persistQueue();
    setTimeout(() => { try { _flushQueue(); } catch {} }, FLUSH_RETRY_MS);
    return;
  } finally {
    _sending = false;
    if (_queue.length > 0) _flushQueue();
  }
}
