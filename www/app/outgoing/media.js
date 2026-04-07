import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { enforceCurrentAudioRoute } from "../ui/callControlAudioRoute.js?v=1773034001";
import { requirePlatformAdapter } from "../runtime/shared/platformAdapter.js";

export function attachRemoteAudio(session, ui) {
  try {
    const audioEl = ui?.remoteAudio?.();
    const pc = session?.sessionDescriptionHandler?.peerConnection;
    if (!audioEl || !pc) {
      logLine(`[${nowISO()}] [outgoing:media] attachRemoteAudio skipped: audioEl=${!!audioEl}, pc=${!!pc}`);
      console.log(`[${nowISO()}] [outgoing:media] attachRemoteAudio skipped: audioEl=${!!audioEl}, pc=${!!pc}`);
      return;
    }

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

      // If the same track is already playing, do not spam play()/route enforcement.
      if (sameTrack && !audioEl.paused && audioEl.srcObject) {
        return;
      }

      // Avoid reloading the media element for the same track. Reloads during
      // re-INVITE can interrupt playback and cause one-way/no audio symptoms.
      if (!sameTrack) {
        audioEl.srcObject = stream;
      }

      console.log(`[${nowISO()}] [outgoing:media] Remote ${trackKind} bound to audio element (reason=${reason})`);
      try {
        console.log(
          `[${nowISO()}] [outgoing:media] audioEl state paused=${audioEl.paused} muted=${audioEl.muted} volume=${audioEl.volume} hasSrc=${!!audioEl.srcObject}`
        );
      } catch {}

      const p = audioEl.play?.();
      if (p && typeof p.catch === "function") {
        p.catch((e) => {
          console.warn("[EARLY-MEDIA] Play blocked:", e?.name, e?.message);
          try {
            audioEl.muted = true;
            const p2 = audioEl.play?.();
            if (p2 && typeof p2.finally === "function") {
              p2.finally(() => {
                audioEl.muted = false;
              });
            } else {
              audioEl.muted = false;
            }
          } catch {}
        });
      }

      enforceCurrentAudioRoute(audioEl).catch((err) => {
        console.warn("[audio-route] outgoing apply failed:", err?.message || err);
      });
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

    // Lightweight diagnostics (Android): confirm inbound RTP is flowing.
    const enableStats = (() => {
      try {
        const a = requirePlatformAdapter();
        return !!a?.mediaDiag?.enableInboundAudioStats;
      } catch {
        return false;
      }
    })();
    if (enableStats && !pc.__outboundInboundAudioStatsBound) {
      pc.__outboundInboundAudioStatsBound = true;
      let ticks = 0;
      const timer = setInterval(async () => {
        ticks += 1;
        try {
          const receiver = pc.getReceivers?.().find((r) => r.track && r.track.kind === "audio") || null;
          const track = receiver?.track || null;
          const trackLine =
            `[${nowISO()}] [outgoing:media] [diag] recvTrack=` +
            `${!!track} muted=${track?.muted} enabled=${track?.enabled} readyState=${track?.readyState}`;
          logLine(trackLine);
          console.log(trackLine);

          if (typeof pc.getStats === "function") {
            const stats = await pc.getStats();
            let inboundBytes = null;
            stats.forEach((r) => {
              if (r.type === "inbound-rtp" && r.kind === "audio") {
                if (typeof r.bytesReceived === "number") inboundBytes = r.bytesReceived;
              }
            });
            if (inboundBytes !== null) {
              const bytesLine = `[${nowISO()}] [outgoing:media] [diag] inbound-audio bytesReceived=${inboundBytes}`;
              logLine(bytesLine);
              console.log(bytesLine);
            }
          }
        } catch (e) {
          const errLine = `[${nowISO()}] [outgoing:media] [diag] stats error: ${e?.message || e}`;
          logLine(errLine);
          console.warn(errLine);
        }

        if (ticks >= 6 || session?.state === "Terminated") {
          clearInterval(timer);
        }
      }, 1000);
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
