import { nowISO, logLine } from "../../desktopLogging.js";
import { getLocalStream, getLocalAudioTrack } from "../../../media.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

export function snapshotDesktopAudioTrack(track) {
  try {
    return {
      id: track?.id || null,
      label: track?.label || null,
      enabled: typeof track?.enabled === "boolean" ? track.enabled : null,
      readyState: track?.readyState || null,
      muted: typeof track?.muted === "boolean" ? track.muted : null,
    };
  } catch {
    return { id: null, label: null, enabled: null, readyState: null, muted: null };
  }
}

export function snapshotDesktopAudioTrackSettings(track) {
  try {
    if (!track || typeof track.getSettings !== "function") return null;
    const s = track.getSettings() || {};
    return {
      deviceId: s.deviceId ?? null,
      sampleRate: s.sampleRate ?? null,
      channelCount: s.channelCount ?? null,
      echoCancellation: s.echoCancellation ?? null,
      noiseSuppression: s.noiseSuppression ?? null,
      autoGainControl: s.autoGainControl ?? null,
    };
  } catch {
    return null;
  }
}

export function getDesktopCorrIdFromSession(session) {
  try {
    const v = session?.__webrtcCorrId;
    if (typeof v === "string" && v) return v;
  } catch {}
  return null;
}

export function getDesktopSipCallIdFromSession(session) {
  try {
    const cid = session?.outgoingRequestMessage?.callId || session?.request?.callId || null;
    return typeof cid === "string" && cid ? cid : null;
  } catch {
    return null;
  }
}

export function logDesktopMic(line) {
  try {
    logLine(line);
  } catch {}
}

export function postDesktopCallAudioTerminationCheck(session, corrId, callId, micId, whenMs) {
  try {
    const stream = getLocalStream();
    const track = getLocalAudioTrack();
    const ts = nowISO();

    const localStreamTrackIds = (() => {
      try {
        const ids = (stream?.getTracks?.() || []).map((t) => t?.id || null).filter(Boolean);
        return ids;
      } catch {
        return undefined;
      }
    })();

    const localStreamTrackCount = (() => {
      try {
        if (!Array.isArray(localStreamTrackIds)) return undefined;
        return localStreamTrackIds.length;
      } catch {
        return undefined;
      }
    })();

    let senderHasTrack = false;
    let senderTrackId = null;
    let senderTrackReadyState = null;
    let senderTrackEnabled = null;
    let senderTrackMuted = null;
    let senderStateSource = "live";
    let senderStreamIds = undefined;
    let pcState = null;
    try {
      const pc = session?.sessionDescriptionHandler?.peerConnection || null;
      if (!pc) {
        senderStateSource = "no-pc";
      } else {
        pcState = pc?.signalingState || null;
        const senders = pc?.getSenders?.() || [];
        const a = senders.find((sd) => sd?.track?.kind === "audio") || null;
        senderHasTrack = !!a?.track;
        senderTrackId = a?.track?.id ?? null;
        senderTrackReadyState = a?.track?.readyState ?? null;
        senderTrackEnabled = (typeof a?.track?.enabled === "boolean") ? a.track.enabled : null;
        senderTrackMuted = (typeof a?.track?.muted === "boolean") ? a.track.muted : null;
        try {
          const ss = a?.getStreams?.() || [];
          senderStreamIds = ss.map((s) => s?.id || null).filter(Boolean);
        } catch {}
      }
    } catch {
      senderStateSource = "live";
    }

    const localMicTrackId = (() => {
      try {
        return session?.__desktopMicTrackId || null;
      } catch {
        return null;
      }
    })();

    const localMicStreamId = (() => {
      try {
        return stream?.id || session?.__desktopMicStreamId || null;
      } catch {
        return stream?.id || null;
      }
    })();
    const sameAsLocalMicTrack = !!(senderHasTrack && senderTrackId && localMicTrackId && senderTrackId === localMicTrackId);

    try {
      sendCallMediaEvent({
        type: whenMs === 300 ? "desktop-post-term-check-300ms" : "desktop-post-term-check-1200ms",
        corrId,
        callId,
        micId,
        dir: "outbound",
        checkpoint: whenMs === 300 ? "post-term-check-300ms" : "post-term-check-1200ms",
        localMicTrackId: localMicTrackId || undefined,
        senderStateSource,
        senderHasTrack,
        senderTrackId,
        senderTrackReadyState,
        senderTrackEnabled: (typeof senderTrackEnabled === "boolean") ? senderTrackEnabled : undefined,
        senderTrackMuted: (typeof senderTrackMuted === "boolean") ? senderTrackMuted : undefined,
        senderStreamIds,
        sameAsLocalMicTrack,
        localMicStreamId: localMicStreamId || undefined,
        localStreamTrackIds,
        localStreamTrackCount,
        pcSignalingState: pcState || undefined,
        reason: `post-term-check-${whenMs}ms`,
        msg: `Post termination check ${whenMs}ms`,
      });
    } catch {}

    logDesktopMic(
      `[${ts}] [desktop:mic] post-term-check t=${whenMs}ms corrId=${corrId} callId=${callId} micId=${micId} localStream=${stream ? "yes" : "no"} localTrackId=${track?.id || "?"} localTrackState=${track?.readyState || "?"} senderTrackId=${senderTrackId || "?"} pc.signalingState=${pcState || "?"}`
    );
  } catch {}
}
