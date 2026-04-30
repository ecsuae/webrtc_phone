import { nowISO, logLine } from "../desktopLogging.js";
import { getLocalStream, getLocalAudioTrack, ensureMicAccessTagged, reportActiveAudioCapture, stopLocalAudioStream, getActiveAudioCaptureRegistrySnapshot } from "../../media.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { emitDesktopMicOwnershipSnapshot, forceReleaseDesktopMicOwners } from "./desktopMicOwnershipTracker.js";
import {
  getDesktopCorrIdFromSession,
  getDesktopSipCallIdFromSession,
  logDesktopMic,
  postDesktopCallAudioTerminationCheck,
  snapshotDesktopAudioTrack,
  snapshotDesktopAudioTrackSettings,
} from "./ext/desktopCallAudioRuntimeHelpers.js";
import { releaseDesktopCallAudioImpl } from "./ext/desktopCallAudioRuntimeRelease.js";

let last = {
  acquiredAt: null,
  releasedAt: null,
  lastAcquireReason: null,
  lastReleaseReason: null,
  lastAttachReason: null,
  lastAttachResult: null,
  lastTrack: null,
  lastSender: null,
  lastTransceiver: null,
};

let _micInstanceSeq = 0;
let _postTermTimerSeq = 0;
let _activePostTermTimers = { t300: null, t1200: null, seq: 0 };



export function getDesktopCallAudioDiag() {
  return { ...last };
}

export async function acquireDesktopCallAudio(ui, reason = "call") {
  last.lastAcquireReason = reason;

  const micId = (() => {
    try {
      _micInstanceSeq += 1;
      return `m-${_micInstanceSeq}`;
    } catch {
      return "m-?";
    }
  })();

  logDesktopMic(`[${nowISO()}] [desktop:mic] acquire start micId=${micId} reason=${reason}`);

  try {
    stopLocalAudioStream();
  } catch {}

  try {
    reportActiveAudioCapture(`desktop:post-release:${reason}`);
  } catch {}

  const ok = await ensureMicAccessTagged(ui?.setStatus, `desktopCallAudioRuntime:${reason}`);
  if (!ok) {
    last.lastAttachResult = "mic-access-denied";
    return { ok: false, reason: "mic-access-denied" };
  }

  const stream = getLocalStream();
  const track = getLocalAudioTrack();
  if (!track) {
    logDesktopMic(`[${nowISO()}] [desktop:mic] acquire fail micId=${micId} reason=${reason} err=no-local-track`);
    try {
      ui?.setStatus?.("Microphone not available");
    } catch {}
    return { ok: false, reason: "no-local-track" };
  }

  try {
    track.enabled = true;
  } catch {}

  const snap = snapshotDesktopAudioTrack(track);
  const settings = snapshotDesktopAudioTrackSettings(track);
  last.acquiredAt = nowISO();
  last.lastTrack = snap;

  logDesktopMic(
    `[${nowISO()}] [desktop:mic] acquire ok micId=${micId} reason=${reason} streamId=${stream?.id || "?"} trackId=${snap.id || "?"} label=${snap.label || "?"} enabled=${snap.enabled} muted=${snap.muted} readyState=${snap.readyState}`
  );
  if (settings) {
    logDesktopMic(
      `[${nowISO()}] [desktop:mic] acquire settings micId=${micId} deviceId=${settings.deviceId || "?"} sampleRate=${settings.sampleRate ?? "?"} channelCount=${settings.channelCount ?? "?"} echoCancellation=${settings.echoCancellation ?? "?"} noiseSuppression=${settings.noiseSuppression ?? "?"} autoGainControl=${settings.autoGainControl ?? "?"}`
    );
  }

  return { ok: true, stream, track, trackSnapshot: snap, micId };
}

export async function attachDesktopCallAudioToSession(session, ui, reason = "attach", ctx = null) {
  last.lastAttachReason = reason;
  last.lastAttachResult = "no-op-restored";
  logLine(`[${nowISO()}] [desktop:call-audio] attach no-op reason=${reason} - using SIP.js localMediaStream`);
  return { ok: true, reason: "no-op-restored" };
}

export function bindDesktopCallAudioReleaseOnTerminate(SIP, session, reason = "terminated") {
  try {
    if (!session || session.__desktopCallAudioReleaseBound) return;
    session.__desktopCallAudioReleaseBound = true;
    session.stateChange?.addListener?.((s) => {
      try {
        if (s === SIP.SessionState.Terminated) releaseDesktopCallAudio(reason, { session });
      } catch {}
    });
  } catch {}
}



export function releaseDesktopCallAudio(reason = "release", ctx = null) {
  releaseDesktopCallAudioImpl(last, {
    postTermTimerSeq: _postTermTimerSeq,
    set postTermTimerSeq(v) {
      _postTermTimerSeq = v;
    },
    active: _activePostTermTimers,
  }, reason, ctx);
}
