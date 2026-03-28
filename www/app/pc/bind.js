import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { candType, short } from "./utils.js";
import { logSelectedPair, startRtpStats, stopRtpStats } from "./stats.js";
import { sendCallMediaEvent } from "../features/callMediaLog.js";
import { isMobileCompatModeEnabled } from "../features/mobileNetworkMode.js";
import { countCandidatesFromSdp } from "../features/lteCallGuard.js";

export function bindPeerConnection(session, label, { aor, callId } = {}) {
  const pc = session?.sessionDescriptionHandler?.peerConnection;
  if (!pc || pc.__bound) return;
  pc.__bound = true;

  // Track candidate types gathered — used for LTE relay detection summary
  const _counts = { host: 0, srflx: 0, relay: 0, prflx: 0 };
  const _lteMode = isMobileCompatModeEnabled();

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
      type: 'ice-complete', dir: label, aor, callId,
      lteMode: _lteMode,
      relay: _counts.relay, host: _counts.host, srflx: _counts.srflx, total: sdpCounts.total,
      msg: 'from-sdp (late-bind)',
    });
  }

  pc.addEventListener("track", (ev) => {
    logLine(`[${nowISO()}] [pc:${label}] track`);
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
        type: 'ice-complete', dir: label, aor, callId,
        lteMode: _lteMode,
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
  });

  pc.addEventListener("iceconnectionstatechange", () => {
    logLine(`[${nowISO()}] [pc:${label}] ice=${pc.iceConnectionState}`);
    if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
      logSelectedPair(pc, label);
      startRtpStats(pc, label);
    }
    if (["failed", "disconnected", "closed"].includes(pc.iceConnectionState)) {
      if (pc.iceConnectionState === "failed") {
        logLine(`[${nowISO()}] [pc:${label}] ICE FAILED — relay=${_counts.relay} host=${_counts.host} srflx=${_counts.srflx}; check TURN reachability on LTE`);
        sendCallMediaEvent({
          type: 'ice-failed', code: 'MEDIA-E002', dir: label, aor, callId,
          lteMode: _lteMode,
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
      startRtpStats(pc, label);
    }
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      stopRtpStats(pc);
    }
  });
}
