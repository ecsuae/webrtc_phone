import { nowISO } from "../config.js";
import { logLine } from "../log.js";

export async function logSelectedPair(pc, label) {
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
    logLine(`[${nowISO()}] [pc:${label}] selected-pair ${selectedPair.state || "?"} local=${lp} remote=${rp}`);
  } catch (e) {
    logLine(`[${nowISO()}] [pc:${label}] selected-pair error ${e?.message || e}`);
  }
}

export function startRtpStats(pc, label) {
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
        if (r.type === "outbound-rtp" && r.kind === "audio") sent += r.bytesSent || 0;
        if (r.type === "inbound-rtp" && r.kind === "audio") {
          recv += r.bytesReceived || 0;
          packetsLost += r.packetsLost || 0;
          if (typeof r.jitter === "number") jitter = r.jitter;
        }
        if (r.type === "candidate-pair" && (r.selected === true || r.nominated === true)) {
          if (typeof r.currentRoundTripTime === "number") rtt = r.currentRoundTripTime;
        }
      });

      const j = jitter === null ? "?" : jitter.toFixed(4);
      const t = rtt === null ? "?" : rtt.toFixed(4);
      logLine(`[${nowISO()}] [pc:${label}] rtp sent=${sent} recv=${recv} lost=${packetsLost} jitter=${j} rtt=${t}`);
    } catch (e) {
      logLine(`[${nowISO()}] [pc:${label}] rtp-stats error ${e?.message || e}`);
    }
  }, 2000);
}

export function stopRtpStats(pc) {
  if (!pc?.__rtpTimer) return;
  clearInterval(pc.__rtpTimer);
  pc.__rtpTimer = null;
}
