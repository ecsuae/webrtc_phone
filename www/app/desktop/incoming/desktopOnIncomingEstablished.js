import { nowISO, logLine } from "../desktopLogging.js";
import { bindPeerConnection } from "../../pcDebug.js?v=1773033002";
import { dualSessionManager } from "../../features/dualSessionManager.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { readAppAudioRouteDiagSnapshot } from "../../ui/audioRoute/state.js";

import { scheduleMediaStatsSnapshots } from "./ext/desktopIncomingPcStats.js";
import { getInboundDiagContext } from "./ext/desktopIncomingDiag.js";
import { observeRemoteAudioPlay } from "./ext/desktopIncomingRemoteAudioObserve.js";

import { attachDesktopIncomingRemoteAudio } from "./desktopIncomingRemoteAudio.js";

export function onDesktopIncomingEstablished(SIP, st, ui, invitation, callerUser, callerDisplay) {
  window.callHistory?.addCall?.(callerUser, "answered", 0, {
    sipCode: 200,
    sipReason: "OK",
  });

  st.session = invitation;
  ui.setStatus(`On call with ${callerDisplay}`);
  ui.setButtons();
  if (window.callTimer) window.callTimer.start();

  const ctx = getInboundDiagContext(st, invitation);
  invitation.__callMediaDiag = ctx;

  try {
    const audioEl = ui?.remoteAudio?.();
    if (audioEl) {
      try {
        audioEl.__callMediaDiagContext = ctx;
      } catch {}
      try {
        globalThis.__callMediaRemoteAudioEl = audioEl;
      } catch {}

      sendCallMediaEvent({
        type: "inbound-audio-element-state",
        ...ctx,
        audioElMuted: typeof audioEl.muted === "boolean" ? audioEl.muted : undefined,
        audioElVolume: typeof audioEl.volume === "number" ? audioEl.volume : undefined,
        audioElReadyState: typeof audioEl.readyState === "number" ? audioEl.readyState : undefined,
        audioElPaused: typeof audioEl.paused === "boolean" ? audioEl.paused : undefined,
        audioElCurrentTime: typeof audioEl.currentTime === "number" ? audioEl.currentTime : undefined,
        msg: "Inbound remoteAudio state snapshot (desktop onEstablished)",
      });

      sendCallMediaEvent({
        type: "inbound-play-attempt",
        ...ctx,
        audioElMuted: typeof audioEl.muted === "boolean" ? audioEl.muted : undefined,
        audioElVolume: typeof audioEl.volume === "number" ? audioEl.volume : undefined,
        audioElReadyState: typeof audioEl.readyState === "number" ? audioEl.readyState : undefined,
        audioElPaused: typeof audioEl.paused === "boolean" ? audioEl.paused : undefined,
        msg: "Inbound playback attempt marker (desktop onEstablished)",
      });
    }
  } catch {}

  try {
    sendCallMediaEvent({
      type: "inbound-audio-route-snapshot",
      ...ctx,
      ...readAppAudioRouteDiagSnapshot(),
      msg: "Inbound audio route snapshot (desktop onEstablished)",
    });
  } catch {}

  observeRemoteAudioPlay(ui, ctx);
  attachDesktopIncomingRemoteAudio(invitation, ui);

  bindPeerConnection(invitation, "inbound", { aor: ctx.aor, callId: ctx.callId });

  try {
    if (invitation.__desktopIncomingRemoteAudioRetryTimer) {
      clearInterval(invitation.__desktopIncomingRemoteAudioRetryTimer);
      invitation.__desktopIncomingRemoteAudioRetryTimer = null;
    }

    if (!invitation.__desktopIncomingRemoteAudioRetryTimer) {
      let tries = 0;
      const t = setInterval(() => {
        tries += 1;
        try {
          if (invitation.__desktopIncomingRemoteAudioRetryTimer !== t) {
            clearInterval(t);
            return;
          }
          if (invitation?.state === SIP.SessionState.Terminated) {
            clearInterval(t);
            if (invitation.__desktopIncomingRemoteAudioRetryTimer === t) {
              invitation.__desktopIncomingRemoteAudioRetryTimer = null;
            }
            return;
          }

          const pc = invitation?.sessionDescriptionHandler?.peerConnection;
          const audioEl = ui?.remoteAudio?.();

          if (!pc) {
            if (tries >= 10) {
              clearInterval(t);
              if (invitation.__desktopIncomingRemoteAudioRetryTimer === t) {
                invitation.__desktopIncomingRemoteAudioRetryTimer = null;
              }
            }
            return;
          }

          if (audioEl) {
            observeRemoteAudioPlay(ui, ctx);
            attachDesktopIncomingRemoteAudio(invitation, ui);
          }

          if (pc.__desktopIncomingAudioBound || audioEl?.__callMediaPlayObserved) {
            clearInterval(t);
            if (invitation.__desktopIncomingRemoteAudioRetryTimer === t) {
              invitation.__desktopIncomingRemoteAudioRetryTimer = null;
            }
            return;
          }

          if (tries >= 10) {
            clearInterval(t);
            if (invitation.__desktopIncomingRemoteAudioRetryTimer === t) {
              invitation.__desktopIncomingRemoteAudioRetryTimer = null;
            }
          }
        } catch {
          if (tries >= 10) {
            try {
              clearInterval(t);
            } catch {}
            if (invitation.__desktopIncomingRemoteAudioRetryTimer === t) {
              invitation.__desktopIncomingRemoteAudioRetryTimer = null;
            }
          }
        }
      }, 250);
      invitation.__desktopIncomingRemoteAudioRetryTimer = t;
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
            ...ctx,
            msg: "Remote audio did not start playing within 10s after establish (desktop)",
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
      const line = `[${nowISO()}] [desktop:incoming:diag] Established: scheduleMediaStatsSnapshots reached pc=${hasPc} pc.__mediaStatsScheduled=${scheduled}`;
      logLine(line);
      console.log(line);
    } catch {}
    if (pc) scheduleMediaStatsSnapshots(pc, "inbound", ctx);
  } catch {}

  sendCallMediaEvent({
    type: "call-established",
    ...ctx,
    t_established: new Date().toISOString(),
    msg: "Inbound call established (desktop)",
  });

  if (!dualSessionManager.primary) {
    dualSessionManager.setPrimary(st);
    logLine(`[${nowISO()}] [session:inbound] Registered as primary session`);
  }

  return true;
}
