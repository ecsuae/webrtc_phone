import { nowISO, logLine } from "../desktopLogging.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { readAppAudioRouteDiagSnapshot } from "../../ui/audioRoute/state.js";
import { getDesktopPlatformAdapter } from "../runtime/platformAdapterRegistry.js";

export function bindDesktopInboundAudioStats(pc, session) {
  const enableStats = (() => {
    try {
      const a = getDesktopPlatformAdapter();
      return !!a?.mediaDiag?.enableInboundAudioStats;
    } catch {
      return false;
    }
  })();

  if (!enableStats || !pc || pc.__desktopInboundAudioStatsBound) return;
  pc.__desktopInboundAudioStatsBound = true;

  let ticks = 0;
  const timer = setInterval(async () => {
    ticks += 1;
    try {
      const receiver = pc.getReceivers?.().find((r) => r.track && r.track.kind === "audio") || null;
      const track = receiver?.track || null;
      const trackLine =
        `[${nowISO()}] [desktop:incoming:media] [diag] recvTrack=` +
        `${!!track} muted=${track?.muted} enabled=${track?.enabled} readyState=${track?.readyState}`;
      logLine(trackLine);

      if (typeof pc.getStats === "function") {
        const stats = await pc.getStats();
        let inboundBytes = null;
        stats.forEach((r) => {
          if (r.type === "inbound-rtp" && r.kind === "audio") {
            if (typeof r.bytesReceived === "number") inboundBytes = r.bytesReceived;
          }
        });
        if (inboundBytes !== null) {
          const bytesLine = `[${nowISO()}] [desktop:incoming:media] [diag] inbound-audio bytesReceived=${inboundBytes}`;
          logLine(bytesLine);
        }
      }
    } catch (e) {
      const errLine = `[${nowISO()}] [desktop:incoming:media] [diag] stats error: ${e?.message || e}`;
      logLine(errLine);
    }

    if (ticks >= 6 || session?.state === "Terminated") {
      clearInterval(timer);
    }
  }, 1000);
}

export function emitDesktopInboundAttachEvents({ pc, session, audioEl, stream, trackKind }) {
  if (!pc || !audioEl) return {};
  if (pc.__desktopIncomingRemoteAudioAttachedEmitted) {
    try {
      return (session && session.__callMediaDiag && typeof session.__callMediaDiag === "object")
        ? session.__callMediaDiag
        : {};
    } catch {
      return {};
    }
  }

  pc.__desktopIncomingRemoteAudioAttachedEmitted = true;
  const ctx = (session && session.__callMediaDiag && typeof session.__callMediaDiag === "object")
    ? session.__callMediaDiag
    : {};

  try {
    const corrId = String(ctx?.corrId || "") || "";
    const prev = String(audioEl.__callMediaInboundPlayListenerCorrId || "") || "";
    const isNew = !!corrId && corrId !== prev;
    if (isNew) audioEl.__callMediaInboundPlayListenerCorrId = corrId;
    if (!audioEl.__callMediaInboundPlayListenerBound) {
      audioEl.__callMediaInboundPlayListenerBound = true;
      audioEl.addEventListener(
        "playing",
        () => {
          try {
            const c = audioEl.__callMediaDiagContext || ctx || {};
            sendCallMediaEvent({
              type: "remote-audio-play-ok",
              ...c,
              dir: "inbound",
              audioPlayOk: true,
              msg: "Inbound remoteAudio is playing (desktop attach listener)",
            });
            sendCallMediaEvent({
              type: "inbound-play-resolved",
              ...c,
              dir: "inbound",
              msg: "Inbound audioEl.play resolved (desktop playing event)",
            });
          } catch {}
        },
        { once: false }
      );
    }
  } catch {}

  try {
    audioEl.__callMediaDiagContext = ctx;
  } catch {}

  try {
    sendCallMediaEvent({
      type: "remote-audio-attached",
      ...ctx,
      dir: "inbound",
      hasRemoteStream: Boolean(stream),
      remoteAudioTrackCount: stream?.getAudioTracks?.()?.length,
      msg: `desktop incoming/media bound ${trackKind || "audio"} to audio element`,
    });
  } catch {}

  try {
    sendCallMediaEvent({
      type: "inbound-audio-route-snapshot",
      ...ctx,
      dir: "inbound",
      ...readAppAudioRouteDiagSnapshot(),
      msg: "Inbound audio route snapshot (desktop at remote-audio-attached)",
    });
  } catch {}

  return ctx;
}

export function startDesktopIncomingEarlyMediaLoop(session, ui, attachFn) {
  try {
    if (session.__desktopIncomingEarlyMediaTimer) return;

    let attempts = 0;
    const maxAttempts = 40;
    session.__desktopIncomingEarlyMediaTimer = setInterval(() => {
      attempts += 1;
      try {
        const pc = session?.sessionDescriptionHandler?.peerConnection;
        if (pc?.__desktopIncomingAudioBound) {
          clearInterval(session.__desktopIncomingEarlyMediaTimer);
          session.__desktopIncomingEarlyMediaTimer = null;
          logLine(`[${nowISO()}] [desktop:incoming:media] Early media loop stopped: audio bound after ${attempts} attempts`);
          return;
        }
      } catch {}
      attachFn(session, ui);
      if (session?.state === "Terminated" || attempts >= maxAttempts) {
        clearInterval(session.__desktopIncomingEarlyMediaTimer);
        session.__desktopIncomingEarlyMediaTimer = null;
      }
    }, 250);
  } catch (err) {
    logLine(`[${nowISO()}] [desktop:incoming:media] ERROR starting early media loop: ${err?.message || err}`);
  }
}

export function stopDesktopIncomingEarlyMediaLoop(session) {
  if (session?.__desktopIncomingEarlyMediaTimer) {
    clearInterval(session.__desktopIncomingEarlyMediaTimer);
    session.__desktopIncomingEarlyMediaTimer = null;
  }
}
