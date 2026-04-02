import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { candType, short } from "./utils.js";
import { sendCallMediaEvent } from "../features/callMediaLog.js";
import { isMobileCompatModeEnabled } from "../features/mobileNetworkMode.js";
import { countCandidatesFromSdp } from "../features/lteCallGuard.js";

let _stats = null;
let _statsImport = null;

function getRuntimeCb() {
  try {
    const fromGlobal = (typeof window !== 'undefined' && window.__BUILD_CB) ? String(window.__BUILD_CB) : '';
    if (fromGlobal) return fromGlobal;
  } catch {}
  try {
    const u = new URL(import.meta.url);
    return (u.searchParams.get('cb') || '').trim();
  } catch {
    return '';
  }
}

function loadStats() {
  if (_stats) return Promise.resolve(_stats);
  if (_statsImport) return _statsImport;

  const cb = getRuntimeCb();
  const url = cb ? `./stats.js?cb=${encodeURIComponent(cb)}` : './stats.js';
  _statsImport = import(url)
    .then((m) => {
      _stats = m;
      return m;
    })
    .catch((err) => {
      try {
        console.error('[pc/bind] Failed to import pc/stats.js', err);
      } catch {}
      throw err;
    });
  return _statsImport;
}

function withStats(fnName, runner) {
  return (...args) => {
    loadStats()
      .then((m) => {
        const fn = m?.[fnName];
        if (typeof fn !== 'function') {
          try {
            console.error(`[pc/bind] Missing stats export ${fnName}`);
          } catch {}
          return;
        }
        runner(fn, args);
      })
      .catch(() => {});
  };
}

const logSelectedPair = withStats('logSelectedPair', (fn, args) => fn(...args));
const startRtpStats = withStats('startRtpStats', (fn, args) => fn(...args));
const stopRtpStats = withStats('stopRtpStats', (fn, args) => fn(...args));
const scheduleMediaStatsSnapshots = withStats('scheduleMediaStatsSnapshots', (fn, args) => fn(...args));

async function emitSelectedPairSummary(pc, label, { aor, callId, mode, icePolicy } = {}) {
  try {
    const stats = await pc.getStats();
    let selectedPair = null;

    stats.forEach((r) => {
      if (r.type === "transport" && r.selectedCandidatePairId) selectedPair = stats.get(r.selectedCandidatePairId);
      if (!selectedPair && r.type === "candidate-pair" && r.selected === true) selectedPair = r;
    });

    if (!selectedPair) {
      stats.forEach((r) => {
        if (r.type === "candidate-pair" && r.state === "succeeded" && (r.nominated === true || r.writable === true)) {
          selectedPair = r;
        }
      });
    }

    if (!selectedPair) return;
    const local = selectedPair.localCandidateId ? stats.get(selectedPair.localCandidateId) : null;
    const remote = selectedPair.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) : null;

    const lp = local ? `${local.candidateType || "?"} ${local.address || local.ip || "?"}:${local.port || "?"}` : "unknown";
    const rp = remote ? `${remote.candidateType || "?"} ${remote.address || remote.ip || "?"}:${remote.port || "?"}` : "unknown";
    const pair = `local=${lp} remote=${rp}`;

    sendCallMediaEvent({
      type: 'selected-pair',
      dir: label,
      aor,
      callId,
      mode,
      icePolicy,
      selectedPair: pair,
      msg: 'Selected ICE candidate pair',
    });
  } catch {
    // no-op: observability only
  }
}

