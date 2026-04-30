import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { emitSelectedPairSummary } from "./emitSelectedPairSummary.js";
import { logSelectedPair, startRtpStats, stopRtpStats, scheduleMediaStatsSnapshots } from "./statsLoader.js";

export function bindStateEvents(pc, label, dir, diag, counts, { aor, callId } = {}) {
  pc.addEventListener("iceconnectionstatechange", () => {
    logLine(`[${nowISO()}] [pc:${label}] ice=${pc.iceConnectionState}`);
    if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
      logSelectedPair(pc, label);
      emitSelectedPairSummary(pc, label, { aor, callId, mode: diag.mode, icePolicy: diag.icePolicy });
      startRtpStats(pc, label);
      scheduleMediaStatsSnapshots(pc, label, {
        aor: diag.aor || aor,
        callId,
        corrId: diag.corrId,
        sessionId: diag.sessionId,
        username: diag.username,
        domain: diag.domain,
        peer: diag.peer,
        peerDomain: diag.peerDomain,
        peerAor: diag.peerAor,
        lteMode: diag.lteMode,
        mode: diag.mode,
        selectedProfile: diag.selectedProfile,
        icePolicy: diag.icePolicy,
      });
    }
    if (["failed", "disconnected", "closed"].includes(pc.iceConnectionState)) {
      if (pc.iceConnectionState === "failed") {
        logLine(`[${nowISO()}] [pc:${label}] ICE FAILED — relay=${counts.relay} host=${counts.host} srflx=${counts.srflx}; check TURN reachability on LTE`);
        sendCallMediaEvent({
          type: "ice-failed",
          code: "MEDIA-E002",
          dir,
          aor: diag.aor || aor,
          callId,
          username: diag.username,
          domain: diag.domain,
          peer: diag.peer,
          peerDomain: diag.peerDomain,
          peerAor: diag.peerAor,
          lteMode: diag.lteMode,
          mode: diag.mode,
          selectedProfile: diag.selectedProfile,
          icePolicy: diag.icePolicy,
          relay: counts.relay,
          host: counts.host,
          srflx: counts.srflx,
          msg: "ICE connection failed",
        });
      }
      stopRtpStats(pc);
    }
  });

  pc.addEventListener("connectionstatechange", () => {
    logLine(`[${nowISO()}] [pc:${label}] conn=${pc.connectionState}`);
    if (pc.connectionState === "connected") {
      logSelectedPair(pc, label);
      emitSelectedPairSummary(pc, label, { aor, callId, mode: diag.mode, icePolicy: diag.icePolicy });
      startRtpStats(pc, label);
    }
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      stopRtpStats(pc);
    }
  });
}
