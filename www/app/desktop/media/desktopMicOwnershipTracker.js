import { nowISO, logLine } from "../desktopLogging.js";
import { reportDesktopMicOwnershipSnapshotToCallLog } from "./desktopMicOwnershipReporter.js";

const _state = {
  gumOwners: [],
  audioContexts: new Set(),
  mediaStreamSources: new Set(),
};

function log(line) {
  try {
    logLine(line);
  } catch {}
}

export function getDesktopMicOwnershipState() {
  return _state;
}

function buildPostedOwnersSummary(owners) {
  try {
    const live = owners
      .filter((o) => (Array.isArray(o.liveAudioTrackIds) && o.liveAudioTrackIds.length) || (o.liveAudioTrackCount > 0))
      .slice(0, 6)
      .map((o) => {
        const tracks = Array.isArray(o.liveAudioTrackIds) ? o.liveAudioTrackIds.join(",") : "";
        const st = o.audioContextState || o.state || "";
        const src = o.hasConnectedSource ? "src" : "";
        const hint = (() => {
          try {
            const top = String(o.stackTop || "");
            const p = top.split("|")[0] || "";
            return p.trim().slice(0, 64);
          } catch {
            return "";
          }
        })();
        return `${o.ownerTag}:${o.kind}:${o.streamId || "-"}:${tracks || "-"}:${st || "-"}:${src || "-"}:${hint || "-"}`;
      });
    return live.join(";").slice(0, 240);
  } catch {
    return "";
  }
}

export function forceReleaseDesktopMicOwners(ctx = {}) {
  try {
    const st = _state;

    // Stop any live gUM tracks we can still reach
    try {
      for (const o of st.gumOwners.slice(-25)) {
        const stream = o?.stream;
        const tracks = stream?.getAudioTracks?.() || [];
        tracks.forEach((t) => {
          try {
            if (t?.readyState === "live") t.stop();
          } catch {}
        });
        try {
          if (!o.releasedAt) o.releasedAt = nowISO();
        } catch {}
      }
    } catch {}

    // Disconnect any MediaStreamSource nodes
    try {
      for (const n of Array.from(st.mediaStreamSources)) {
        try {
          if (typeof n?.disconnect === "function") n.disconnect();
        } catch {}
      }
    } catch {}

    // Close any AudioContexts
    try {
      for (const c of Array.from(st.audioContexts)) {
        try {
          if (c && c.state && c.state !== "closed" && typeof c.close === "function") c.close();
        } catch {}
      }
    } catch {}
  } catch {}
}

export function snapshotDesktopMicOwners(ctx = {}) {
  const corrId = ctx?.corrId || "?";
  const callId = ctx?.callId || "?";
  const checkpoint = ctx?.checkpoint || "snapshot";
  const reason = ctx?.reason || "?";

  const owners = [];

  try {
    for (const o of _state.gumOwners.slice(-25)) {
      const live = (() => {
        try {
          const ts = o?.stream?.getAudioTracks?.() || [];
          return ts.filter((t) => t?.readyState === "live").map((t) => t.id).slice(0, 8);
        } catch {
          return [];
        }
      })();
      owners.push({
        kind: o.kind,
        ownerTag: o.ownerTag,
        acquiredAt: o.acquiredAt,
        releaseCalledAt: o.releaseCalledAt,
        constraints: o.constraints,
        streamId: o.streamSnapshot?.streamId || null,
        stackTop: o.stackTop || undefined,
        liveAudioTrackIds: live,
      });
    }
  } catch {}

  try {
    for (const c of Array.from(_state.audioContexts).slice(-25)) {
      const state = (() => {
        try {
          return c?.state || null;
        } catch {
          return null;
        }
      })();
      owners.push({
        kind: "AudioContext",
        ownerTag: c?.__desktopMicOwnerTag || "?",
        createdAt: c?.__desktopMicCreatedAt || null,
        closedAt: c?.__desktopMicClosedAt || null,
        audioContextState: state,
      });
    }
  } catch {}

  try {
    for (const n of Array.from(_state.mediaStreamSources).slice(-25)) {
      owners.push({
        kind: "MediaStreamSource",
        ownerTag: n?.__desktopMicOwnerTag || "?",
        createdAt: n?.__desktopMicCreatedAt || null,
        disconnectedAt: n?.__desktopMicDisconnectedAt || null,
        streamId: n?.__desktopMicStreamSnapshot?.streamId || null,
        liveAudioTrackCount: n?.__desktopMicStreamSnapshot?.liveAudioTrackCount ?? null,
        hasConnectedSource: !n?.__desktopMicDisconnectedAt,
      });
    }
  } catch {}

  const liveOwnerCount = (() => {
    try {
      return owners.filter((o) => (Array.isArray(o.liveAudioTrackIds) && o.liveAudioTrackIds.length) || o.liveAudioTrackCount > 0).length;
    } catch {
      return null;
    }
  })();

  return {
    ts: nowISO(),
    corrId,
    callId,
    checkpoint,
    reason,
    ownerCount: owners.length,
    liveOwnerCount,
    owners: owners.slice(0, 50),
  };
}

export function emitDesktopMicOwnershipSnapshot(ctx = {}) {
  try {
    const snap = snapshotDesktopMicOwners(ctx);
    const ownersSummary = buildPostedOwnersSummary(snap.owners || []);
    log(`[${snap.ts}] [desktop:mic-owner] snapshot corrId=${snap.corrId} callId=${snap.callId} checkpoint=${snap.checkpoint} reason=${snap.reason} ownerCount=${snap.ownerCount} liveOwnerCount=${snap.liveOwnerCount}`);
    try {
      // console payload is authoritative (sanitizer may drop unknown fields)
      console.log("[desktop:mic-owner] owners", snap);
    } catch {}

    try {
      reportDesktopMicOwnershipSnapshotToCallLog(snap, {
        dir: ctx?.dir || "outbound",
        msg: `desktop-mic-ownership-snapshot ownerCount=${snap.ownerCount} liveOwnerCount=${snap.liveOwnerCount} live=${ownersSummary}`,
      });
    } catch {}
  } catch {}
}
