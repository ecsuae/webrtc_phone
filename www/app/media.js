// www/app/media.js
import { nowISO } from "./config.js";
import { el } from "./dom.js";
import { logLine } from "./log.js";

let localAudioStream = null;

export function stopLocalAudioStream() {
  if (!localAudioStream) return;
  localAudioStream.getTracks().forEach((t) => t.stop());
  localAudioStream = null;
  logLine(`[${nowISO()}] [media] microphone stream stopped`);
}

export async function ensureMicAccess(setStatus) {
  if (!navigator.mediaDevices?.getUserMedia) {
    logLine(`[${nowISO()}] [media] getUserMedia not available`);
    return false;
  }
  if (localAudioStream) return true;

  try {
    localAudioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    logLine(`[${nowISO()}] [media] microphone permission granted`);
    return true;
  } catch (e) {
    logLine(`[${nowISO()}] [media] microphone permission denied`, e?.message || e);
    setStatus?.("Microphone permission denied");
    return false;
  }
}

export function getLocalStream() {
  return localAudioStream;
}

export function attachRemoteStream(stream) {
  if (!el.remoteAudio) return;
  el.remoteAudio.srcObject = stream;
  const p = el.remoteAudio.play();
  if (p?.catch) p.catch(() => {});
}