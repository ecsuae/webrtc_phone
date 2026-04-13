import { nowISO, logLine } from "../desktopLogging.js";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "../../media.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import {
  ensureDesktopAudioSenderHasLiveTrack,
  getDesktopLocalAudioTrackFromStream,
  snapshotDesktopLocalAudioTrack,
  waitForDesktopLocalAudioPeerConnection,
} from "./ext/desktopLocalAudioSessionHelpers.js";

let last = {
  acquiredAt: null,
  releasedAt: null,
  lastAcquireReason: null,
  lastReleaseReason: null,
  lastTrack: null,
  lastTrackEnabled: null,
  lastTrackReadyState: null,
  lastAttachReason: null,
  lastAttachResult: null,
};



export function getDesktopLocalAudioDiag() {
  return { ...last };
}

export async function acquireDesktopLocalAudio(ui, reason = "call") {
  last.lastAcquireReason = reason;

  try {
    stopLocalAudioStream();
  } catch {}

  const ok = await ensureMicAccess(ui?.setStatus);
  if (!ok) {
    last.lastAttachResult = "mic-access-denied";
    return { ok: false, reason: "mic-access-denied" };
  }

  const stream = getLocalStream();
  const track = getDesktopLocalAudioTrackFromStream(getLocalStream);
  const snap = snapshotDesktopLocalAudioTrack(track);

  last.acquiredAt = nowISO();
  last.lastTrack = snap;
  last.lastTrackEnabled = snap.enabled;
  last.lastTrackReadyState = snap.readyState;

  if (!track) {
    logLine(`[${nowISO()}] [desktop:local-audio] ERROR no local audio track after ensureMicAccess()`);
    try {
      ui?.setStatus?.("Microphone not available");
    } catch {}
    return { ok: false, reason: "no-local-track" };
  }

  try {
    track.enabled = true;
  } catch {}

  const after = snapshotDesktopLocalAudioTrack(track);
  if (after.enabled === false) {
    try {
      ui?.setStatus?.("Warning: microphone is muted");
    } catch {}
  }

  logLine(
    `[${nowISO()}] [desktop:local-audio] acquired reason=${reason} trackId=${after.id || "?"} enabled=${after.enabled} readyState=${after.readyState}`
  );

  return { ok: true, stream, track, trackSnapshot: after };
}

export async function attachDesktopLocalAudioToSession(session, ui, reason = "attach") {
  last.lastAttachReason = reason;

  const stream = getLocalStream();
  const track = getDesktopLocalAudioTrackFromStream(getLocalStream);

  if (!stream || !track) {
    last.lastAttachResult = "missing-local-stream";
    return { ok: false, reason: "missing-local-stream" };
  }

  const pc = await waitForDesktopLocalAudioPeerConnection(session);
  if (!pc) {
    last.lastAttachResult = "missing-pc";
    logLine(`[${nowISO()}] [desktop:local-audio] attach skipped: no peerConnection (reason=${reason})`);
    return { ok: false, reason: "missing-pc" };
  }

  try {
    track.enabled = true;
  } catch {}

  const res = await ensureDesktopAudioSenderHasLiveTrack(pc, stream, track);
  last.lastAttachResult = res.ok ? res.action : res.reason;

  const snap = snapshotDesktopLocalAudioTrack(track);
  logLine(
    `[${nowISO()}] [desktop:local-audio] attach result=${last.lastAttachResult} trackId=${snap.id || "?"} enabled=${snap.enabled} readyState=${snap.readyState}`
  );

  if (!res.ok) {
    try {
      ui?.setStatus?.("Warning: microphone not sending");
    } catch {}
  }

  return { ok: !!res.ok, ...res };
}

export function releaseDesktopLocalAudio(reason = "release") {
  last.lastReleaseReason = reason;
  last.releasedAt = nowISO();

  try {
    stopLocalAudioStream();
  } catch {}

  logLine(`[${nowISO()}] [desktop:local-audio] released reason=${reason}`);
}
