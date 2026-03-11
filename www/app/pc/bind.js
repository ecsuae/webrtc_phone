import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { candType, short } from "./utils.js";
import { logSelectedPair, startRtpStats, stopRtpStats } from "./stats.js";

export function bindPeerConnection(session, label) {
  const pc = session?.sessionDescriptionHandler?.peerConnection;
  if (!pc || pc.__bound) return;
  pc.__bound = true;

  pc.addEventListener("track", (ev) => {
    logLine(`[${nowISO()}] [pc:${label}] track`);
  });

  pc.addEventListener("icecandidate", (ev) => {
    const candidate = ev.candidate?.candidate;
    if (!candidate) return logLine(`[${nowISO()}] [pc:${label}] ICE gathering complete`);
    logLine(`[${nowISO()}] [pc:${label}] candidate typ=${candType(candidate)} ${short(candidate)}`);
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
