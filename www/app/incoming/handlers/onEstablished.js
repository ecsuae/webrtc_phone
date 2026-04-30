import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { bindPeerConnection } from "../../pcDebug.js?v=1773033002";
import { stopIncomingAlert } from "../alert.js";
import { attachIncomingRemoteAudio } from "../media.js?v=1773032001";
import { dualSessionManager } from "../../features/dualSessionManager.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { readAppAudioRouteDiagSnapshot } from "../../ui/callControlAudioRoute.js?v=1773034001";
import { scheduleMediaStatsSnapshots } from "./pcStats.js";
import { getInboundDiagContext } from "./diag.js";
import { observeRemoteAudioPlay } from "./observeRemoteAudioPlay.js";

export function onIncomingEstablished(SIP, st, ui, invitation, callerUser, callerDisplay) {
  let wasAnswered = true;

  window.callHistory?.addCall?.(callerUser, "answered", 0, {
    sipCode: 200,
    sipReason: "OK",
  });

  stopIncomingAlert();

  st.session = invitation;
  ui.setStatus(`On call with ${callerDisplay}`);
  ui.setButtons();
  if (window.callTimer) window.callTimer.start();

  const _ctx = getInboundDiagContext(st, invitation);
  invitation.__callMediaDiag = _ctx;

  try {
    const audioEl = ui?.remoteAudio?.();
    if (audioEl) {
      try {
        audioEl.__callMediaDiagContext = _ctx;
      } catch {}
      try {
        window.__callMediaRemoteAudioEl = audioEl;
      } catch {}

      sendCallMediaEvent({
        type: "inbound-audio-element-state",
        ..._ctx,
        audioElMuted: typeof audioEl.muted === "boolean" ? audioEl.muted : undefined,
        audioElVolume: typeof audioEl.volume === "number" ? audioEl.volume : undefined,
        audioElReadyState: typeof audioEl.readyState === "number" ? audioEl.readyState : undefined,
        audioElPaused: typeof audioEl.paused === "boolean" ? audioEl.paused : undefined,
        audioElCurrentTime: typeof audioEl.currentTime === "number" ? audioEl.currentTime : undefined,
        msg: "Inbound remoteAudio state snapshot (onEstablished)",
      });
      sendCallMediaEvent({
        type: "inbound-play-attempt",
        ..._ctx,
        audioElMuted: typeof audioEl.muted === "boolean" ? audioEl.muted : undefined,
        audioElVolume: typeof audioEl.volume === "number" ? audioEl.volume : undefined,
        audioElReadyState: typeof audioEl.readyState === "number" ? audioEl.readyState : undefined,
        audioElPaused: typeof audioEl.paused === "boolean" ? audioEl.paused : undefined,
        msg: "Inbound playback attempt marker (onEstablished)",
      });
    }
  } catch {}

  try {
    sendCallMediaEvent({
      type: "inbound-audio-route-snapshot",
      ..._ctx,
      ...readAppAudioRouteDiagSnapshot(),
      msg: "Inbound audio route snapshot (onEstablished)",
    });
  } catch {}

  observeRemoteAudioPlay(ui, _ctx);
  attachIncomingRemoteAudio(invitation, ui);

  bindPeerConnection(invitation, "inbound", { aor: _ctx.aor, callId: _ctx.callId });

  try {
    if (invitation.__incomingRemoteAudioRetryTimer) {
      clearInterval(invitation.__incomingRemoteAudioRetryTimer);
      invitation.__incomingRemoteAudioRetryTimer = null;
    }
    if (!invitation.__incomingRemoteAudioRetryTimer) {
      let tries = 0;
      const t = setInterval(() => {
        tries += 1;
        try {
          if (invitation.__incomingRemoteAudioRetryTimer !== t) {
            clearInterval(t);
            return;
          }
          if (invitation?.state === SIP.SessionState.Terminated) {
            clearInterval(t);
            if (invitation.__incomingRemoteAudioRetryTimer === t) {
              invitation.__incomingRemoteAudioRetryTimer = null;
            }
            return;
          }
          const pc = invitation?.sessionDescriptionHandler?.peerConnection;
          const audioEl = ui?.remoteAudio?.();

          try {
            if (pc && !pc.__incomingRemoteAudioTrackAddedEmitted) {
              const receiver = pc.getReceivers?.().find((r) => r?.track && r.track.kind === "audio") || null;
              const track = receiver?.track || null;
              if (track) {
                pc.__incomingRemoteAudioTrackAddedEmitted = true;
                sendCallMediaEvent({
                  type: "remote-audio-track-added",
                  ..._ctx,
                  trackId: track.id,
                  trackMuted: typeof track.muted === "boolean" ? track.muted : undefined,
                  msg: "Inbound audio receiver track present (handlers retry)",
                });
              }
            }
          } catch {}

          if (!pc) {
            if (tries >= 10) {
              clearInterval(t);
              if (invitation.__incomingRemoteAudioRetryTimer === t) {
                invitation.__incomingRemoteAudioRetryTimer = null;
              }
            }
            return;
          }

          if (audioEl) {
            observeRemoteAudioPlay(ui, _ctx);
            attachIncomingRemoteAudio(invitation, ui);
          }

          if (pc.__incomingRemoteAudioAttachedEmitted || audioEl?.__callMediaPlayObserved) {
            clearInterval(t);
            if (invitation.__incomingRemoteAudioRetryTimer === t) {
              invitation.__incomingRemoteAudioRetryTimer = null;
            }
            return;
          }
          if (tries >= 10) {
            clearInterval(t);
            if (invitation.__incomingRemoteAudioRetryTimer === t) {
              invitation.__incomingRemoteAudioRetryTimer = null;
            }
          }
        } catch {
          if (tries >= 10) {
            try {
              clearInterval(t);
            } catch {}
            if (invitation.__incomingRemoteAudioRetryTimer === t) {
              invitation.__incomingRemoteAudioRetryTimer = null;
            }
          }
        }
      }, 250);
      invitation.__incomingRemoteAudioRetryTimer = t;
    }
  } catch {}

  try {
    const audioEl = ui?.remoteAudio?.();
    if (audioEl && !audioEl.__callMediaNoPlayTimer) {
      audioEl.__callMediaNoPlayTimer = setTimeout(() => {
        try {
          if (audioEl.__callMediaPlayed) return;
          sendCallMediaEvent({
            type: "no-remote-audio-play",
            ..._ctx,
            msg: "Remote audio did not start playing within 10s after establish",
          });
        } catch {}
      }, 10000);
    }
  } catch {}

  try {
    const pc = invitation?.sessionDescriptionHandler?.peerConnection;
    try {
      const hasPc = !!pc;
      const scheduled = pc ? !!pc.__mediaStatsScheduled : false;
      const line = `[${nowISO()}] [incoming:diag] Established: scheduleMediaStatsSnapshots reached pc=${hasPc} pc.__mediaStatsScheduled=${scheduled}`;
      logLine(line);
      console.log(line);
    } catch {}
    if (pc) scheduleMediaStatsSnapshots(pc, "inbound", _ctx);
  } catch {}

  sendCallMediaEvent({
    type: "call-established",
    ..._ctx,
    t_established: new Date().toISOString(),
    msg: "Inbound call established",
  });

  if (!dualSessionManager.primary) {
    dualSessionManager.setPrimary(st);
    logLine(`[${nowISO()}] [session:inbound] Registered as primary session`);
  }

  return true;
}
