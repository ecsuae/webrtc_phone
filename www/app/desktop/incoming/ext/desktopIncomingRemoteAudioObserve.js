import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

export function observeRemoteAudioPlay(ui, ctx, { t_answerClicked } = {}) {
  try {
    const audioEl = ui?.remoteAudio?.();
    if (!audioEl) return;

    try {
      audioEl.__callMediaDiagContext = ctx;
    } catch {}

    const getCtx = () => {
      try {
        const c = audioEl.__callMediaDiagContext;
        return (c && typeof c === "object") ? c : (ctx || {});
      } catch {
        return ctx || {};
      }
    };

    const emitInboundAudioElState = (type, msg) => {
      try {
        sendCallMediaEvent({
          type,
          ...getCtx(),
          t_answerClicked,
          audioElMuted: typeof audioEl.muted === "boolean" ? audioEl.muted : undefined,
          audioElVolume: typeof audioEl.volume === "number" ? audioEl.volume : undefined,
          audioElReadyState: typeof audioEl.readyState === "number" ? audioEl.readyState : undefined,
          audioElPaused: typeof audioEl.paused === "boolean" ? audioEl.paused : undefined,
          audioElCurrentTime: typeof audioEl.currentTime === "number" ? audioEl.currentTime : undefined,
          msg,
        });
      } catch {}
    };

    const nextCorrId = (() => {
      try {
        return String(getCtx()?.corrId || "") || "";
      } catch {
        return "";
      }
    })();
    const prevCorrId = (() => {
      try {
        return String(audioEl.__callMediaObservedCorrId || "") || "";
      } catch {
        return "";
      }
    })();
    const isNewCall = !!nextCorrId && nextCorrId !== prevCorrId;

    try {
      window.__callMediaRemoteAudioEl = audioEl;
    } catch {}

    if (isNewCall) {
      try {
        audioEl.__callMediaObservedCorrId = nextCorrId;
      } catch {}
      emitInboundAudioElState("inbound-audio-element-state", "Inbound remoteAudio state (new call)");
      emitInboundAudioElState("inbound-play-attempt", "Inbound remoteAudio play attempt (new call observer refresh)");
    }

    if (audioEl.__callMediaPlayObserved) return;
    audioEl.__callMediaPlayObserved = true;
    try {
      if (nextCorrId) audioEl.__callMediaObservedCorrId = nextCorrId;
    } catch {}

    const emitAudioState = (type, msg) => {
      sendCallMediaEvent({
        type,
        ...getCtx(),
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
          ...getCtx(),
          t_answerClicked,
          audioPlayOk: true,
          msg: "remoteAudio is playing",
        });

        emitInboundAudioElState(
          "inbound-play-resolved",
          "Inbound audioEl.play resolved (playing event observed)"
        );
      },
      { once: true }
    );

    audioEl.addEventListener(
      "error",
      () => {
        sendCallMediaEvent({
          type: "remote-audio-play-failed",
          ...getCtx(),
          t_answerClicked,
          audioPlayOk: false,
          audioPlayError: "audio-element-error",
          msg: "remoteAudio element error",
        });

        emitInboundAudioElState(
          "inbound-play-rejected",
          "Inbound audio element error while attempting playback"
        );
      },
      { once: true }
    );

    emitInboundAudioElState("inbound-audio-element-state", "Inbound remoteAudio initial state");
    emitInboundAudioElState("inbound-play-attempt", "Inbound remoteAudio play attempt (observer bound)");
  } catch {
    // no-op
  }
}
