import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";

export function startRtpStats(pc, label) {
  if (pc.__rtpTimer) return;
  pc.__rtpTimer = setInterval(async () => {
    try {
      if (!pc || pc.connectionState === 'closed') return;
      const stats = await pc.getStats();
      let sent = 0;
      let recv = 0;
      let packetsLost = 0;
      let jitter = null;
      let rtt = null;

      stats.forEach((r) => {
        if (r.type === 'outbound-rtp' && r.kind === 'audio') sent += r.bytesSent || 0;
        if (r.type === 'inbound-rtp' && r.kind === 'audio') {
          recv += r.bytesReceived || 0;
          packetsLost += r.packetsLost || 0;
          if (typeof r.jitter === 'number') jitter = r.jitter;
        }
        if (r.type === 'candidate-pair' && (r.selected === true || r.nominated === true)) {
          if (typeof r.currentRoundTripTime === 'number') rtt = r.currentRoundTripTime;
        }
      });

      const j = jitter === null ? '?' : jitter.toFixed(4);
      const t = rtt === null ? '?' : rtt.toFixed(4);
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
