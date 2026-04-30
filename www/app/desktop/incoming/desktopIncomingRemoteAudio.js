import { nowISO, logLine } from "../desktopLogging.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { readAppAudioRouteDiagSnapshot, readMode } from "../../ui/audioRoute/state.js";
import { getDesktopPlatformAdapter } from "../runtime/platformAdapterRegistry.js";
import {
  bindDesktopInboundAudioStats,
  emitDesktopInboundAttachEvents,
  startDesktopIncomingEarlyMediaLoop as startLoop,
  stopDesktopIncomingEarlyMediaLoop as stopLoop,
} from "./desktopIncomingRemoteAudioSupport.js";

async function enforceDesktopIncomingAudioRoute(audioEl) {
  try {
    const adapter = getDesktopPlatformAdapter();
    const allow = !!adapter?.audioRoute?.enforceOnIncoming;
    const fn = adapter?.audioRoute?.enforce;
    if (!allow || typeof fn !== "function") return;

    const mode = readMode();
    await fn(audioEl, mode);
  } catch {}
}

export function attachDesktopIncomingRemoteAudio(session, ui) {
  try {
    const audioEl = ui?.remoteAudio?.();
    const pc = session?.sessionDescriptionHandler?.peerConnection;
    if (!audioEl || !pc) {
      logLine(`[${nowISO()}] [desktop:incoming:media] attachRemoteAudio skipped: audioEl=${!!audioEl}, pc=${!!pc}`);
      return;
    }

    if (pc.__desktopIncomingAudioBound) {
      return;
    }

    pc.__desktopIncomingAudioBound = true;
    logLine(`[${nowISO()}] [desktop:incoming:media] Attaching remote audio handler`);

    const bindAndPlay = (stream, trackKind = "audio") => {
      if (!stream) return;
      const nextTrack = stream.getAudioTracks?.()[0] || null;
      if (!nextTrack) return;

      const currentStream = audioEl.srcObject;
      const currentTrack = currentStream?.getAudioTracks?.()[0] || null;
      const sameTrack = !!currentTrack && currentTrack.id === nextTrack.id;

      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.muted = false;
      audioEl.volume = 1;

      try {
        emitDesktopInboundAttachEvents({ pc, session, audioEl, stream, trackKind });
      } catch {}

      if (sameTrack && !audioEl.paused && audioEl.srcObject) {
        return;
      }

      if (!sameTrack) {
        audioEl.srcObject = stream;
      }

      logLine(`[${nowISO()}] [desktop:incoming:media] Remote ${trackKind} bound to audio element`);

      try {
        globalThis.__callMediaRemoteAudioEl = audioEl;
      } catch {}

      const ctx = (() => {
        try {
          return (session && session.__callMediaDiag && typeof session.__callMediaDiag === "object")
            ? session.__callMediaDiag
            : {};
        } catch {
          return {};
        }
      })();

      try {
        sendCallMediaEvent({
          type: "inbound-play-attempt",
          ...ctx,
          dir: "inbound",
          audioElMuted: typeof audioEl.muted === "boolean" ? audioEl.muted : undefined,
          audioElVolume: typeof audioEl.volume === "number" ? audioEl.volume : undefined,
          audioElReadyState: typeof audioEl.readyState === "number" ? audioEl.readyState : undefined,
          audioElPaused: typeof audioEl.paused === "boolean" ? audioEl.paused : undefined,
          msg: "Inbound audioEl.play invoked (desktop attach)",
        });

        sendCallMediaEvent({
          type: "inbound-audio-element-state",
          ...ctx,
          dir: "inbound",
          audioElMuted: typeof audioEl.muted === "boolean" ? audioEl.muted : undefined,
          audioElVolume: typeof audioEl.volume === "number" ? audioEl.volume : undefined,
          audioElReadyState: typeof audioEl.readyState === "number" ? audioEl.readyState : undefined,
          audioElPaused: typeof audioEl.paused === "boolean" ? audioEl.paused : undefined,
          audioElCurrentTime: typeof audioEl.currentTime === "number" ? audioEl.currentTime : undefined,
          msg: "Inbound audio element state (desktop at play attempt)",
        });
      } catch {}

      let playPromise = null;
      try {
        playPromise = audioEl.play?.() || null;
      } catch (err) {
        try {
          sendCallMediaEvent({
            type: "inbound-play-rejected",
            ...ctx,
            dir: "inbound",
            playErrorName: err?.name,
            playErrorMessage: err?.message,
            msg: "Inbound audioEl.play threw (desktop attach)",
          });
        } catch {}
      }

      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .catch((err) => {
            logLine(`[${nowISO()}] [desktop:incoming:media] Play blocked: ${err?.name || err?.message || err}`);
            try {
              sendCallMediaEvent({
                type: "inbound-play-rejected",
                ...ctx,
                dir: "inbound",
                playErrorName: err?.name,
                playErrorMessage: err?.message,
                msg: "Inbound audioEl.play rejected (desktop attach)",
              });
            } catch {}
          });
      }

      void enforceDesktopIncomingAudioRoute(audioEl);

      bindDesktopInboundAudioStats(pc, session);
    };

    pc.addEventListener(
      "track",
      (ev) => {
        const [stream] = ev.streams || [];
        if (stream) {
          bindAndPlay(stream, ev.track?.kind || "audio");
        } else if (ev.track) {
          bindAndPlay(new MediaStream([ev.track]), ev.track.kind || "audio");
        }
      },
      { once: false }
    );

    const existingTrack = pc.getReceivers?.().find((r) => r.track && r.track.kind === "audio")?.track;
    if (existingTrack) {
      bindAndPlay(new MediaStream([existingTrack]), existingTrack.kind);
    }
  } catch (err) {
    logLine(`[${nowISO()}] [desktop:incoming:media] ERROR in attachRemoteAudio: ${err?.message || err}`);
  }
}

export function startDesktopIncomingEarlyMediaLoop(session, ui) {
  return startLoop(session, ui, attachDesktopIncomingRemoteAudio);
}

export function stopDesktopIncomingEarlyMediaLoop(session) {
  return stopLoop(session);
}
