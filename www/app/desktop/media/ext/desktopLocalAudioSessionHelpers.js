import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

export function getDesktopLocalAudioTrackFromStream(getLocalStream) {
  try {
    return getLocalStream()?.getAudioTracks?.()?.[0] || null;
  } catch {
    return null;
  }
}

export function snapshotDesktopLocalAudioTrack(track) {
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

export async function waitForDesktopLocalAudioPeerConnection(session, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pc = session?.sessionDescriptionHandler?.peerConnection || null;
    if (pc) return pc;
    await new Promise((r) => setTimeout(r, 80));
  }
  return null;
}

export async function ensureDesktopAudioSenderHasLiveTrack(pc, stream, track) {
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
    const st = snapshotDesktopLocalAudioTrack(audioSender.track);
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
