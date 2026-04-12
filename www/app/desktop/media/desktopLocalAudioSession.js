import { nowISO, logLine } from "../desktopLogging.js";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "../../media.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";

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

function getLocalAudioTrack() {
  try {
    return getLocalStream()?.getAudioTracks?.()?.[0] || null;
  } catch {
    return null;
  }
}

function snapshotTrack(track) {
  try {
    return {
      id: track?.id || null,
      enabled: typeof track?.enabled === "boolean" ? track.enabled : null,
      readyState: track?.readyState || null,
      muted: typeof track?.muted === "boolean" ? track.muted : null,
    };
  } catch {
    return { id: null, enabled: null, readyState: null, muted: null };
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

async function ensureAudioSenderHasLiveTrack(pc, stream, track) {
  if (!pc || !track || !stream) return { ok: false, reason: "missing-pc-or-track" };

  const senders = pc.getSenders?.() || [];
  const audioSender = senders.find((s) => s?.track?.kind === "audio") || null;

  const localMicTrackId = (() => {
    try {
      return track?.id || null;
    } catch {
      return null;
    }
  })();
  const localMicStreamId = (() => {
    try {
      return stream?.id || null;
    } catch {
      return null;
    }
  })();
  const localStreamAudioTrackId = (() => {
    try {
      return stream?.getAudioTracks?.()?.[0]?.id || null;
    } catch {
      return null;
    }
  })();
  const pcSignalingState = (() => {
    try {
      return pc?.signalingState || null;
    } catch {
      return null;
    }
  })();

  if (audioSender) {
    const st = snapshotTrack(audioSender.track);
    if (audioSender.track && st.readyState === "live") {
      audioSender.track.enabled = true;
      return { ok: true, action: "sender-track-ok" };
    }

    try {
      try {
        sendCallMediaEvent({
          type: "desktop-audio-sender-mutation",
          dir: "outbound",
          checkpoint: "replaceTrack-before",
          reason: "ensureAudioSenderHasLiveTrack",
          previousSenderTrackId: audioSender?.track?.id || undefined,
          senderTrackId: track?.id || undefined,
          localMicTrackId: localMicTrackId || undefined,
          localMicStreamId: localMicStreamId || undefined,
          localStreamAudioTrackId: localStreamAudioTrackId || undefined,
          sameAsLocalMicTrack: !!(track?.id && localMicTrackId && track.id === localMicTrackId),
          senderTrackIdMatchesLocalStreamAudioTrackId: !!(track?.id && localStreamAudioTrackId && track.id === localStreamAudioTrackId),
          pcSignalingState: pcSignalingState || undefined,
          msg: "About to replaceTrack() audio sender track",
        });
      } catch {}
      await audioSender.replaceTrack(track);
      track.enabled = true;
      try {
        sendCallMediaEvent({
          type: "desktop-audio-sender-mutation",
          dir: "outbound",
          checkpoint: "replaceTrack-after",
          reason: "ensureAudioSenderHasLiveTrack",
          previousSenderTrackId: st.id || undefined,
          senderTrackId: audioSender?.track?.id || undefined,
          localMicTrackId: localMicTrackId || undefined,
          localMicStreamId: localMicStreamId || undefined,
          localStreamAudioTrackId: localStreamAudioTrackId || undefined,
          sameAsLocalMicTrack: !!(audioSender?.track?.id && localMicTrackId && audioSender.track.id === localMicTrackId),
          senderTrackIdMatchesLocalStreamAudioTrackId: !!(audioSender?.track?.id && localStreamAudioTrackId && audioSender.track.id === localStreamAudioTrackId),
          pcSignalingState: pcSignalingState || undefined,
          msg: "replaceTrack() audio sender track completed",
        });
      } catch {}
      return { ok: true, action: "replaceTrack" };
    } catch (e) {
      return { ok: false, reason: `replaceTrack-failed:${e?.message || e}` };
    }
  }

  try {
    try {
      sendCallMediaEvent({
        type: "desktop-audio-sender-mutation",
        dir: "outbound",
        checkpoint: "addTrack-before",
        reason: "ensureAudioSenderHasLiveTrack",
        senderTrackId: track?.id || undefined,
        localMicTrackId: localMicTrackId || undefined,
        localMicStreamId: localMicStreamId || undefined,
        localStreamAudioTrackId: localStreamAudioTrackId || undefined,
        sameAsLocalMicTrack: !!(track?.id && localMicTrackId && track.id === localMicTrackId),
        senderTrackIdMatchesLocalStreamAudioTrackId: !!(track?.id && localStreamAudioTrackId && track.id === localStreamAudioTrackId),
        pcSignalingState: pcSignalingState || undefined,
        msg: "About to addTrack() audio track",
      });
    } catch {}
    pc.addTrack(track, stream);
    track.enabled = true;
    try {
      const a2 = (pc.getSenders?.() || []).find((s) => s?.track?.kind === "audio") || null;
      sendCallMediaEvent({
        type: "desktop-audio-sender-mutation",
        dir: "outbound",
        checkpoint: "addTrack-after",
        reason: "ensureAudioSenderHasLiveTrack",
        senderTrackId: a2?.track?.id || undefined,
        localMicTrackId: localMicTrackId || undefined,
        localMicStreamId: localMicStreamId || undefined,
        localStreamAudioTrackId: localStreamAudioTrackId || undefined,
        sameAsLocalMicTrack: !!(a2?.track?.id && localMicTrackId && a2.track.id === localMicTrackId),
        senderTrackIdMatchesLocalStreamAudioTrackId: !!(a2?.track?.id && localStreamAudioTrackId && a2.track.id === localStreamAudioTrackId),
        pcSignalingState: pcSignalingState || undefined,
        msg: "addTrack() audio track completed",
      });
    } catch {}
    return { ok: true, action: "addTrack" };
  } catch (e) {
    return { ok: false, reason: `addTrack-failed:${e?.message || e}` };
  }
}

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
  const track = getLocalAudioTrack();
  const snap = snapshotTrack(track);

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

  const after = snapshotTrack(track);
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
  const track = getLocalAudioTrack();

  if (!stream || !track) {
    last.lastAttachResult = "missing-local-stream";
    return { ok: false, reason: "missing-local-stream" };
  }

  const pc = await waitForPeerConnection(session);
  if (!pc) {
    last.lastAttachResult = "missing-pc";
    logLine(`[${nowISO()}] [desktop:local-audio] attach skipped: no peerConnection (reason=${reason})`);
    return { ok: false, reason: "missing-pc" };
  }

  try {
    track.enabled = true;
  } catch {}

  const res = await ensureAudioSenderHasLiveTrack(pc, stream, track);
  last.lastAttachResult = res.ok ? res.action : res.reason;

  const snap = snapshotTrack(track);
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
