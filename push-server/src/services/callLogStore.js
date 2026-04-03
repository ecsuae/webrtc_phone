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

const MAX_EVENTS = 5000;

// Ring buffer: array of event objects, newest appended.
// Trimmed to MAX_EVENTS when pushing.
let _events = [];

// Monotonic sequence number for stable sort
let _seq = 0;

function normalizeAorParts(username, domain) {
  const u = (username || '').trim();
  const d = (domain || '').trim();
  if (!u || !d) return null;
  return { username: u, domain: d, aor: `${u}@${d}` };
}

function normalizeAorString(aor) {
  const v = (aor || '').trim();
  if (!v) return null;
  const parts = v.split('@').filter(Boolean);
  if (parts.length < 2) return null;

  const username = parts[0];
  let domain = parts.slice(1).join('@');

  const domainParts = domain.split('@').filter(Boolean);
  if (domainParts.length >= 2) {
    const last = domainParts[domainParts.length - 1];
    const prev = domainParts[domainParts.length - 2];
    if (last && prev && last === prev) {
      domain = last;
    }
  }

  return normalizeAorParts(username, domain);
}

function normalizeIdentityFields(sanitized) {
  const fromAor = normalizeAorString(sanitized.aor);
  const fromParts = normalizeAorParts(sanitized.username, sanitized.domain);
  const picked = fromAor || fromParts;
  if (picked) {
    sanitized.username = picked.username;
    sanitized.domain = picked.domain;
    sanitized.aor = picked.aor;
  }

  const peerFromPeerAor = normalizeAorString(sanitized.peerAor);
  if (peerFromPeerAor) {
    sanitized.peerAor = peerFromPeerAor.aor;
    if (!sanitized.peerDomain) sanitized.peerDomain = peerFromPeerAor.domain;
    if (!sanitized.peer) sanitized.peer = peerFromPeerAor.aor;
  }
}

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
      // Identity
      username: typeof ev.username === 'string' ? ev.username.slice(0, 64) : undefined,
      domain: typeof ev.domain === 'string' ? ev.domain.slice(0, 128) : undefined,
      aor: typeof ev.aor === 'string' ? ev.aor.slice(0, 128) : undefined,
      callId: typeof ev.callId === 'string' ? ev.callId.slice(0, 128) : undefined,
      corrId: typeof ev.corrId === 'string' ? ev.corrId.slice(0, 128) : undefined,
      sessionId: typeof ev.sessionId === 'string' ? ev.sessionId.slice(0, 128) : undefined,
      dir: typeof ev.dir === 'string' ? ev.dir.slice(0, 16) : undefined,
      lteMode: typeof ev.lteMode === 'boolean' ? ev.lteMode : undefined,
      mode: typeof ev.mode === 'string' ? ev.mode.slice(0, 16) : undefined,
      selectedProfile: typeof ev.selectedProfile === 'string' ? ev.selectedProfile.slice(0, 16) : undefined,

      // Peer/target
      peer: typeof ev.peer === 'string' ? ev.peer.slice(0, 128) : undefined,
      peerDomain: typeof ev.peerDomain === 'string' ? ev.peerDomain.slice(0, 128) : undefined,
      peerAor: typeof ev.peerAor === 'string' ? ev.peerAor.slice(0, 256) : undefined,

      // ICE / media summaries
      relay: typeof ev.relay === 'number' ? ev.relay : undefined,
      host: typeof ev.host === 'number' ? ev.host : undefined,
      srflx: typeof ev.srflx === 'number' ? ev.srflx : undefined,
      total: typeof ev.total === 'number' ? ev.total : undefined,
      timedOut: typeof ev.timedOut === 'boolean' ? ev.timedOut : undefined,
      icePolicy: typeof ev.icePolicy === 'string' ? ev.icePolicy.slice(0, 32) : undefined,
      candSummary: typeof ev.candSummary === 'string' ? ev.candSummary.slice(0, 256) : undefined,
      selectedPair: typeof ev.selectedPair === 'string' ? ev.selectedPair.slice(0, 256) : undefined,

      // Detailed ICE / transport diagnostics
      localCandidateType: typeof ev.localCandidateType === 'string' ? ev.localCandidateType.slice(0, 32) : undefined,
      remoteCandidateType: typeof ev.remoteCandidateType === 'string' ? ev.remoteCandidateType.slice(0, 32) : undefined,
      nominated: typeof ev.nominated === 'boolean' ? ev.nominated : undefined,
      currentRoundTripTime: typeof ev.currentRoundTripTime === 'number' ? ev.currentRoundTripTime : undefined,
      dtlsState: typeof ev.dtlsState === 'string' ? ev.dtlsState.slice(0, 32) : undefined,

      // ICE candidate error details (RTCPeerConnection icecandidateerror)
      errorCode: typeof ev.errorCode === 'number' ? ev.errorCode : undefined,
      errorText: typeof ev.errorText === 'string' ? ev.errorText.slice(0, 256) : undefined,
      url: typeof ev.url === 'string' ? ev.url.slice(0, 256) : undefined,
      address: typeof ev.address === 'string' ? ev.address.slice(0, 128) : undefined,
      port: typeof ev.port === 'number' ? ev.port : undefined,
      hostCandidate: typeof ev.hostCandidate === 'string' ? ev.hostCandidate.slice(0, 256) : undefined,

      // Media flags
      hasLocalStream: typeof ev.hasLocalStream === 'boolean' ? ev.hasLocalStream : undefined,
      hasRemoteStream: typeof ev.hasRemoteStream === 'boolean' ? ev.hasRemoteStream : undefined,
      remoteAudioTrackCount: typeof ev.remoteAudioTrackCount === 'number' ? ev.remoteAudioTrackCount : undefined,
      remoteAudioAttached: typeof ev.remoteAudioAttached === 'boolean' ? ev.remoteAudioAttached : undefined,
      audioPlayOk: typeof ev.audioPlayOk === 'boolean' ? ev.audioPlayOk : undefined,
      audioPlayError: typeof ev.audioPlayError === 'string' ? ev.audioPlayError.slice(0, 256) : undefined,

      // Track/audio-element health
      trackId: typeof ev.trackId === 'string' ? ev.trackId.slice(0, 128) : undefined,
      trackMuted: typeof ev.trackMuted === 'boolean' ? ev.trackMuted : undefined,
      trackEnabled: typeof ev.trackEnabled === 'boolean' ? ev.trackEnabled : undefined,
      trackReadyState: typeof ev.trackReadyState === 'string' ? ev.trackReadyState.slice(0, 32) : undefined,
      audioElMuted: typeof ev.audioElMuted === 'boolean' ? ev.audioElMuted : undefined,
      audioElVolume: typeof ev.audioElVolume === 'number' ? ev.audioElVolume : undefined,
      audioElReadyState: typeof ev.audioElReadyState === 'number' ? ev.audioElReadyState : undefined,
      audioElPaused: typeof ev.audioElPaused === 'boolean' ? ev.audioElPaused : undefined,
      audioElCurrentTime: typeof ev.audioElCurrentTime === 'number' ? ev.audioElCurrentTime : undefined,

      // Post-establish receive health fields (LTE receive-leg observability)
      packetsReceived: typeof ev.packetsReceived === 'number' ? ev.packetsReceived : undefined,
      bytesReceived: typeof ev.bytesReceived === 'number' ? ev.bytesReceived : undefined,
      packetsSent: typeof ev.packetsSent === 'number' ? ev.packetsSent : undefined,
      bytesSent: typeof ev.bytesSent === 'number' ? ev.bytesSent : undefined,
      remoteAudioTracks: typeof ev.remoteAudioTracks === 'number' ? ev.remoteAudioTracks : undefined,
      remoteAudioElementPaused: typeof ev.remoteAudioElementPaused === 'boolean' ? ev.remoteAudioElementPaused : undefined,
      remoteAudioElementMuted: typeof ev.remoteAudioElementMuted === 'boolean' ? ev.remoteAudioElementMuted : undefined,
      remoteAudioElementVolume: typeof ev.remoteAudioElementVolume === 'number' ? ev.remoteAudioElementVolume : undefined,

      connectionState: typeof ev.connectionState === 'string' ? ev.connectionState.slice(0, 32) : undefined,
      iceConnectionState: typeof ev.iceConnectionState === 'string' ? ev.iceConnectionState.slice(0, 32) : undefined,

      // Media stats snapshot fields (one-way audio diagnosis)
      inboundAudioPacketsReceived: typeof ev.inboundAudioPacketsReceived === 'number' ? ev.inboundAudioPacketsReceived : undefined,
      inboundAudioBytesReceived: typeof ev.inboundAudioBytesReceived === 'number' ? ev.inboundAudioBytesReceived : undefined,
      inboundAudioPacketsLost: typeof ev.inboundAudioPacketsLost === 'number' ? ev.inboundAudioPacketsLost : undefined,
      inboundAudioJitter: typeof ev.inboundAudioJitter === 'number' ? ev.inboundAudioJitter : undefined,
      outboundAudioPacketsSent: typeof ev.outboundAudioPacketsSent === 'number' ? ev.outboundAudioPacketsSent : undefined,
      outboundAudioBytesSent: typeof ev.outboundAudioBytesSent === 'number' ? ev.outboundAudioBytesSent : undefined,

      // Group B: codec/decode/energy RCA fields (whitelist only; no summary changes)
      audioLevel: typeof ev.audioLevel === 'number' ? ev.audioLevel : undefined,
      totalAudioEnergy: typeof ev.totalAudioEnergy === 'number' ? ev.totalAudioEnergy : undefined,
      inboundCodecMimeType: typeof ev.inboundCodecMimeType === 'string' ? ev.inboundCodecMimeType.slice(0, 128) : undefined,
      inboundCodecPayloadType: typeof ev.inboundCodecPayloadType === 'number' ? ev.inboundCodecPayloadType : undefined,
      inboundCodecClockRate: typeof ev.inboundCodecClockRate === 'number' ? ev.inboundCodecClockRate : undefined,
      inboundCodecChannels: typeof ev.inboundCodecChannels === 'number' ? ev.inboundCodecChannels : undefined,
      decoderImplementation: typeof ev.decoderImplementation === 'string' ? ev.decoderImplementation.slice(0, 128) : undefined,
      totalSamplesDecoded: typeof ev.totalSamplesDecoded === 'number' ? ev.totalSamplesDecoded : undefined,
      concealedSamples: typeof ev.concealedSamples === 'number' ? ev.concealedSamples : undefined,
      silentConcealedSamples: typeof ev.silentConcealedSamples === 'number' ? ev.silentConcealedSamples : undefined,
      packetsDiscarded: typeof ev.packetsDiscarded === 'number' ? ev.packetsDiscarded : undefined,
      packetsRepaired: typeof ev.packetsRepaired === 'number' ? ev.packetsRepaired : undefined,
      jitterBufferDelay: typeof ev.jitterBufferDelay === 'number' ? ev.jitterBufferDelay : undefined,
      jitterBufferEmittedCount: typeof ev.jitterBufferEmittedCount === 'number' ? ev.jitterBufferEmittedCount : undefined,

      // Local timestamp markers (ISO strings) for timeline correlation
      t_callStart: typeof ev.t_callStart === 'string' ? ev.t_callStart.slice(0, 32) : undefined,
      t_inviteSent: typeof ev.t_inviteSent === 'string' ? ev.t_inviteSent.slice(0, 32) : undefined,
      t_incomingReceived: typeof ev.t_incomingReceived === 'string' ? ev.t_incomingReceived.slice(0, 32) : undefined,
      t_answerClicked: typeof ev.t_answerClicked === 'string' ? ev.t_answerClicked.slice(0, 32) : undefined,
      t_established: typeof ev.t_established === 'string' ? ev.t_established.slice(0, 32) : undefined,
      t_ended: typeof ev.t_ended === 'string' ? ev.t_ended.slice(0, 32) : undefined,

      // Transport diagnostics (e.g., call-log-post-failed)
      httpStatus: typeof ev.httpStatus === 'number' ? ev.httpStatus : undefined,
      httpStatusText: typeof ev.httpStatusText === 'string' ? ev.httpStatusText.slice(0, 64) : undefined,
      fetchError: typeof ev.fetchError === 'string' ? ev.fetchError.slice(0, 128) : undefined,

      queuedCount: typeof ev.queuedCount === 'number' ? ev.queuedCount : undefined,
      flushedCount: typeof ev.flushedCount === 'number' ? ev.flushedCount : undefined,
      oldestQueuedAgeMs: typeof ev.oldestQueuedAgeMs === 'number' ? ev.oldestQueuedAgeMs : undefined,

      // Probe/build markers
      probeBuildId: typeof ev.probeBuildId === 'string' ? ev.probeBuildId.slice(0, 96) : undefined,

      // Client build marker (proves which JS build emitted events)
      sourceBuildId: typeof ev.sourceBuildId === 'string' ? ev.sourceBuildId.slice(0, 128) : undefined,

      // POST proof fields (client-side delivery diagnostics)
      postAttemptId: typeof ev.postAttemptId === 'string' ? ev.postAttemptId.slice(0, 64) : undefined,
      postBatchSize: typeof ev.postBatchSize === 'number' ? ev.postBatchSize : undefined,
      postUrl: typeof ev.postUrl === 'string' ? ev.postUrl.slice(0, 128) : undefined,
      postOk: typeof ev.postOk === 'boolean' ? ev.postOk : undefined,
      postStatus: typeof ev.postStatus === 'number' ? ev.postStatus : undefined,
      postStatusText: typeof ev.postStatusText === 'string' ? ev.postStatusText.slice(0, 64) : undefined,
      postError: typeof ev.postError === 'string' ? ev.postError.slice(0, 256) : undefined,

      msg: typeof ev.msg === 'string' ? ev.msg.slice(0, 256) : undefined,
    };

    // Remove undefined fields
    for (const key of Object.keys(sanitized)) {
      if (sanitized[key] === undefined) delete sanitized[key];
    }

    normalizeIdentityFields(sanitized);

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
  const usernameLower = filter.username ? String(filter.username).toLowerCase() : null;
  const domainLower = filter.domain ? String(filter.domain).toLowerCase() : null;
  const callerLower = filter.caller ? String(filter.caller).toLowerCase() : null;
  const receiverLower = filter.receiver ? String(filter.receiver).toLowerCase() : null;
  const callIdLower = filter.callId ? String(filter.callId).toLowerCase() : null;
  const corrIdLower = filter.corrId ? String(filter.corrId).toLowerCase() : null;
  const typeLower = filter.type ? String(filter.type).toLowerCase() : null;
  const dirLower = filter.dir ? String(filter.dir).toLowerCase() : null;
  const modeLower = filter.mode ? String(filter.mode).toLowerCase() : null;
  const profileLower = filter.profile ? String(filter.profile).toLowerCase() : null;

  const corrKey = (ev) => (ev && (ev.corrId || ev.callId)) || '';
  const normUserKey = (s) => {
    const v = String(s || '').trim().toLowerCase();
    return v;
  };
  const localUserKeyFromEvent = (ev) => {
    const u = normUserKey(ev && ev.username);
    if (u) return u;
    const aor = normUserKey(ev && ev.aor);
    if (!aor) return '';
    return String(aor).split('@')[0] || '';
  };
  const peerUserKeyFromEvent = (ev) => {
    const p = normUserKey(ev && ev.peer);
    if (p) return String(p).split('@')[0] || '';
    const pa = normUserKey(ev && ev.peerAor);
    if (!pa) return '';
    return String(pa).split('@')[0] || '';
  };
  const identityKeysFromEvent = (ev) => {
    const out = [];
    const a = localUserKeyFromEvent(ev);
    const b = peerUserKeyFromEvent(ev);
    if (a) out.push(a);
    if (b) out.push(b);
    return out;
  };

  const allowedCorrKeys = (() => {
    if (!callerLower && !receiverLower) return null;
    const byKey = new Map();
    for (const ev of _events) {
      const k = corrKey(ev);
      if (!k) continue;
      let g = byKey.get(k);
      if (!g) {
        g = new Set();
        byKey.set(k, g);
      }
      for (const u of identityKeysFromEvent(ev)) {
        const ul = normUserKey(u);
        if (ul) g.add(ul);
      }
    }

    const allowed = new Set();
    for (const [k, users] of byKey.entries()) {
      const hasCaller = callerLower ? Array.from(users).some((u) => u.includes(callerLower)) : true;
      const hasReceiver = receiverLower ? Array.from(users).some((u) => u.includes(receiverLower)) : true;
      if (hasCaller && hasReceiver) allowed.add(k);
    }
    return allowed;
  })();

  const matches = _events.filter((ev) => {
    if (allowedCorrKeys) {
      const k = corrKey(ev);
      if (!k || !allowedCorrKeys.has(k)) {
        // Group A: Keep key session CLIENT milestones even when they lack corrId/callId,
        // as long as they match the caller/receiver identity filter.
        const t = (ev && ev.type) || '';
        if (t === 'profile-selected' || t === 'ua-ice-policy') {
          const ids = identityKeysFromEvent(ev);
          const ok = ids.some((u) => {
            const ul = normUserKey(u);
            const hasCaller = callerLower ? ul.includes(callerLower) : true;
            const hasReceiver = receiverLower ? ul.includes(receiverLower) : true;
            return hasCaller && hasReceiver;
          });
          if (ok) {
            // allow through
          } else {
            return false;
          }
        } else {
          return false;
        }
      }
    }
    if (aorLower && !(ev.aor || '').toLowerCase().includes(aorLower)) return false;
    if (usernameLower) {
      const u = (ev.username || '').toLowerCase();
      const ua = ev.aor ? String(ev.aor).split('@')[0].toLowerCase() : '';
      if (!(u.includes(usernameLower) || (ua && ua.includes(usernameLower)))) return false;
    }
    if (domainLower) {
      const d = (ev.domain || '').toLowerCase();
      const da = ev.aor ? String(ev.aor).split('@').slice(1).join('@').toLowerCase() : '';
      if (!(d.includes(domainLower) || (da && da.includes(domainLower)))) return false;
    }
    if (callIdLower && !(ev.callId || '').toLowerCase().includes(callIdLower)) return false;
    if (corrIdLower && !(ev.corrId || '').toLowerCase().includes(corrIdLower)) return false;
    if (typeLower && !(ev.type || '').toLowerCase().includes(typeLower)) return false;
    if (dirLower && !(ev.dir || '').toLowerCase().includes(dirLower)) return false;
    if (modeLower && !((ev.mode || (ev.lteMode === true ? 'lte' : (ev.lteMode === false ? 'wifi' : ''))).toLowerCase().includes(modeLower))) return false;
    if (profileLower && !((ev.selectedProfile || ev.mode || (ev.lteMode === true ? 'lte' : (ev.lteMode === false ? 'wifi' : ''))).toLowerCase().includes(profileLower))) return false;
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
