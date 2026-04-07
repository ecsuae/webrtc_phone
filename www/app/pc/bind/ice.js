import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { candType, short } from "../utils.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { scheduleMediaStatsSnapshots } from "./statsLoader.js";

export function bindIceEvents(pc, label, dir, diag, counts, { aor, callId } = {}) {
  pc.addEventListener("icecandidate", (ev) => {
    const candidate = ev.candidate?.candidate;
    if (!candidate) {
      const total = (counts.host || 0) + (counts.srflx || 0) + (counts.relay || 0) + (counts.prflx || 0);
      logLine(`[${nowISO()}] [pc:${label}] ICE gathering complete — candidates: host=${counts.host} srflx=${counts.srflx} relay=${counts.relay} total=${total}`);
      if (counts.relay > 0 && counts.host === 0 && counts.srflx === 0) {
        logLine(`[${nowISO()}] [pc:${label}] LTE relay-only mode confirmed — all media through TURN relay`);
      } else if (counts.relay > 0) {
        logLine(`[${nowISO()}] [pc:${label}] TURN relay candidates available (relay=${counts.relay}) alongside direct candidates`);
      } else if (total === 0) {
        logLine(`[${nowISO()}] [pc:${label}] WARNING: no ICE candidates gathered — check TURN credentials and reachability`);
      }
      sendCallMediaEvent({
        type: "ice-complete",
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
        total,
      });

      try {
        if (label === "inbound" && pc && !pc.__callMediaInboundStatsStarted) {
          pc.__callMediaInboundStatsStarted = true;
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
      } catch {}
      return;
    }

    const typ = candType(candidate);
    if (typ in counts) counts[typ] += 1;
    logLine(`[${nowISO()}] [pc:${label}] candidate typ=${typ} ${short(candidate)}`);
  });

  pc.addEventListener("icecandidateerror", (ev) => {
    logLine(`[${nowISO()}] [pc:${label}] icecandidateerror code=${ev.errorCode} text=${ev.errorText || ""}`);
    if (!diag.lteMode) return;
    try {
      sendCallMediaEvent({
        type: "icecandidateerror",
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
        errorCode: ev?.errorCode,
        errorText: ev?.errorText,
        url: ev?.url,
        address: ev?.address,
        port: ev?.port,
        hostCandidate: ev?.hostCandidate,
        msg: "RTCPeerConnection icecandidateerror",
      });
    } catch {
      // no-op
    }
  });
}
