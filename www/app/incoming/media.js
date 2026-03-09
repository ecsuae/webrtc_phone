import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { enforceCurrentAudioRoute } from "../ui/callControlAudioRoute.js";

export function attachIncomingRemoteAudio(session, ui) {
  try {
    const audioEl = ui?.remoteAudio?.();
    const pc = session?.sessionDescriptionHandler?.peerConnection;
    if (!audioEl || !pc) {
      logLine(`[${nowISO()}] [incoming:media] attachRemoteAudio skipped: audioEl=${!!audioEl}, pc=${!!pc}`);
      return;
    }

    if (pc.__incomingAudioBound) {
      logLine(`[${nowISO()}] [incoming:media] Already bound to this PC`);
      return;
    }

    pc.__incomingAudioBound = true;
    logLine(`[${nowISO()}] [incoming:media] Attaching remote audio handler`);

    const bindAndPlay = (stream, trackKind = "audio") => {
      if (!stream) return;
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.muted = false;
      audioEl.volume = 1;
      audioEl.srcObject = stream;

      logLine(`[${nowISO()}] [incoming:media] Remote ${trackKind} bound to audio element`);
      const playPromise = audioEl.play?.();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise
          .then(() => logLine(`[${nowISO()}] [incoming:media] Audio playing`))
          .catch((err) => logLine(`[${nowISO()}] [incoming:media] Play blocked: ${err?.name || err?.message || err}`));
      }

      enforceCurrentAudioRoute(audioEl).catch((err) => {
        logLine(`[${nowISO()}] [incoming:media] audio route apply failed: ${err?.message || err}`);
      });
    };

    pc.addEventListener("track", (ev) => {
      const [stream] = ev.streams || [];
      if (stream) {
        bindAndPlay(stream, ev.track?.kind || "audio");
      } else if (ev.track) {
        bindAndPlay(new MediaStream([ev.track]), ev.track.kind || "audio");
      }
    }, { once: false });

    const existingTrack = pc.getReceivers?.().find((r) => r.track && r.track.kind === "audio")?.track;
    if (existingTrack) {
      bindAndPlay(new MediaStream([existingTrack]), existingTrack.kind);
    }
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:media] ERROR in attachRemoteAudio: ${err?.message || err}`);
  }
}

export function startIncomingEarlyMediaLoop(session, ui) {
  try {
    if (session.__incomingEarlyMediaTimer) return;

    let attempts = 0;
    const maxAttempts = 40;
    session.__incomingEarlyMediaTimer = setInterval(() => {
      attempts += 1;
      attachIncomingRemoteAudio(session, ui);
      if (session?.state === "Terminated" || attempts >= maxAttempts) {
        clearInterval(session.__incomingEarlyMediaTimer);
        session.__incomingEarlyMediaTimer = null;
      }
    }, 250);
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:media] ERROR starting early media loop: ${err?.message || err}`);
  }
}

export function stopIncomingEarlyMediaLoop(session) {
  if (session?.__incomingEarlyMediaTimer) {
    clearInterval(session.__incomingEarlyMediaTimer);
    session.__incomingEarlyMediaTimer = null;
  }
}
