import { enableAudioOutputRouteDiag, enableRenderDiag } from "./diagFlags.js";
import { readAudioOutputSnapshot } from "./audioOutputDiag/readSnapshot.js";
import { emitAudioOutputSnapshot } from "./audioOutputDiag/outputEvents.js";
import { startOutboundRenderDiagInternal } from "./audioOutputDiag/renderEvents.js";

export function startOutboundAudioOutputDiag(audioEl, ctx) {
  if (!audioEl || audioEl.__callMediaAudioOutputDiagStarted) return;
  audioEl.__callMediaAudioOutputDiagStarted = true;
  if (!enableAudioOutputRouteDiag()) return;

  try {
    readAudioOutputSnapshot(audioEl).then((snap) => {
      try {
        emitAudioOutputSnapshot({ type: "audio-output-route", ctx, snap, msg: "Audio output route snapshot" });
      } catch {}
    });
  } catch {}

  try {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.addEventListener !== "function") return;
    const handler = () => {
      try {
        readAudioOutputSnapshot(audioEl).then((snap) => {
          try {
            emitAudioOutputSnapshot({ type: "audio-output-route-change", ctx, snap, msg: "Audio output devicechange observed" });
          } catch {}
        });
      } catch {}
    };
    audioEl.__callMediaDeviceChangeHandler = handler;
    navigator.mediaDevices.addEventListener("devicechange", handler);
  } catch {}
}

export function startOutboundRenderDiag(audioEl, ctx) {
  if (!audioEl || audioEl.__callMediaRenderDiagTimer) return;
  if (!enableRenderDiag()) return;

  startOutboundRenderDiagInternal(audioEl, ctx);
}

export function stopOutboundDiag(audioEl) {
  if (!audioEl) return;
  try {
    if (audioEl.__callMediaRenderDiagTimer) {
      clearInterval(audioEl.__callMediaRenderDiagTimer);
      audioEl.__callMediaRenderDiagTimer = null;
    }
  } catch {}

  try {
    const handler = audioEl.__callMediaDeviceChangeHandler;
    if (handler && navigator.mediaDevices && typeof navigator.mediaDevices.removeEventListener === "function") {
      navigator.mediaDevices.removeEventListener("devicechange", handler);
    }
    audioEl.__callMediaDeviceChangeHandler = null;
  } catch {}
}
