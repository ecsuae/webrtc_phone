// www/app/pcDebug.js
import { nowISO } from "./config.js";
import { logLine } from "./log.js";
import { attachRemoteStream } from "./media.js";

function candType(s) {
  const m = s?.match(/\btyp\s(\w+)/);
  return m ? m[1] : "unknown";
}
function short(s) {
  return s && s.length > 140 ? s.slice(0, 140) + "..." : s || "";
}

// ---- RTP / ICE diagnostics helpers ----
async function logSelectedPair(pc, label) {
  try {
    const stats = await pc.getStats();
    let selectedPair = null;
    let local = null;
    let remote = null;

    // Find selected candidate pair
    stats.forEach((r) => {
      // Chrome/Edge: transport has selectedCandidatePairId
      if (r.type === "transport" && r.selectedCandidatePairId) {
        selectedPair = stats.get(r.selectedCandidatePairId);
      }
      // Firefox sometimes: candidate-pair has selected=true
      if (!selectedPair && r.type === "candidate-pair" && r.selected === true) {
        selectedPair = r;
      }
    });

    if (!selectedPair) {
      // fallback: pick "succeeded + nominated" pair if present
      stats.forEach((r) => {
        if (
          r.type === "candidate-pair" &&
          r.state === "succeeded" &&
          (r.nominated === true || r.writable === true)
        ) {
          selectedPair = r;
        }
      });
    }

    if (selectedPair) {
      if (selectedPair.localCandidateId) local = stats.get(selectedPair.localCandidateId);
      if (selectedPair.remoteCandidateId) remote = stats.get(selectedPair.remoteCandidateId);

      const lp = local
        ? `${local.candidateType || "?"} ${local.address || local.ip || "?"}:${local.port || "?"}`
        : "unknown";
      const rp = remote
        ? `${remote.candidateType || "?"} ${remote.address || remote.ip || "?"}:${remote.port || "?"}`
        : "unknown";

      logLine(
        `[${nowISO()}] [pc:${label}] selected-pair ${selectedPair.state || "?"} ` +
          `local=${lp} remote=${rp}`
      );
    }
  } catch (e) {
    logLine(`[${nowISO()}] [pc:${label}] selected-pair error ${e?.message || e}`);
  }
}

function startRtpStats(pc, label) {
  // Avoid multiple timers
  if (pc.__rtpTimer) return;

  pc.__rtpTimer = setInterval(async () => {
    try {
      if (!pc || pc.connectionState === "closed") return;

      const stats = await pc.getStats();

      let sent = 0;
      let recv = 0;
      let packetsLost = 0;
      let jitter = null;
      let rtt = null;

      stats.forEach((r) => {
        // outbound audio
        if (r.type === "outbound-rtp" && r.kind === "audio") {
          sent += r.bytesSent || 0;
        }
        // inbound audio
        if (r.type === "inbound-rtp" && r.kind === "audio") {
          recv += r.bytesReceived || 0;
          packetsLost += r.packetsLost || 0;
          if (typeof r.jitter === "number") jitter = r.jitter;
        }
        // candidate-pair RTT (if available)
        if (r.type === "candidate-pair" && (r.selected === true || r.nominated === true)) {
          if (typeof r.currentRoundTripTime === "number") rtt = r.currentRoundTripTime;
        }
      });

      const j = jitter === null ? "?" : jitter.toFixed(4);
      const t = rtt === null ? "?" : rtt.toFixed(4);

      logLine(
        `[${nowISO()}] [pc:${label}] rtp sent=${sent} recv=${recv} lost=${packetsLost} jitter=${j} rtt=${t}`
      );
    } catch (e) {
      logLine(`[${nowISO()}] [pc:${label}] rtp-stats error ${e?.message || e}`);
    }
  }, 2000);
}

function stopRtpStats(pc) {
  if (pc?.__rtpTimer) {
    clearInterval(pc.__rtpTimer);
    pc.__rtpTimer = null;
  }
}

// ---- main binding ----
export function bindPeerConnection(session, label) {
  const pc = session?.sessionDescriptionHandler?.peerConnection;
  if (!pc || pc.__bound) return;
  pc.__bound = true;

  // Track event (remote audio)
  pc.addEventListener("track", (ev) => {
    logLine(`[${nowISO()}] [pc:${label}] track`);
    const stream = ev.streams?.[0];
    if (stream) attachRemoteStream(stream);
  });

  // ICE candidates
  pc.addEventListener("icecandidate", (ev) => {
    const c = ev.candidate?.candidate;
    if (!c) return logLine(`[${nowISO()}] [pc:${label}] ICE gathering complete`);
    logLine(`[${nowISO()}] [pc:${label}] candidate typ=${candType(c)} ${short(c)}`);
  });

  pc.addEventListener("icecandidateerror", (ev) => {
    logLine(
      `[${nowISO()}] [pc:${label}] icecandidateerror code=${ev.errorCode} text=${ev.errorText || ""}`
    );
  });

  // ICE / connection state
  pc.addEventListener("iceconnectionstatechange", () => {
    logLine(`[${nowISO()}] [pc:${label}] ice=${pc.iceConnectionState}`);

    // When ICE becomes connected/completed, dump selected pair once
    if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
      logSelectedPair(pc, label);
      startRtpStats(pc, label);
    }

    // Cleanup on failure/close
    if (
      pc.iceConnectionState === "failed" ||
      pc.iceConnectionState === "disconnected" ||
      pc.iceConnectionState === "closed"
    ) {
      stopRtpStats(pc);
    }
  });

  pc.addEventListener("connectionstatechange", () => {
    logLine(`[${nowISO()}] [pc:${label}] conn=${pc.connectionState}`);

    if (pc.connectionState === "connected") {
      // extra safety: start stats if not started already
      logSelectedPair(pc, label);
      startRtpStats(pc, label);
    }

    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      stopRtpStats(pc);
    }
  });
}