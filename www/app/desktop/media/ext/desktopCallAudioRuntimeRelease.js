import { nowISO, logLine } from "../../desktopLogging.js";
import {
  getLocalStream,
  getLocalAudioTrack,
  reportActiveAudioCapture,
  stopLocalAudioStream,
  getActiveAudioCaptureRegistrySnapshot,
} from "../../../media.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { emitDesktopMicOwnershipSnapshot, forceReleaseDesktopMicOwners } from "../desktopMicOwnershipTracker.js";

import {
  getDesktopCorrIdFromSession,
  getDesktopSipCallIdFromSession,
  logDesktopMic,
  postDesktopCallAudioTerminationCheck,
} from "./desktopCallAudioRuntimeHelpers.js";

export function releaseDesktopCallAudioImpl(state, timers, reason = "release", ctx = null) {
  state.lastReleaseReason = reason;
  state.releasedAt = nowISO();

  const session = ctx?.session || null;
  const corrId = ctx?.corrId || getDesktopCorrIdFromSession(session) || "?";
  const callId = ctx?.callId || getDesktopSipCallIdFromSession(session) || "?";
  const micId = ctx?.micId || "?";

  logDesktopMic(`[${nowISO()}] [desktop:mic] release requested corrId=${corrId} callId=${callId} micId=${micId} reason=${reason}`);

  try {
    reportActiveAudioCapture(`desktop:pre-release:${reason}`);
  } catch {}

  try {
    stopLocalAudioStream();
  } catch {}

  try {
    reportActiveAudioCapture(`desktop:post-release:${reason}`);
  } catch {}

  try {
    const reg = getActiveAudioCaptureRegistrySnapshot();
    const streamNow = getLocalStream();
    const trackNow = getLocalAudioTrack();
    sendCallMediaEvent({
      type: "desktop-audio-runtime-state",
      corrId,
      callId,
      micId,
      dir: ctx?.dir || "outbound",
      checkpoint: "post-release",
      activeCount: reg?.activeAudioTrackCount,
      activeTrackIds: reg?.activeAudioTrackIds,
      hasLocalStream: !!streamNow,
      localMicTrackId: trackNow?.id || null,
      localMicTrackReadyState: trackNow?.readyState || null,
      msg: "Desktop call-audio runtime state snapshot",
    });
  } catch {}

  try {
    const pc = session?.sessionDescriptionHandler?.peerConnection || null;
    const senders = pc?.getSenders?.() || [];
    const a = senders.find((sd) => sd?.track?.kind === "audio") || null;
    const senderHasTrack = !!a?.track;
    const senderTrackId = a?.track?.id ?? null;
    const senderTrackReadyState = a?.track?.readyState ?? null;
    const localMicTrackId = (() => {
      try {
        return session?.__desktopMicTrackId || null;
      } catch {
        return null;
      }
    })();
    const sameAsLocalMicTrack = !!(senderHasTrack && senderTrackId && localMicTrackId && senderTrackId === localMicTrackId);
    sendCallMediaEvent({
      type: "desktop-mic-final-check",
      corrId,
      callId,
      micId,
      dir: ctx?.dir || "outbound",
      checkpoint: "post-release",
      senderHasTrack,
      senderTrackId,
      senderTrackReadyState,
      sameAsLocalMicTrack,
      storedHasLocalStream: !!session?.__desktopLocalStream,
      storedLocalStreamTrackCount: (() => {
        try {
          return (session?.__desktopLocalStream?.getTracks?.() || []).length;
        } catch {
          return null;
        }
      })(),
      msg: "Desktop mic final state check after releaseDesktopCallAudio",
    });
  } catch {}

  try {
    forceReleaseDesktopMicOwners({
      corrId,
      callId,
      dir: ctx?.dir || "outbound",
      reason: `forceRelease:${reason}`,
    });
  } catch {}

  try {
    emitDesktopMicOwnershipSnapshot({
      corrId,
      callId,
      dir: ctx?.dir || "outbound",
      checkpoint: "post-release",
      reason,
    });
  } catch {}

  try {
    setTimeout(() => {
      try {
        emitDesktopMicOwnershipSnapshot({
          corrId,
          callId,
          dir: ctx?.dir || "outbound",
          checkpoint: "post-release-1500ms",
          reason,
        });
      } catch {}
    }, 1500);
  } catch {}

  logDesktopMic(`[${nowISO()}] [desktop:mic] release executed corrId=${corrId} callId=${callId} micId=${micId} reason=${reason} localStreamNow=no`);
  logLine(`[${nowISO()}] [desktop:call-audio] released reason=${reason}`);

  try {
    timers.postTermTimerSeq += 1;
    const seq = timers.postTermTimerSeq;
    timers.active.seq = seq;
    try {
      if (timers.active.t300) clearTimeout(timers.active.t300);
      if (timers.active.t1200) clearTimeout(timers.active.t1200);
    } catch {}

    timers.active.t300 = setTimeout(() => {
      try {
        if (timers.active.seq !== seq) return;
        postDesktopCallAudioTerminationCheck(session, corrId, callId, micId, 300);
      } catch {}
    }, 300);

    timers.active.t1200 = setTimeout(() => {
      try {
        if (timers.active.seq !== seq) return;
        postDesktopCallAudioTerminationCheck(session, corrId, callId, micId, 1200);
      } catch {}
    }, 1200);
  } catch {}
}
