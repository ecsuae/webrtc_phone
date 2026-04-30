import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { enforceCurrentAudioRoute } from "../../ui/callControlAudioRoute.js?v=1773034001";
import { readAppAudioRouteDiagSnapshot } from "../../ui/callControlAudioRoute.js?v=1773034001";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { requirePlatformAdapter } from "../../runtime/shared/platformAdapter.js";

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

      try {
        if (!pc.__incomingRemoteAudioAttachedEmitted) {
          pc.__incomingRemoteAudioAttachedEmitted = true;
          const ctx = (session && session.__callMediaDiag && typeof session.__callMediaDiag === "object")
            ? session.__callMediaDiag
            : {};

          try {
            const corrId = String(ctx?.corrId || '') || '';
            const prev = String(audioEl.__callMediaInboundPlayListenerCorrId || '') || '';
            const isNew = !!corrId && corrId !== prev;
            if (isNew) audioEl.__callMediaInboundPlayListenerCorrId = corrId;
            if (!audioEl.__callMediaInboundPlayListenerBound) {
              audioEl.__callMediaInboundPlayListenerBound = true;
              audioEl.addEventListener("playing", () => {
                try {
                  const c = audioEl.__callMediaDiagContext || ctx || {};
                  sendCallMediaEvent({
                    type: "remote-audio-play-ok",
                    ...c,
                    dir: "inbound",
                    audioPlayOk: true,
                    msg: "Inbound remoteAudio is playing (attachIncomingRemoteAudio listener)",
                  });
                  sendCallMediaEvent({
                    type: "inbound-play-resolved",
                    ...c,
                    dir: "inbound",
                    msg: "Inbound audioEl.play resolved (playing event)",
                  });
                } catch {}
              }, { once: false });
            }
          } catch {}

          try {
            audioEl.__callMediaDiagContext = ctx;
          } catch {}

          sendCallMediaEvent({
            type: "remote-audio-attached",
            ...ctx,
            dir: "inbound",
            hasRemoteStream: Boolean(stream),
            remoteAudioTrackCount: stream?.getAudioTracks?.()?.length,
            msg: `incoming/media bound ${trackKind} to audio element`,
          });

          try {
            sendCallMediaEvent({
              type: "inbound-audio-route-snapshot",
              ...ctx,
              dir: "inbound",
              ...readAppAudioRouteDiagSnapshot(),
              msg: "Inbound audio route snapshot (at remote-audio-attached)",
            });
          } catch {}
        }
      } catch {}

      if (sameTrack && !audioEl.paused && audioEl.srcObject) {
        return;
      }

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
      try {
        window.__callMediaRemoteAudioEl = audioEl;
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
          msg: "Inbound audioEl.play invoked",
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
          msg: "Inbound audio element state (at play attempt)",
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
            msg: "Inbound audioEl.play threw",
          });
        } catch {}
      }

      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            logLine(`[${nowISO()}] [incoming:media] Audio playing`);
            try {
              sendCallMediaEvent({
                type: "inbound-play-resolved",
                ...ctx,
                dir: "inbound",
                msg: "Inbound audioEl.play resolved",
              });
            } catch {}
          })
          .catch((err) => {
            logLine(`[${nowISO()}] [incoming:media] Play blocked: ${err?.name || err?.message || err}`);
            try {
              sendCallMediaEvent({
                type: "inbound-play-rejected",
                ...ctx,
                dir: "inbound",
                playErrorName: err?.name,
                playErrorMessage: err?.message,
                msg: "Inbound audioEl.play rejected",
              });
            } catch {}
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

      try {
        const a = requirePlatformAdapter();
        const allow = a?.audioRoute?.enforceOnIncoming;
        if (allow) {
          enforceCurrentAudioRoute(audioEl).catch((err) => {
            logLine(`[${nowISO()}] [incoming:media] audio route apply failed: ${err?.message || err}`);
          });
        }
      } catch {}
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

    const enableStats = (() => {
      try {
        const a = requirePlatformAdapter();
        return !!a?.mediaDiag?.enableInboundAudioStats;
      } catch {
        return false;
      }
    })();
    if (enableStats && !pc.__inboundAudioStatsBound) {
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
