import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { enforceCurrentAudioRoute } from "../ui/callControlAudioRoute.js?v=1773034001";
import { sendCallMediaEvent } from "../features/callMediaLog.js";

export function attachIncomingRemoteAudio(session, ui) {
  try {
    const audioEl = ui?.remoteAudio?.();
    const pc = session?.sessionDescriptionHandler?.peerConnection;
    if (!audioEl || !pc) {
      logLine(`[${nowISO()}] [incoming:media] attachRemoteAudio skipped: audioEl=${!!audioEl}, pc=${!!pc}`);
      console.log(`[${nowISO()}] [incoming:media] attachRemoteAudio skipped: audioEl=${!!audioEl}, pc=${!!pc}`);
      return;
    }

    if (pc.__incomingAudioBound) {
      logLine(`[${nowISO()}] [incoming:media] Already bound to this PC`);
      return;
    }

    pc.__incomingAudioBound = true;
    logLine(`[${nowISO()}] [incoming:media] Attaching remote audio handler`);
    console.log(`[${nowISO()}] [incoming:media] Attaching remote audio handler`);

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

      // Group A cleanup: ensure inbound leg has a compact AUDIO milestone row in summary,
      // even if we short-circuit due to sameTrack already playing.
      try {
        if (!pc.__incomingRemoteAudioAttachedEmitted) {
          pc.__incomingRemoteAudioAttachedEmitted = true;
          const ctx = (session && session.__callMediaDiag && typeof session.__callMediaDiag === 'object')
            ? session.__callMediaDiag
            : {};
          sendCallMediaEvent({
            type: 'remote-audio-attached',
            ...ctx,
            dir: 'inbound',
            hasRemoteStream: Boolean(stream),
            remoteAudioTrackCount: stream?.getAudioTracks?.()?.length,
            msg: `incoming/media bound ${trackKind} to audio element`,
          });
        }
      } catch {}

      // If the same track is already playing, do not spam play()/rebind.
      if (sameTrack && !audioEl.paused && audioEl.srcObject) {
        return;
      }

      // Avoid reloading the media element for the same track.
      if (!sameTrack) {
        audioEl.srcObject = stream;
      }

      logLine(`[${nowISO()}] [incoming:media] Remote ${trackKind} bound to audio element`);
      console.log(`[${nowISO()}] [incoming:media] Remote ${trackKind} bound to audio element`);
      try {
        console.log(
          `[${nowISO()}] [incoming:media] audioEl state paused=${audioEl.paused} muted=${audioEl.muted} volume=${audioEl.volume} hasSrc=${!!audioEl.srcObject}`
        );
      } catch {}
      const playPromise = audioEl.play?.();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise
          .then(() => logLine(`[${nowISO()}] [incoming:media] Audio playing`))
          .catch((err) => {
            logLine(`[${nowISO()}] [incoming:media] Play blocked: ${err?.name || err?.message || err}`);
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

      // Avoid aggressive route enforcement on Android; it can become noisy/re-entrant
      // and has previously caused instability/one-way audio symptoms.
      if (!/Android/i.test(navigator.userAgent || "")) {
        enforceCurrentAudioRoute(audioEl).catch((err) => {
          logLine(`[${nowISO()}] [incoming:media] audio route apply failed: ${err?.message || err}`);
        });
      }
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

    // Lightweight diagnostics (Android): confirm inbound RTP is flowing.
    if (/Android/i.test(navigator.userAgent || "") && !pc.__inboundAudioStatsBound) {
      pc.__inboundAudioStatsBound = true;
      let ticks = 0;
      const timer = setInterval(async () => {
        ticks += 1;
        try {
          const receiver = pc.getReceivers?.().find((r) => r.track && r.track.kind === "audio") || null;
          const track = receiver?.track || null;
          const trackLine =
            `[${nowISO()}] [incoming:media] [diag] recvTrack=` +
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
              const bytesLine = `[${nowISO()}] [incoming:media] [diag] inbound-audio bytesReceived=${inboundBytes}`;
              logLine(bytesLine);
              console.log(bytesLine);
            }
          }
        } catch (e) {
          const errLine = `[${nowISO()}] [incoming:media] [diag] stats error: ${e?.message || e}`;
          logLine(errLine);
          console.warn(errLine);
        }

        if (ticks >= 6 || session?.state === "Terminated") {
          clearInterval(timer);
        }
      }, 1000);
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
