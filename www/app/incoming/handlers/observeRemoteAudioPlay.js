import { sendCallMediaEvent } from "../../features/callMediaLog.js";

export function observeRemoteAudioPlay(ui, ctx, { t_answerClicked } = {}) {
  try {
    const audioEl = ui?.remoteAudio?.();
    if (!audioEl) return;

    // Always refresh the diag context so later events use the current call corrId/callId.
    // This avoids stale audio element listeners emitting rows tagged to older calls.
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

    // If this audio element persists across calls, do not let a previous call's
    // observer binding suppress instrumentation for the current call.
    const nextCorrId = (() => {
      try {
        return String(getCtx()?.corrId || '') || '';
      } catch {
        return '';
      }
    })();
    const prevCorrId = (() => {
      try {
        return String(audioEl.__callMediaObservedCorrId || '') || '';
      } catch {
        return '';
      }
    })();
    const isNewCall = !!nextCorrId && nextCorrId !== prevCorrId;

    // Always keep the global pointer current so stats ticks can attach audioEl state.
    try {
      window.__callMediaRemoteAudioEl = audioEl;
    } catch {}

    // For a new call, emit the inbound instrumentation even if listeners are already bound.
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

    // Operator-focused inbound playback instrumentation (additive; does not replace existing rows)
    emitInboundAudioElState("inbound-audio-element-state", "Inbound remoteAudio initial state");
    emitInboundAudioElState("inbound-play-attempt", "Inbound remoteAudio play attempt (observer bound)");
  } catch {
    // no-op
  }
}
