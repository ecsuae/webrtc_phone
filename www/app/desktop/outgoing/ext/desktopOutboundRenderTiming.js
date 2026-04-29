import { nowISO, logLine } from "../../desktopLogging.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { startDesktopOutboundAudioEnergyProbe } from "./desktopOutboundAudioEnergyProbe.js";

const AUDIO_EVENTS = [
  "loadedmetadata",
  "canplay",
  "playing",
  "stalled",
  "waiting",
  "error",
];

const EVENT_TIME_FIELDS = {
  loadedmetadata: "t_remote_audio_loadedmetadata",
  canplay: "t_remote_audio_canplay",
  playing: "t_remote_audio_playing",
  stalled: "t_remote_audio_stalled",
  waiting: "t_remote_audio_waiting",
  error: "t_remote_audio_error",
};

function basePayload(audioEl, extra = {}) {
  const ctx = audioEl?.__callMediaDiagContext || {};
  return {
    ...ctx,
    dir: "outbound",
    audioElMuted: typeof audioEl?.muted === "boolean" ? audioEl.muted : undefined,
    audioElVolume: typeof audioEl?.volume === "number" ? audioEl.volume : undefined,
    audioElReadyState: typeof audioEl?.readyState === "number" ? audioEl.readyState : undefined,
    audioElPaused: typeof audioEl?.paused === "boolean" ? audioEl.paused : undefined,
    audioElCurrentTime: typeof audioEl?.currentTime === "number" ? audioEl.currentTime : undefined,
    ...extra,
  };
}

function elapsedSinceCallStartMs(audioEl, atIso) {
  const start = audioEl?.__callMediaDiagContext?.t_callStart;
  const startMs = start ? Date.parse(start) : NaN;
  const atMs = atIso ? Date.parse(atIso) : NaN;
  return Number.isFinite(startMs) && Number.isFinite(atMs) ? Math.max(0, atMs - startMs) : undefined;
}

function renderTimingLabel(type, extra = {}) {
  if (type === "desktop-remote-track-received") return "remote-track";
  if (type === "desktop-remote-audio-src-set") return "srcObject-set";
  if (type === "desktop-remote-audio-play-attempt") return "play-attempt";
  if (type === "desktop-remote-audio-play-resolved") return "play-resolved";
  if (type === "desktop-remote-audio-play-rejected") return "play-rejected";
  if (type === "desktop-first-inbound-rtp") return "first-inbound-rtp";
  if (type === "desktop-remote-audio-element-event" && extra.audioElementEvent === "playing") return "audio-playing";
  if (type === "desktop-remote-audio-element-event" && extra.audioElementEvent === "loadedmetadata") return "audio-loadedmetadata";
  if (type === "desktop-remote-audio-element-event" && extra.audioElementEvent === "canplay") return "audio-canplay";
  if (type === "desktop-remote-audio-element-event" && extra.audioElementEvent === "waiting") return "audio-waiting";
  if (type === "desktop-remote-audio-element-event" && extra.audioElementEvent === "stalled") return "audio-stalled";
  if (type === "desktop-remote-audio-element-event" && extra.audioElementEvent === "error") return "audio-error";
  return type;
}

function logRenderTiming(label, payload) {
  const line =
    `[${payload.t_renderTiming}] [desktop:render-timing] ${label}` +
    ` elapsedMs=${payload.renderTimingElapsedMs ?? "n/a"}` +
    ` reason=${payload.remoteAudioBindReason || "n/a"}` +
    ` readyState=${payload.audioElReadyState ?? "n/a"}` +
    ` paused=${payload.audioElPaused ?? "n/a"}`;
  logLine(line);
  console.log(line);
}

function emitTiming(audioEl, type, timeField, extra = {}) {
  const t_renderTiming = nowISO();
  const renderTimingElapsedMs = elapsedSinceCallStartMs(audioEl, t_renderTiming);
  const payload = basePayload(audioEl, {
    [timeField]: t_renderTiming,
    t_renderTiming,
    renderTimingElapsedMs,
    ...extra,
  });
  sendCallMediaEvent({
    type,
    ...payload,
  });
  logRenderTiming(renderTimingLabel(type, extra), payload);
}

function installAudioElementTiming(audioEl) {
  if (!audioEl || audioEl.__desktopOutboundRenderTimingBound) return;
  audioEl.__desktopOutboundRenderTimingBound = true;

  AUDIO_EVENTS.forEach((eventName) => {
    audioEl.addEventListener(eventName, () => {
      emitTiming(audioEl, "desktop-remote-audio-element-event", EVENT_TIME_FIELDS[eventName], {
        audioElementEvent: eventName,
        msg: `remoteAudio ${eventName}`,
      });
    });
  });
}

export function observeDesktopOutboundRemoteAudio(session, audioEl, detail = {}) {
  installAudioElementTiming(audioEl);
  startDesktopOutboundAudioEnergyProbe(session, audioEl);

  const track = detail.track || null;
  emitTiming(audioEl, "desktop-remote-track-received", "t_remote_track_received", {
    remoteTrackKind: detail.trackKind || track?.kind,
    remoteTrackId: track?.id,
    remoteTrackMuted: track?.muted,
    remoteTrackReadyState: track?.readyState,
    remoteAudioBindReason: detail.reason,
  });

  if (detail.srcChanged) {
    emitTiming(audioEl, "desktop-remote-audio-src-set", "t_remote_audio_src_set", {
      remoteStreamId: detail.stream?.id,
      remoteAudioBindReason: detail.reason,
    });
  }

  emitTiming(audioEl, "desktop-remote-audio-play-attempt", "t_remote_audio_play_attempt", {
    remoteAudioBindReason: detail.reason,
  });

  const playPromise = detail.playPromise;
  if (playPromise && typeof playPromise.then === "function") {
    playPromise.then(
      () => emitTiming(audioEl, "desktop-remote-audio-play-resolved", "t_remote_audio_play_resolved"),
      (error) => emitTiming(audioEl, "desktop-remote-audio-play-rejected", "t_remote_audio_play_rejected", {
        errorName: error?.name,
        errorMessage: error?.message,
      })
    );
  }
}