export function bindPeerConnection(session, label, { aor, callId } = {}) {
  const pc = session?.sessionDescriptionHandler?.peerConnection;
  if (!pc || pc.__bound) return;
  pc.__bound = true;

  // Normalize direction labels used across the app.
  const dir = (label === 'inbound' || label === 'outbound')
    ? label
    : (label === 'inbound' ? 'inbound' : (label === 'outbound' ? 'outbound' : label));

  // Track candidate types gathered — used for LTE relay detection summary
  const _counts = { host: 0, srflx: 0, relay: 0, prflx: 0 };
  const _lteMode = isMobileCompatModeEnabled();
  const _mode = _lteMode ? 'lte' : 'wifi';
  const _icePolicy = _lteMode ? 'relay' : 'all';
  const _selectedProfile = _mode;

  const _diag = (() => {
    const d = session?.__callMediaDiag || null;
    if (!d || typeof d !== 'object') return {};
    return {
      username: typeof d.username === 'string' ? d.username : undefined,
      domain: typeof d.domain === 'string' ? d.domain : undefined,
      aor: typeof d.aor === 'string' ? d.aor : aor,
      corrId: typeof d.corrId === 'string' ? d.corrId : undefined,
      sessionId: typeof d.sessionId === 'string' ? d.sessionId : undefined,
      peer: typeof d.peer === 'string' ? d.peer : undefined,
      peerDomain: typeof d.peerDomain === 'string' ? d.peerDomain : undefined,
      peerAor: typeof d.peerAor === 'string' ? d.peerAor : undefined,
      mode: typeof d.mode === 'string' ? d.mode : _mode,
      selectedProfile: typeof d.selectedProfile === 'string' ? d.selectedProfile : _selectedProfile,
      icePolicy: typeof d.icePolicy === 'string' ? d.icePolicy : _icePolicy,
    };
  })();

  const _corrId = _diag.corrId;
  const _callId = callId;

  // If ICE gathering was already complete when we bound (SIP.js gathers before sending
  // INVITE, so gathering is done by the time state-change fires), read the candidate
  // summary from the local SDP instead of relying on events that already fired.
  if (pc.iceGatheringState === 'complete') {
    const sdpCounts = countCandidatesFromSdp(pc.localDescription?.sdp);
    Object.assign(_counts, sdpCounts);
    logLine(`[${nowISO()}] [pc:${label}] ICE already complete (from SDP) — host=${_counts.host} srflx=${_counts.srflx} relay=${_counts.relay} total=${sdpCounts.total}`);
    if (_counts.total === 0) {
      logLine(`[${nowISO()}] [pc:${label}] WARNING: zero candidates in local SDP — browser sent discard address (0.0.0.0:9)`);
    }
    sendCallMediaEvent({
      type: 'ice-complete',
      dir,
      aor: _diag.aor || aor,
      callId: _callId,
      corrId: _corrId,
      username: _diag.username,
      domain: _diag.domain,
      peer: _diag.peer,
      peerDomain: _diag.peerDomain,
      peerAor: _diag.peerAor,
      lteMode: _lteMode,
      mode: _diag.mode,
      selectedProfile: _diag.selectedProfile,
      icePolicy: _diag.icePolicy,
      relay: _counts.relay, host: _counts.host, srflx: _counts.srflx, total: sdpCounts.total,
      msg: 'from-sdp (late-bind)',
    });
  }

  pc.addEventListener("track", (ev) => {
    logLine(`[${nowISO()}] [pc:${label}] track`);
    try {
      const streamCount = Array.isArray(ev.streams) ? ev.streams.length : 0;
      const trackKind = ev.track?.kind || 'unknown';
      const trackId = ev.track?.id || undefined;
      const trackMuted = typeof ev.track?.muted === 'boolean' ? ev.track.muted : undefined;
      const remoteStream = streamCount > 0 ? ev.streams[0] : null;
      const remoteAudioTracks = remoteStream?.getAudioTracks ? remoteStream.getAudioTracks() : [];
      const remoteAudioTrackCount = Array.isArray(remoteAudioTracks) ? remoteAudioTracks.length : 0;

      if (trackKind === 'audio') {
        sendCallMediaEvent({
          type: 'remote-audio-track-added',
          dir,
          aor: _diag.aor || aor,
          callId: _callId,
          corrId: _corrId,
          username: _diag.username,
          domain: _diag.domain,
          peer: _diag.peer,
          peerDomain: _diag.peerDomain,
          peerAor: _diag.peerAor,
          mode: _diag.mode,
          selectedProfile: _diag.selectedProfile,
          icePolicy: _diag.icePolicy,
          trackId,
          trackMuted,
          remoteAudioTrackCount,
          msg: 'Remote audio track added (pc.track)',
        });

        try {
          if (ev.track && !ev.track.__callMediaMuteObserved) {
            ev.track.__callMediaMuteObserved = true;
            ev.track.onmute = () => {
              sendCallMediaEvent({
                type: 'receiver-track-muted',
                dir,
                aor: _diag.aor || aor,
                callId: _callId,
                corrId: _corrId,
                username: _diag.username,
                domain: _diag.domain,
                peer: _diag.peer,
                peerDomain: _diag.peerDomain,
                peerAor: _diag.peerAor,
                mode: _diag.mode,
                selectedProfile: _diag.selectedProfile,
                icePolicy: _diag.icePolicy,
                trackId,
                msg: 'Receiver track muted',
              });
            };
            ev.track.onunmute = () => {
              sendCallMediaEvent({
                type: 'receiver-track-unmuted',
                dir,
                aor: _diag.aor || aor,
                callId,
                username: _diag.username,
                domain: _diag.domain,
                peer: _diag.peer,
                peerDomain: _diag.peerDomain,
                peerAor: _diag.peerAor,
                mode: _diag.mode,
                selectedProfile: _diag.selectedProfile,
                icePolicy: _diag.icePolicy,
                trackId,
                msg: 'Receiver track unmuted',
              });
            };
          }
        } catch {}
      }

      sendCallMediaEvent({
        type: 'remote-audio-attached',
        dir,
        aor: _diag.aor || aor,
        callId: _callId,
        corrId: _corrId,
        sessionId: _diag.sessionId,
        username: _diag.username,
        domain: _diag.domain,
        peer: _diag.peer,
        peerDomain: _diag.peerDomain,
        peerAor: _diag.peerAor,
        mode: _diag.mode,
        selectedProfile: _diag.selectedProfile,
        icePolicy: _diag.icePolicy,
        hasRemoteStream: Boolean(remoteStream),
        remoteAudioTrackCount,
        msg: `pc.track kind=${trackKind} streams=${streamCount}`,
      });
    } catch {
      // no-op
    }
  });

  pc.addEventListener("icecandidate", (ev) => {
    const candidate = ev.candidate?.candidate;
    if (!candidate) {
      // Gathering complete — log summary and send server event
      const total = _counts.host + _counts.srflx + _counts.relay + _counts.prflx;
      logLine(`[${nowISO()}] [pc:${label}] ICE gathering complete — candidates: host=${_counts.host} srflx=${_counts.srflx} relay=${_counts.relay} total=${total}`);
      if (_counts.relay > 0 && _counts.host === 0 && _counts.srflx === 0) {
        logLine(`[${nowISO()}] [pc:${label}] LTE relay-only mode confirmed — all media through TURN relay`);
      } else if (_counts.relay > 0) {
        logLine(`[${nowISO()}] [pc:${label}] TURN relay candidates available (relay=${_counts.relay}) alongside direct candidates`);
      } else if (total === 0) {
        logLine(`[${nowISO()}] [pc:${label}] WARNING: no ICE candidates gathered — check TURN credentials and reachability`);
      }
      sendCallMediaEvent({
        type: 'ice-complete',
        dir,
        aor: _diag.aor || aor,
        callId,
        username: _diag.username,
        domain: _diag.domain,
        peer: _diag.peer,
        peerDomain: _diag.peerDomain,
        peerAor: _diag.peerAor,
        lteMode: _lteMode,
        mode: _diag.mode,
        selectedProfile: _diag.selectedProfile,
        icePolicy: _diag.icePolicy,
        relay: _counts.relay, host: _counts.host, srflx: _counts.srflx, total,
      });
      return;
    }
    const typ = candType(candidate);
    if (typ in _counts) _counts[typ]++;
    logLine(`[${nowISO()}] [pc:${label}] candidate typ=${typ} ${short(candidate)}`);
  });

  pc.addEventListener("icecandidateerror", (ev) => {
    logLine(`[${nowISO()}] [pc:${label}] icecandidateerror code=${ev.errorCode} text=${ev.errorText || ""}`);
    if (!_lteMode) return;
    try {
      sendCallMediaEvent({
        type: 'icecandidateerror',
        dir,
        aor: _diag.aor || aor,
        callId,
        username: _diag.username,
        domain: _diag.domain,
        peer: _diag.peer,
        peerDomain: _diag.peerDomain,
        peerAor: _diag.peerAor,
        lteMode: _lteMode,
        mode: _diag.mode,
        selectedProfile: _diag.selectedProfile,
        icePolicy: _diag.icePolicy,
        errorCode: ev?.errorCode,
        errorText: ev?.errorText,
        url: ev?.url,
        address: ev?.address,
        port: ev?.port,
        hostCandidate: ev?.hostCandidate,
        msg: 'RTCPeerConnection icecandidateerror',
      });
    } catch {
      // no-op
    }
  });

  pc.addEventListener("iceconnectionstatechange", () => {
    logLine(`[${nowISO()}] [pc:${label}] ice=${pc.iceConnectionState}`);
    if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
      logSelectedPair(pc, label);
      emitSelectedPairSummary(pc, label, { aor, callId, mode: _mode, icePolicy: _icePolicy });
      startRtpStats(pc, label);
      scheduleMediaStatsSnapshots(pc, label, {
        aor: _diag.aor || aor,
        callId,
        corrId: _corrId,
        sessionId: _diag.sessionId,
        username: _diag.username,
        domain: _diag.domain,
        peer: _diag.peer,
        peerDomain: _diag.peerDomain,
        peerAor: _diag.peerAor,
        lteMode: _lteMode,
        mode: _diag.mode,
        selectedProfile: _diag.selectedProfile,
        icePolicy: _diag.icePolicy,
      });
    }
    if (["failed", "disconnected", "closed"].includes(pc.iceConnectionState)) {
      if (pc.iceConnectionState === "failed") {
        logLine(`[${nowISO()}] [pc:${label}] ICE FAILED — relay=${_counts.relay} host=${_counts.host} srflx=${_counts.srflx}; check TURN reachability on LTE`);
        sendCallMediaEvent({
          type: 'ice-failed',
          code: 'MEDIA-E002',
          dir,
          aor: _diag.aor || aor,
          callId,
          username: _diag.username,
          domain: _diag.domain,
          peer: _diag.peer,
          peerDomain: _diag.peerDomain,
          peerAor: _diag.peerAor,
          lteMode: _lteMode,
          mode: _diag.mode,
          selectedProfile: _diag.selectedProfile,
          icePolicy: _diag.icePolicy,
          relay: _counts.relay, host: _counts.host, srflx: _counts.srflx,
          msg: 'ICE connection failed',
        });
      }
      stopRtpStats(pc);
    }
  });

  pc.addEventListener("connectionstatechange", () => {
    logLine(`[${nowISO()}] [pc:${label}] conn=${pc.connectionState}`);
    if (pc.connectionState === "connected") {
      logSelectedPair(pc, label);
      emitSelectedPairSummary(pc, label, { aor, callId, mode: _mode, icePolicy: _icePolicy });
      startRtpStats(pc, label);
    }
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      stopRtpStats(pc);
    }
  });
}
