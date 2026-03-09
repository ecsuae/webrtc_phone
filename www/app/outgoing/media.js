import { nowISO } from "../config.js";
import { logLine } from "../log.js";

export function attachRemoteAudio(session, ui) {
  try {
    const audioEl = ui?.remoteAudio?.();
    const pc = session?.sessionDescriptionHandler?.peerConnection;
    if (!audioEl || !pc) return;

    const bindAndPlay = (stream, trackKind = "audio", reason = "event") => {
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

      // Avoid reloading the media element for the same track. Reloads during
      // re-INVITE can interrupt playback and cause one-way/no audio symptoms.
      if (!sameTrack) {
        audioEl.srcObject = stream;
      }

      const p = audioEl.play?.();
      if (p && typeof p.catch === "function") {
        p.catch((e) => {
          console.warn("[EARLY-MEDIA] Play blocked:", e?.name, e?.message);
        });
      }
    };

    // Listen for new tracks (e.g., when 183 with SDP arrives, or re-INVITE updates)
    if (!pc.__remoteTrackListenerBound) {
      pc.__remoteTrackListenerBound = true;
      pc.addEventListener(
        "track",
        (ev) => {
          const [stream] = ev.streams || [];
          if (stream) bindAndPlay(stream, ev.track?.kind || "audio", "ontrack");
          else if (ev.track) bindAndPlay(new MediaStream([ev.track]), ev.track.kind || "audio", "ontrack");
        },
        { once: false }
      );
    }

    // Check for existing receivers (tracks that may have arrived silently)
    const audioReceiver = pc.getReceivers?.().find((r) => r.track && r.track.kind === "audio");
    if (audioReceiver?.track) {
      bindAndPlay(new MediaStream([audioReceiver.track]), "audio", "getReceivers");
    }
  } catch (e) {
    console.error("[EARLY-MEDIA] Error attaching remote audio:", e);
  }
}

export function startEarlyMediaAttachLoop(session, ui) {
  try {
    if (session.__earlyMediaAttachTimer) return;
    let attempts = 0;
    session.__earlyMediaAttachTimer = setInterval(() => {
      attempts += 1;
      attachRemoteAudio(session, ui);
      if (session?.state === "Terminated" || attempts >= 40) {
        clearInterval(session.__earlyMediaAttachTimer);
        session.__earlyMediaAttachTimer = null;
      }
    }, 250);
  } catch (error) {
    logLine(`[${nowISO()}] [media] early-media attach loop error`, error?.message || error);
  }
}

export function clearEarlyMediaAttachLoop(session) {
  if (session?.__earlyMediaAttachTimer) {
    clearInterval(session.__earlyMediaAttachTimer);
    session.__earlyMediaAttachTimer = null;
  }
}
