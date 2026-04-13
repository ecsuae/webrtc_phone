import { nowISO } from "../../desktopLogging.js";

export function safeDesktopMicStackTop(limit = 6) {
  try {
    const s = (new Error("stack")).stack || "";
    return String(s).split("\n").slice(1, 1 + limit).join(" | ").slice(0, 512);
  } catch {
    return "";
  }
}

export function inferDesktopMicOwnerTagFromStack(stack) {
  const s = String(stack || "");
  if (s.includes("desktopCallAudioRuntime")) return "desktop-call-runtime";
  if (s.includes("desktopOutboundStateChange")) return "desktop-call-terminated";
  if (s.includes("desktopLocalAudioSession")) return "desktop-local-audio-session";
  if (s.includes("desktop")) return "desktop-unknown";
  return "non-desktop-unknown";
}

export function snapshotDesktopMicTrack(t) {
  try {
    return {
      id: t?.id || null,
      kind: t?.kind || null,
      readyState: t?.readyState || null,
      enabled: (typeof t?.enabled === "boolean") ? t.enabled : null,
      muted: (typeof t?.muted === "boolean") ? t.muted : null,
    };
  } catch {
    return { id: null, kind: null, readyState: null, enabled: null, muted: null };
  }
}

export function snapshotDesktopMicStream(stream) {
  try {
    const tracks = stream?.getTracks?.() || [];
    return {
      streamId: stream?.id || null,
      trackIds: tracks.map((t) => t?.id || null).filter(Boolean).slice(0, 8),
      trackStates: tracks.map((t) => t?.readyState || null).filter(Boolean).slice(0, 8),
      liveAudioTrackCount: (stream?.getAudioTracks?.() || []).filter((t) => t?.readyState === "live").length,
    };
  } catch {
    return { streamId: null, trackIds: [], trackStates: [], liveAudioTrackCount: 0 };
  }
}

export function wrapDesktopMicTrackStop(owner, track) {
  try {
    if (!track || typeof track.stop !== "function") return;
    if (track.__desktopMicOwnershipStopWrapped) return;
    track.__desktopMicOwnershipStopWrapped = true;
    const orig = track.stop.bind(track);
    track.stop = () => {
      try {
        owner.releaseCalledAt = owner.releaseCalledAt || nowISO();
      } catch {}
      return orig();
    };
  } catch {}
}

export function recordDesktopMicGumResult(owner, stream) {
  try {
    owner.stream = stream || null;
    owner.streamSnapshot = snapshotDesktopMicStream(stream);
    owner.trackSnapshots = (() => {
      try {
        const ts = stream?.getTracks?.() || [];
        return ts.map(snapshotDesktopMicTrack).slice(0, 8);
      } catch {
        return [];
      }
    })();

    try {
      const tracks = stream?.getTracks?.() || [];
      tracks.forEach((t) => wrapDesktopMicTrackStop(owner, t));
    } catch {}
  } catch {}
}
