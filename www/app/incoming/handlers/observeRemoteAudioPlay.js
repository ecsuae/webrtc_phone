import { sendCallMediaEvent } from "../../features/callMediaLog.js";

export function observeRemoteAudioPlay(ui, ctx, { t_answerClicked } = {}) {
  try {
    const audioEl = ui?.remoteAudio?.();
    if (!audioEl) return;
    if (audioEl.__callMediaPlayObserved) return;
    audioEl.__callMediaPlayObserved = true;

    const emitAudioState = (type, msg) => {
      sendCallMediaEvent({
        type,
        ...ctx,
        t_answerClicked,
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
        sendCallMediaEvent({
          type: "remote-audio-play-ok",
          ...ctx,
          t_answerClicked,
          audioPlayOk: true,
          msg: "remoteAudio is playing",
        });
      },
      { once: true }
    );

    audioEl.addEventListener(
      "error",
      () => {
        sendCallMediaEvent({
          type: "remote-audio-play-failed",
          ...ctx,
          t_answerClicked,
          audioPlayOk: false,
          audioPlayError: "audio-element-error",
          msg: "remoteAudio element error",
        });
      },
      { once: true }
    );
  } catch {
    // no-op
  }
}
