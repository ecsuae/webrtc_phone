import { nowISO, logLine } from "../desktopLogging.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";

import {
  createDesktopInviter,
  getDesktopOutboundDiagContext,
} from "./ext/desktopExtInviterFactory.js";

export function configureDesktopRemoteAudio(ui) {
  const audioEl = ui?.remoteAudio?.();
  if (!audioEl) return;
  audioEl.autoplay = true;
  audioEl.playsInline = true;
  audioEl.muted = false;
  audioEl.volume = 0.7;

  try {
    if (audioEl.__callMediaPlayObserved) return;
    audioEl.__callMediaPlayObserved = true;

    const emitAudioState = (type, msg) => {
      const ctx = audioEl.__callMediaDiagContext || {};
      sendCallMediaEvent({
        type,
        ...ctx,
        dir: "outbound",
        audioElMuted: typeof audioEl.muted === "boolean" ? audioEl.muted : undefined,
        audioElVolume: typeof audioEl.volume === "number" ? audioEl.volume : undefined,
        audioElReadyState: typeof audioEl.readyState === "number" ? audioEl.readyState : undefined,
        audioElPaused: typeof audioEl.paused === "boolean" ? audioEl.paused : undefined,
        audioElCurrentTime: typeof audioEl.currentTime === "number" ? audioEl.currentTime : undefined,
        msg,
      });
    };

    emitAudioState("remote-audio-ready-state", "remoteAudio initial state");
    emitAudioState("remote-audio-muted-state", "remoteAudio muted state");
    emitAudioState("remote-audio-volume-state", "remoteAudio volume state");

    audioEl.addEventListener("volumechange", () => {
      emitAudioState("remote-audio-volume-state", "remoteAudio volumechange");
      emitAudioState("remote-audio-muted-state", "remoteAudio muted state change");
    });
    audioEl.addEventListener("loadedmetadata", () => emitAudioState("remote-audio-ready-state", "remoteAudio loadedmetadata"));
    audioEl.addEventListener("canplay", () => emitAudioState("remote-audio-ready-state", "remoteAudio canplay"));
    audioEl.addEventListener("waiting", () => emitAudioState("remote-audio-ready-state", "remoteAudio waiting"));

    audioEl.addEventListener(
      "playing",
      () => {
        try {
          audioEl.__callMediaPlayed = true;
          if (audioEl.__callMediaNoPlayTimer) {
            clearTimeout(audioEl.__callMediaNoPlayTimer);
            audioEl.__callMediaNoPlayTimer = null;
          }
        } catch {}

        try {
          window.__callMediaRemoteAudioEl = audioEl;
        } catch {}

        const ctx = audioEl.__callMediaDiagContext || {};
        sendCallMediaEvent({
          type: "outbound-remote-audio-play-ok",
          ...ctx,
          dir: "outbound",
          audioPlayOk: true,
          msg: "remoteAudio is playing",
        });

        sendCallMediaEvent({
          type: "remote-audio-play-ok",
          ...ctx,
          dir: "outbound",
          audioPlayOk: true,
          msg: "remoteAudio is playing",
        });
      },
      { once: true }
    );

    audioEl.addEventListener(
      "error",
      () => {
        const ctx = audioEl.__callMediaDiagContext || {};
        sendCallMediaEvent({
          type: "outbound-remote-audio-play-failed",
          ...ctx,
          dir: "outbound",
          audioPlayOk: false,
          audioPlayError: "audio-element-error",
          msg: "remoteAudio element error",
        });

        sendCallMediaEvent({
          type: "remote-audio-play-failed",
          ...ctx,
          dir: "outbound",
          audioPlayOk: false,
          audioPlayError: "audio-element-error",
          msg: "remoteAudio element error",
        });
      },
      { once: true }
    );
  } catch {}
}


