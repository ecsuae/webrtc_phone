// www/app/media.js
import { nowISO } from "./config.js";
import { el } from "./dom.js";
import { logLine } from "./log.js";
import { sendCallMediaEvent } from "./features/callMediaLog.js";

let localAudioStream = null;
let _activeAudioTrackIds = new Set();

function snapshotActiveAudioRegistry() {
  try {
    return {
      activeAudioTrackCount: _activeAudioTrackIds.size,
      activeAudioTrackIds: Array.from(_activeAudioTrackIds).slice(0, 8),
    };
  } catch {
    return { activeAudioTrackCount: 0, activeAudioTrackIds: [] };
  }
}

function emitMediaEvent(ev) {
  try {
    sendCallMediaEvent(ev);
  } catch {}
}

export function stopLocalAudioStream(sourceTag = "stopLocalAudioStream") {
  if (!localAudioStream) return;
  localAudioStream.getTracks().forEach((t) => {
    const before = (() => {
      try {
        return { id: t?.id || null, kind: t?.kind || null, readyState: t?.readyState || null };
      } catch {
        return { id: null, kind: null, readyState: null };
      }
    })();
    try {
      const id = t?.id || "?";
      logLine(`[${nowISO()}] [media] track stop() trackId=${id} kind=${t?.kind || "?"} readyState=${t?.readyState || "?"}`);
    } catch {}
    try {
      t.stop();
    } catch {}
    const after = (() => {
      try {
        return { readyState: t?.readyState || null };
      } catch {
        return { readyState: null };
      }
    })();
    try {
      emitMediaEvent({
        type: "media-track-stop",
        sourceTag,
        trackId: before.id || undefined,
        trackKind: before.kind || undefined,
        readyStateBefore: before.readyState || undefined,
        readyStateAfter: after.readyState || undefined,
        msg: "Media track stop() called",
      });
    } catch {}
    try {
      if (t?.kind === "audio" && t?.id) _activeAudioTrackIds.delete(t.id);
    } catch {}
  });
  localAudioStream = null;
  const reg = snapshotActiveAudioRegistry();
  logLine(`[${nowISO()}] [media] microphone stream stopped activeAudioTrackCount=${reg.activeAudioTrackCount}`);
  try {
    emitMediaEvent({
      type: "media-active-capture-registry",
      sourceTag,
      activeCount: reg.activeAudioTrackCount,
      activeTrackIds: reg.activeAudioTrackIds,
      msg: "Active audio capture registry snapshot",
    });
  } catch {}
}

export function reportActiveAudioCapture(tag = "report") {
  try {
    const t = localAudioStream?.getAudioTracks?.()?.[0] || null;
    const reg = snapshotActiveAudioRegistry();
    logLine(
      `[${nowISO()}] [media] capture-registry tag=${tag} hasLocalStream=${!!localAudioStream} localTrackId=${t?.id || "?"} localTrackState=${t?.readyState || "?"} activeAudioTrackCount=${reg.activeAudioTrackCount}`
    );
    try {
      emitMediaEvent({
        type: "media-active-capture-registry",
        sourceTag: tag,
        activeCount: reg.activeAudioTrackCount,
        activeTrackIds: reg.activeAudioTrackIds,
        msg: "Active audio capture registry snapshot",
      });
    } catch {}
  } catch {}
}

export async function ensureMicAccessTagged(setStatus, sourceTag = "unknown") {
  if (!navigator.mediaDevices?.getUserMedia) {
    logLine(`[${nowISO()}] [media] getUserMedia not available source=${sourceTag}`);
    return false;
  }
  if (localAudioStream) {
    const activeTrack = localAudioStream.getAudioTracks()?.[0];
    const ready = activeTrack?.readyState;
    const ok = !!activeTrack && ready === "live";
    logLine(`[${nowISO()}] [media] local stream already active source=${sourceTag} enabled=${activeTrack?.enabled} readyState=${ready}`);
    if (ok) return true;
    try {
      logLine(`[${nowISO()}] [media] local stream track not live - re-acquiring microphone source=${sourceTag}`);
    } catch {}
    try {
      stopLocalAudioStream();
    } catch {}
  }

  try {
    const reg0 = snapshotActiveAudioRegistry();
    logLine(`[${nowISO()}] [media] getUserMedia() start source=${sourceTag} activeAudioTrackCount=${reg0.activeAudioTrackCount}`);
    try {
      emitMediaEvent({
        type: "media-gum-start",
        sourceTag,
        activeCount: reg0.activeAudioTrackCount,
        activeTrackIds: reg0.activeAudioTrackIds,
        msg: "getUserMedia({audio:true}) start",
      });
    } catch {}
  } catch {}

  try {
    localAudioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    const tracks = localAudioStream.getAudioTracks();
    try {
      const t = tracks?.[0] || null;
      if (t?.id) _activeAudioTrackIds.add(t.id);

      try {
        if (t && typeof t.addEventListener === "function") {
          t.addEventListener("ended", () => {
            try {
              emitMediaEvent({
                type: "media-track-ended",
                sourceTag,
                trackId: t?.id || undefined,
                trackKind: t?.kind || undefined,
                readyStateAfter: t?.readyState || undefined,
                msg: "Media track ended event",
              });
            } catch {}
          });
        }
      } catch {}
    } catch {}
    const reg1 = snapshotActiveAudioRegistry();
    logLine(
      `[${nowISO()}] [media] microphone granted source=${sourceTag} tracks=${tracks.length} enabled=${tracks[0]?.enabled || false} readyState=${tracks[0]?.readyState || "?"} trackId=${tracks[0]?.id || "?"} activeAudioTrackCount=${reg1.activeAudioTrackCount}`
    );
    try {
      emitMediaEvent({
        type: "media-gum-success",
        sourceTag,
        streamId: localAudioStream?.id || undefined,
        trackId: tracks?.[0]?.id || undefined,
        label: tracks?.[0]?.label || undefined,
        msg: "getUserMedia({audio:true}) success",
      });
    } catch {}
    try {
      emitMediaEvent({
        type: "media-active-capture-registry",
        sourceTag,
        activeCount: reg1.activeAudioTrackCount,
        activeTrackIds: reg1.activeAudioTrackIds,
        msg: "Active audio capture registry snapshot",
      });
    } catch {}
    return true;
  } catch (e) {
    logLine(`[${nowISO()}] [media] microphone permission denied source=${sourceTag}`, e?.message || e);
    try {
      emitMediaEvent({
        type: "media-gum-fail",
        sourceTag,
        msg: "getUserMedia({audio:true}) failed",
      });
    } catch {}
    setStatus?.("Microphone permission denied");
    return false;
  }
}

export async function ensureMicAccess(setStatus) {
  return ensureMicAccessTagged(setStatus, "ensureMicAccess");
}

export function getLocalStream() {
  return localAudioStream;
}

export function getLocalAudioTrack() {
  try {
    return getLocalStream()?.getAudioTracks?.()?.[0] || null;
  } catch {
    return null;
  }
}

export function attachRemoteStream(stream) {
  if (!el.remoteAudio) return;
  el.remoteAudio.srcObject = stream;
  const p = el.remoteAudio.play();
  if (p?.catch) p.catch(() => {});
}