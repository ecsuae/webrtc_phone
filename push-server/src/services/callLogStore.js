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

      // Uplink track correlation (desktop one-sided voice RCA)
      localMicTrackId: typeof ev.localMicTrackId === 'string' ? ev.localMicTrackId.slice(0, 128) : undefined,
      localMicStreamId: typeof ev.localMicStreamId === 'string' ? ev.localMicStreamId.slice(0, 128) : undefined,
      localMicTrackKind: typeof ev.localMicTrackKind === 'string' ? ev.localMicTrackKind.slice(0, 16) : undefined,
      localStreamTrackCount: typeof ev.localStreamTrackCount === 'number' ? ev.localStreamTrackCount : undefined,
      localStreamTrackIds: Array.isArray(ev.localStreamTrackIds)
        ? ev.localStreamTrackIds.slice(0, 8).map((id) => (typeof id === 'string') ? id.slice(0, 128) : undefined).filter(Boolean)
        : undefined,
      localStreamTrackKinds: Array.isArray(ev.localStreamTrackKinds)
        ? ev.localStreamTrackKinds.slice(0, 8).map((k) => (typeof k === 'string') ? k.slice(0, 16) : undefined).filter(Boolean)
        : undefined,
      localStreamTrackLabels: Array.isArray(ev.localStreamTrackLabels)
        ? ev.localStreamTrackLabels.slice(0, 8).map((l) => (typeof l === 'string') ? l.slice(0, 128) : undefined).filter(Boolean)
        : undefined,
      localStreamAudioTrackId: typeof ev.localStreamAudioTrackId === 'string' ? ev.localStreamAudioTrackId.slice(0, 128) : undefined,
      localStreamAudioTrackLabel: typeof ev.localStreamAudioTrackLabel === 'string' ? ev.localStreamAudioTrackLabel.slice(0, 128) : undefined,
      localStreamAudioTrackEnabled: typeof ev.localStreamAudioTrackEnabled === 'boolean' ? ev.localStreamAudioTrackEnabled : undefined,
      localStreamAudioTrackMuted: typeof ev.localStreamAudioTrackMuted === 'boolean' ? ev.localStreamAudioTrackMuted : undefined,
      localStreamAudioTrackReadyState: typeof ev.localStreamAudioTrackReadyState === 'string' ? ev.localStreamAudioTrackReadyState.slice(0, 32) : undefined,
      senderTrackId: (ev.senderTrackId === null) ? null : (typeof ev.senderTrackId === 'string' ? ev.senderTrackId.slice(0, 128) : undefined),
      senderTrackReadyState: (ev.senderTrackReadyState === null) ? null : (typeof ev.senderTrackReadyState === 'string' ? ev.senderTrackReadyState.slice(0, 32) : undefined),
      senderStateSource: typeof ev.senderStateSource === 'string' ? ev.senderStateSource.slice(0, 64) : undefined,
      senderTrackEnabled: typeof ev.senderTrackEnabled === 'boolean' ? ev.senderTrackEnabled : undefined,
      senderTrackMuted: typeof ev.senderTrackMuted === 'boolean' ? ev.senderTrackMuted : undefined,
      senderTrackIdAfter: typeof ev.senderTrackIdAfter === 'string' ? ev.senderTrackIdAfter.slice(0, 128) : undefined,
      senderTrackReadyStateAfter: typeof ev.senderTrackReadyStateAfter === 'string' ? ev.senderTrackReadyStateAfter.slice(0, 32) : undefined,
      senderStreamIds: Array.isArray(ev.senderStreamIds)
        ? ev.senderStreamIds.slice(0, 8).map((id) => (typeof id === 'string') ? id.slice(0, 128) : undefined).filter(Boolean)
        : undefined,
      sameAsLocalMicTrack: typeof ev.sameAsLocalMicTrack === 'boolean' ? ev.sameAsLocalMicTrack : undefined,
      pcSignalingState: typeof ev.pcSignalingState === 'string' ? ev.pcSignalingState.slice(0, 32) : undefined,
      checkpoint: typeof ev.checkpoint === 'string' ? ev.checkpoint.slice(0, 64) : undefined,
      previousSenderTrackId: typeof ev.previousSenderTrackId === 'string' ? ev.previousSenderTrackId.slice(0, 128) : undefined,
      transceiverMid: typeof ev.transceiverMid === 'string' ? ev.transceiverMid.slice(0, 32) : undefined,
      senderHasTrack: typeof ev.senderHasTrack === 'boolean' ? ev.senderHasTrack : undefined,
      senderKind: typeof ev.senderKind === 'string' ? ev.senderKind.slice(0, 16) : undefined,
      transceiverDirection: typeof ev.transceiverDirection === 'string' ? ev.transceiverDirection.slice(0, 32) : undefined,
      transceiverCurrentDirection: typeof ev.transceiverCurrentDirection === 'string' ? ev.transceiverCurrentDirection.slice(0, 32) : undefined,
      audioTransceiverIndex: typeof ev.audioTransceiverIndex === 'number' ? ev.audioTransceiverIndex : undefined,
      senderTrackIsSameObjectAsLocalStreamAudioTrack: typeof ev.senderTrackIsSameObjectAsLocalStreamAudioTrack === 'boolean' ? ev.senderTrackIsSameObjectAsLocalStreamAudioTrack : undefined,
      senderTrackIdMatchesLocalStreamAudioTrackId: typeof ev.senderTrackIdMatchesLocalStreamAudioTrackId === 'boolean' ? ev.senderTrackIdMatchesLocalStreamAudioTrackId : undefined,
      stackTop: typeof ev.stackTop === 'string' ? ev.stackTop.slice(0, 256) : undefined,
      replaceTrackNullRan: typeof ev.replaceTrackNullRan === 'boolean' ? ev.replaceTrackNullRan : undefined,
      replaceTrackNullTimedOut: typeof ev.replaceTrackNullTimedOut === 'boolean' ? ev.replaceTrackNullTimedOut : undefined,
      replaceTrackNullError: typeof ev.replaceTrackNullError === 'string' ? ev.replaceTrackNullError.slice(0, 256) : undefined,
      afterStopEventEmitted: typeof ev.afterStopEventEmitted === 'boolean' ? ev.afterStopEventEmitted : undefined,
      senderTrackIdBefore: typeof ev.senderTrackIdBefore === 'string' ? ev.senderTrackIdBefore.slice(0, 128) : undefined,
      senderTrackReadyStateBefore: typeof ev.senderTrackReadyStateBefore === 'string' ? ev.senderTrackReadyStateBefore.slice(0, 32) : undefined,
      senderTrackIdAfterDetach: typeof ev.senderTrackIdAfterDetach === 'string' ? ev.senderTrackIdAfterDetach.slice(0, 128) : undefined,
      senderTrackReadyStateAfterDetach: typeof ev.senderTrackReadyStateAfterDetach === 'string' ? ev.senderTrackReadyStateAfterDetach.slice(0, 32) : undefined,
      senderHasTrackAfterDetach: typeof ev.senderHasTrackAfterDetach === 'boolean' ? ev.senderHasTrackAfterDetach : undefined,
      sameAsStoredMicTrack: typeof ev.sameAsStoredMicTrack === 'boolean' ? ev.sameAsStoredMicTrack : undefined,
      storedMicTrackId: typeof ev.storedMicTrackId === 'string' ? ev.storedMicTrackId.slice(0, 128) : undefined,
      storedMicTrackReadyStateBefore: typeof ev.storedMicTrackReadyStateBefore === 'string' ? ev.storedMicTrackReadyStateBefore.slice(0, 32) : undefined,
      storedMicTrackReadyStateAfter: typeof ev.storedMicTrackReadyStateAfter === 'string' ? ev.storedMicTrackReadyStateAfter.slice(0, 32) : undefined,
      storedLocalStreamTrackIdsBefore: Array.isArray(ev.storedLocalStreamTrackIdsBefore)
        ? ev.storedLocalStreamTrackIdsBefore.slice(0, 8).map((id) => (typeof id === 'string') ? id.slice(0, 128) : undefined).filter(Boolean)
        : undefined,
      storedLocalStreamTrackIdsAfter: Array.isArray(ev.storedLocalStreamTrackIdsAfter)
        ? ev.storedLocalStreamTrackIdsAfter.slice(0, 8).map((id) => (typeof id === 'string') ? id.slice(0, 128) : undefined).filter(Boolean)
        : undefined,

      outboundRtpMid: typeof ev.outboundRtpMid === 'string' ? ev.outboundRtpMid.slice(0, 32) : undefined,
      outboundRtpSsrc: typeof ev.outboundRtpSsrc === 'number' ? ev.outboundRtpSsrc : undefined,
      outboundRtpPacketsSent: typeof ev.outboundRtpPacketsSent === 'number' ? ev.outboundRtpPacketsSent : undefined,
      outboundRtpBytesSent: typeof ev.outboundRtpBytesSent === 'number' ? ev.outboundRtpBytesSent : undefined,
      outboundRtpAudioLevel: typeof ev.outboundRtpAudioLevel === 'number' ? ev.outboundRtpAudioLevel : undefined,
      outboundRtpTotalAudioEnergy: typeof ev.outboundRtpTotalAudioEnergy === 'number' ? ev.outboundRtpTotalAudioEnergy : undefined,
      outboundRtpTrackIdentifier: typeof ev.outboundRtpTrackIdentifier === 'string' ? ev.outboundRtpTrackIdentifier.slice(0, 256) : undefined,
      outboundRtpCodecId: typeof ev.outboundRtpCodecId === 'string' ? ev.outboundRtpCodecId.slice(0, 128) : undefined,
      outboundRtpTransportId: typeof ev.outboundRtpTransportId === 'string' ? ev.outboundRtpTransportId.slice(0, 128) : undefined,
      outboundRtpSelectedCandidatePairId: typeof ev.outboundRtpSelectedCandidatePairId === 'string' ? ev.outboundRtpSelectedCandidatePairId.slice(0, 128) : undefined,
      isOutboundRtpProducer: typeof ev.isOutboundRtpProducer === 'boolean' ? ev.isOutboundRtpProducer : undefined,

      sdpType: typeof ev.sdpType === 'string' ? ev.sdpType.slice(0, 16) : undefined,
      sdpAudioMLineIndex: typeof ev.sdpAudioMLineIndex === 'number' ? ev.sdpAudioMLineIndex : undefined,
      sdpAudioMLine: typeof ev.sdpAudioMLine === 'string' ? ev.sdpAudioMLine.slice(0, 256) : undefined,
      sdpAudioMid: typeof ev.sdpAudioMid === 'string' ? ev.sdpAudioMid.slice(0, 32) : undefined,
      sdpAudioDirection: typeof ev.sdpAudioDirection === 'string' ? ev.sdpAudioDirection.slice(0, 16) : undefined,
      sdpAudioMsid: typeof ev.sdpAudioMsid === 'string' ? ev.sdpAudioMsid.slice(0, 256) : undefined,

      outboundCodecMimeType: typeof ev.outboundCodecMimeType === 'string' ? ev.outboundCodecMimeType.slice(0, 128) : undefined,
      outboundCodecPayloadType: typeof ev.outboundCodecPayloadType === 'number' ? ev.outboundCodecPayloadType : undefined,
      outboundCodecClockRate: typeof ev.outboundCodecClockRate === 'number' ? ev.outboundCodecClockRate : undefined,
      outboundCodecChannels: typeof ev.outboundCodecChannels === 'number' ? ev.outboundCodecChannels : undefined,

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
      trackKind: typeof ev.trackKind === 'string' ? ev.trackKind.slice(0, 16) : undefined,
      trackMuted: typeof ev.trackMuted === 'boolean' ? ev.trackMuted : undefined,
      trackEnabled: typeof ev.trackEnabled === 'boolean' ? ev.trackEnabled : undefined,
      trackReadyState: typeof ev.trackReadyState === 'string' ? ev.trackReadyState.slice(0, 32) : undefined,

      // Capture lifecycle (desktop mic-stuck RCA)
      sourceTag: typeof ev.sourceTag === 'string' ? ev.sourceTag.slice(0, 96) : undefined,
      contextState: typeof ev.contextState === 'string' ? ev.contextState.slice(0, 32) : undefined,
      activeCount: typeof ev.activeCount === 'number' ? ev.activeCount : undefined,
      activeTrackIds: Array.isArray(ev.activeTrackIds)
        ? ev.activeTrackIds.slice(0, 8).map((id) => (typeof id === 'string') ? id.slice(0, 128) : undefined).filter(Boolean)
        : undefined,
      trackIds: Array.isArray(ev.trackIds)
        ? ev.trackIds.slice(0, 8).map((id) => (typeof id === 'string') ? id.slice(0, 128) : undefined).filter(Boolean)
        : undefined,
      streamId: typeof ev.streamId === 'string' ? ev.streamId.slice(0, 128) : undefined,
      label: typeof ev.label === 'string' ? ev.label.slice(0, 128) : undefined,
      readyStateBefore: typeof ev.readyStateBefore === 'string' ? ev.readyStateBefore.slice(0, 32) : undefined,
      readyStateAfter: typeof ev.readyStateAfter === 'string' ? ev.readyStateAfter.slice(0, 32) : undefined,
      audioElMuted: typeof ev.audioElMuted === 'boolean' ? ev.audioElMuted : undefined,
      audioElVolume: typeof ev.audioElVolume === 'number' ? ev.audioElVolume : undefined,
      audioElReadyState: typeof ev.audioElReadyState === 'number' ? ev.audioElReadyState : undefined,
      audioElPaused: typeof ev.audioElPaused === 'boolean' ? ev.audioElPaused : undefined,
      audioElCurrentTime: typeof ev.audioElCurrentTime === 'number' ? ev.audioElCurrentTime : undefined,

      // Audio output route diagnostics (raw-only observability)
      desiredMode: typeof ev.desiredMode === 'string' ? ev.desiredMode.slice(0, 32) : undefined,
      routedTo: typeof ev.routedTo === 'string' ? ev.routedTo.slice(0, 32) : undefined,
      sinkSupported: typeof ev.sinkSupported === 'boolean' ? ev.sinkSupported : undefined,
      sinkId: typeof ev.sinkId === 'string' ? ev.sinkId.slice(0, 128) : undefined,
      enumerateDevicesAvailable: typeof ev.enumerateDevicesAvailable === 'boolean' ? ev.enumerateDevicesAvailable : undefined,
      setSinkIdAvailable: typeof ev.setSinkIdAvailable === 'boolean' ? ev.setSinkIdAvailable : undefined,
      routeInfoUnavailable: typeof ev.routeInfoUnavailable === 'boolean' ? ev.routeInfoUnavailable : undefined,
      routeInfoSource: typeof ev.routeInfoSource === 'string' ? ev.routeInfoSource.slice(0, 64) : undefined,
      androidRouteControlAvailable: typeof ev.androidRouteControlAvailable === 'boolean' ? ev.androidRouteControlAvailable : undefined,
      effectiveOutput: typeof ev.effectiveOutput === 'string' ? ev.effectiveOutput.slice(0, 64) : undefined,
      routeDecision: typeof ev.routeDecision === 'string' ? ev.routeDecision.slice(0, 96) : undefined,
      routeDecisionReason: typeof ev.routeDecisionReason === 'string' ? ev.routeDecisionReason.slice(0, 256) : undefined,
      trigger: typeof ev.trigger === 'string' ? ev.trigger.slice(0, 64) : undefined,
      reason: typeof ev.reason === 'string' ? ev.reason.slice(0, 128) : undefined,
      audioOutputs: Array.isArray(ev.audioOutputs)
        ? ev.audioOutputs.slice(0, 8).map((d) => ({
          deviceId: (d && typeof d.deviceId === 'string') ? d.deviceId.slice(0, 128) : undefined,
          label: (d && typeof d.label === 'string') ? d.label.slice(0, 128) : undefined,
        }))
        : undefined,

      // Ringback (WebAudio) diagnostics
      ringbackRunning: typeof ev.ringbackRunning === 'boolean' ? ev.ringbackRunning : undefined,
      ringbackCtxState: typeof ev.ringbackCtxState === 'string' ? ev.ringbackCtxState.slice(0, 32) : undefined,
      ringbackCtxCurrentTime: typeof ev.ringbackCtxCurrentTime === 'number' ? ev.ringbackCtxCurrentTime : undefined,

      // App/page audio route selection snapshot (raw-only observability)
      appAudioRouteMode: typeof ev.appAudioRouteMode === 'string' ? ev.appAudioRouteMode.slice(0, 32) : undefined,
      appAudioRouteSource: typeof ev.appAudioRouteSource === 'string' ? ev.appAudioRouteSource.slice(0, 32) : undefined,
      appAudioRouteDetail: typeof ev.appAudioRouteDetail === 'string' ? ev.appAudioRouteDetail.slice(0, 128) : undefined,
      speakerButtonActive: typeof ev.speakerButtonActive === 'boolean' ? ev.speakerButtonActive : undefined,
      earpieceButtonActive: typeof ev.earpieceButtonActive === 'boolean' ? ev.earpieceButtonActive : undefined,
      audioRouteStateAvailable: typeof ev.audioRouteStateAvailable === 'boolean' ? ev.audioRouteStateAvailable : undefined,
      audioRouteMismatch: typeof ev.audioRouteMismatch === 'boolean' ? ev.audioRouteMismatch : undefined,
      audioRouteSnapshotTs: typeof ev.audioRouteSnapshotTs === 'string' ? ev.audioRouteSnapshotTs.slice(0, 32) : undefined,

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

      // Outbound audio content evidence (if exposed by browser stats)
      outboundAudioLevel: typeof ev.outboundAudioLevel === 'number' ? ev.outboundAudioLevel : undefined,
      outboundTotalAudioEnergy: typeof ev.outboundTotalAudioEnergy === 'number' ? ev.outboundTotalAudioEnergy : undefined,

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

      // Transport diagnostics (e.g., call-log-post-failed)
      httpStatus: typeof ev.httpStatus === 'number' ? ev.httpStatus : undefined,
      httpErr: typeof ev.httpErr === 'string' ? ev.httpErr.slice(0, 256) : undefined,
      urlPath: typeof ev.urlPath === 'string' ? ev.urlPath.slice(0, 256) : undefined,
      fetchOk: typeof ev.fetchOk === 'boolean' ? ev.fetchOk : undefined,
      attempts: typeof ev.attempts === 'number' ? ev.attempts : undefined,

      // Human-readable message (raw-only; no summary transforms)
      msg: typeof ev.msg === 'string' ? ev.msg.slice(0, 256) : undefined,
      reason: typeof ev.reason === 'string' ? ev.reason.slice(0, 128) : undefined,
      checkpoint: typeof ev.checkpoint === 'string' ? ev.checkpoint.slice(0, 64) : undefined,

      oldestQueuedAgeMs: typeof ev.oldestQueuedAgeMs === 'number' ? ev.oldestQueuedAgeMs : undefined,

      // Probe/build markers
      probeBuildId: typeof ev.probeBuildId === 'string' ? ev.probeBuildId.slice(0, 96) : undefined,
      // POST proof fields (client-side delivery diagnostics)
      postAttemptId: typeof ev.postAttemptId === 'string' ? ev.postAttemptId.slice(0, 64) : undefined,
      postBatchSize: typeof ev.postBatchSize === 'number' ? ev.postBatchSize : undefined,
      postUrl: typeof ev.postUrl === 'string' ? ev.postUrl.slice(0, 128) : undefined,
      postOk: typeof ev.postOk === 'boolean' ? ev.postOk : undefined,
      postStatus: typeof ev.postStatus === 'number' ? ev.postStatus : undefined,
      postStatusText: typeof ev.postStatusText === 'string' ? ev.postStatusText.slice(0, 64) : undefined,
      postError: typeof ev.postError === 'string' ? ev.postError.slice(0, 256) : undefined,
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
