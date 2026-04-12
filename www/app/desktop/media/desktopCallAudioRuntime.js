import { nowISO, logLine } from "../desktopLogging.js";
import { getLocalStream, getLocalAudioTrack, ensureMicAccessTagged, reportActiveAudioCapture, stopLocalAudioStream } from "../../media.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";

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

function snapshotTrack(track) {
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

function snapshotTrackSettings(track) {
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

function getCorrIdFromSession(session) {
  try {
    const v = session?.__webrtcCorrId;
    if (typeof v === "string" && v) return v;
  } catch {}
  return null;
}

function getSipCallIdFromSession(session) {
  try {
    const cid = session?.outgoingRequestMessage?.callId || session?.request?.callId || null;
    return typeof cid === "string" && cid ? cid : null;
  } catch {
    return null;
  }
}

function logMic(line) {
  try {
    logLine(line);
  } catch {}
}

function snapshotSender(sender) {
  try {
    return {
      hasSender: !!sender,
      trackId: sender?.track?.id || null,
      kind: sender?.track?.kind || null,
    };
  } catch {
    return { hasSender: false, trackId: null, kind: null };
  }
}

function snapshotTransceiver(t) {
  try {
    return {
      hasTransceiver: !!t,
      mid: t?.mid ?? null,
      direction: t?.direction ?? null,
      currentDirection: t?.currentDirection ?? null,
      senderTrackId: t?.sender?.track?.id || null,
      receiverTrackId: t?.receiver?.track?.id || null,
    };
  } catch {
    return {
      hasTransceiver: false,
      mid: null,
      direction: null,
      currentDirection: null,
      senderTrackId: null,
      receiverTrackId: null,
    };
  }
}

function readRms01(analyser, buf) {
  try {
    if (!analyser || !buf) return null;
    analyser.getByteTimeDomainData(buf);
    let sumSq = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const v = (buf[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / buf.length);
    if (!Number.isFinite(rms)) return null;
    return Math.max(0, Math.min(1, rms));
  } catch {
    return null;
  }
}

async function waitForPeerConnection(session, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pc = session?.sessionDescriptionHandler?.peerConnection || null;
    if (pc) return pc;
    await new Promise((r) => setTimeout(r, 80));
  }
  return null;
}

function pickAudioTransceiver(pc) {
  try {
    const trs = pc?.getTransceivers?.() || [];
    const audio = trs.filter((t) => t?.receiver?.track?.kind === "audio" || t?.sender?.track?.kind === "audio");
    return audio.find((t) => String(t?.mid || "") === "0") || audio[0] || null;
  } catch {
    return null;
  }
}

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

  logMic(`[${nowISO()}] [desktop:mic] acquire start micId=${micId} reason=${reason}`);

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
    logMic(`[${nowISO()}] [desktop:mic] acquire fail micId=${micId} reason=${reason} err=no-local-track`);
    try {
      ui?.setStatus?.("Microphone not available");
    } catch {}
    return { ok: false, reason: "no-local-track" };
  }

  try {
    track.enabled = true;
  } catch {}

  const snap = snapshotTrack(track);
  const settings = snapshotTrackSettings(track);
  last.acquiredAt = nowISO();
  last.lastTrack = snap;

  logMic(
    `[${nowISO()}] [desktop:mic] acquire ok micId=${micId} reason=${reason} streamId=${stream?.id || "?"} trackId=${snap.id || "?"} label=${snap.label || "?"} enabled=${snap.enabled} muted=${snap.muted} readyState=${snap.readyState}`
  );
  if (settings) {
    logMic(
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

function postTerminationCheck(session, corrId, callId, micId, whenMs) {
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

    logMic(
      `[${ts}] [desktop:mic] post-term-check t=${whenMs}ms corrId=${corrId} callId=${callId} micId=${micId} localStream=${stream ? "yes" : "no"} localTrackId=${track?.id || "?"} localTrackState=${track?.readyState || "?"} senderTrackId=${senderTrackId || "?"} pc.signalingState=${pcState || "?"}`
    );
  } catch {}
}

export function releaseDesktopCallAudio(reason = "release", ctx = null) {
  last.lastReleaseReason = reason;
  last.releasedAt = nowISO();

  const session = ctx?.session || null;
  const corrId = ctx?.corrId || getCorrIdFromSession(session) || "?";
  const callId = ctx?.callId || getSipCallIdFromSession(session) || "?";
  const micId = ctx?.micId || "?";

  logMic(`[${nowISO()}] [desktop:mic] release requested corrId=${corrId} callId=${callId} micId=${micId} reason=${reason}`);

  try {
    reportActiveAudioCapture(`desktop:pre-release:${reason}`);
  } catch {}

  try {
    stopLocalAudioStream();
  } catch {}

  try {
    reportActiveAudioCapture(`desktop:post-release:${reason}`);
  } catch {}

  logMic(`[${nowISO()}] [desktop:mic] release executed corrId=${corrId} callId=${callId} micId=${micId} reason=${reason} localStreamNow=no`);
  logLine(`[${nowISO()}] [desktop:call-audio] released reason=${reason}`);

  try {
    _postTermTimerSeq += 1;
    const seq = _postTermTimerSeq;
    _activePostTermTimers.seq = seq;
    try {
      if (_activePostTermTimers.t300) clearTimeout(_activePostTermTimers.t300);
      if (_activePostTermTimers.t1200) clearTimeout(_activePostTermTimers.t1200);
    } catch {}

    _activePostTermTimers.t300 = setTimeout(() => {
      try {
        if (_activePostTermTimers.seq !== seq) return;
        postTerminationCheck(session, corrId, callId, micId, 300);
      } catch {}
    }, 300);

    _activePostTermTimers.t1200 = setTimeout(() => {
      try {
        if (_activePostTermTimers.seq !== seq) return;
        postTerminationCheck(session, corrId, callId, micId, 1200);
      } catch {}
    }, 1200);
  } catch {}
}
