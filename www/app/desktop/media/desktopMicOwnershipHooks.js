import { nowISO, logLine } from "../desktopLogging.js";
import { getDesktopMicOwnershipState } from "./desktopMicOwnershipTracker.js";

let _installed = false;

function safeStackTop(limit = 6) {
  try {
    const s = (new Error("stack")).stack || "";
    return String(s).split("\n").slice(1, 1 + limit).join(" | ").slice(0, 512);
  } catch {
    return "";
  }
}

function inferOwnerTagFromStack(stack) {
  const s = String(stack || "");
  if (s.includes("desktopCallAudioRuntime")) return "desktop-call-runtime";
  if (s.includes("desktopOutboundStateChange")) return "desktop-call-terminated";
  if (s.includes("desktopLocalAudioSession")) return "desktop-local-audio-session";
  if (s.includes("desktop")) return "desktop-unknown";
  return "non-desktop-unknown";
}

function snapshotTrack(t) {
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

function snapshotStream(stream) {
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

function wrapTrackStop(owner, track) {
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

function recordGumResult(owner, stream) {
  try {
    owner.stream = stream || null;
    owner.streamSnapshot = snapshotStream(stream);
    owner.trackSnapshots = (() => {
      try {
        const ts = stream?.getTracks?.() || [];
        return ts.map(snapshotTrack).slice(0, 8);
      } catch {
        return [];
      }
    })();

    try {
      const tracks = stream?.getTracks?.() || [];
      tracks.forEach((t) => wrapTrackStop(owner, t));
    } catch {}
  } catch {}
}

function log(line) {
  try {
    logLine(line);
  } catch {}
}

export function installDesktopMicOwnershipHooks() {
  try {
    if (_installed) return;
    _installed = true;

    // Hook getUserMedia
    try {
      const md = navigator?.mediaDevices || null;
      const orig = md?.getUserMedia?.bind(md);
      if (orig && !md.__desktopMicOwnershipGumWrapped) {
        md.__desktopMicOwnershipGumWrapped = true;
        md.getUserMedia = async (constraints) => {
          const st = getDesktopMicOwnershipState();
          const stack = safeStackTop();
          const ownerTag = inferOwnerTagFromStack(stack);
          const owner = {
            kind: "getUserMedia",
            ownerTag,
            acquiredAt: nowISO(),
            releasedAt: null,
            releaseCalledAt: null,
            constraints: (() => {
              try {
                const a = constraints?.audio;
                return (a === true) ? "audio:true" : (a ? "audio:object" : "audio:false");
              } catch {
                return "unknown";
              }
            })(),
            stackTop: stack,
            stream: null,
            streamSnapshot: null,
            trackSnapshots: [],
          };
          try {
            st.gumOwners.push(owner);
          } catch {}

          const stream = await orig(constraints);
          recordGumResult(owner, stream);
          return stream;
        };
      }
    } catch {}

    // Hook legacy getUserMedia (some desktop runtimes / older Brave paths)
    try {
      const legacyNames = ["getUserMedia", "webkitGetUserMedia"]; // vendor legacy
      for (const nm of legacyNames) {
        try {
          const fn = navigator?.[nm];
          if (!fn || typeof fn !== "function") continue;
          if (fn.__desktopMicOwnershipLegacyWrapped) continue;

          const origLegacy = fn.bind(navigator);
          const wrapped = (constraints, onOk, onErr) => {
            const st = getDesktopMicOwnershipState();
            const stack = safeStackTop();
            const ownerTag = inferOwnerTagFromStack(stack);
            const owner = {
              kind: nm,
              ownerTag,
              acquiredAt: nowISO(),
              releasedAt: null,
              releaseCalledAt: null,
              constraints: (() => {
                try {
                  const a = constraints?.audio;
                  return (a === true) ? "audio:true" : (a ? "audio:object" : "audio:false");
                } catch {
                  return "unknown";
                }
              })(),
              stackTop: stack,
              stream: null,
              streamSnapshot: null,
              trackSnapshots: [],
            };
            try {
              st.gumOwners.push(owner);
            } catch {}

            const ok = (stream) => {
              try {
                recordGumResult(owner, stream);
              } catch {}
              try {
                if (typeof onOk === "function") onOk(stream);
              } catch {}
            };

            const bad = (err) => {
              try {
                if (typeof onErr === "function") onErr(err);
              } catch {}
            };

            try {
              return origLegacy(constraints, ok, bad);
            } catch (e) {
              bad(e);
              return undefined;
            }
          };

          wrapped.__desktopMicOwnershipLegacyWrapped = true;
          navigator[nm] = wrapped;
        } catch {}
      }
    } catch {}

    // Hook AudioContext creation + close
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !AC.__desktopMicOwnershipWrapped) {
        AC.__desktopMicOwnershipWrapped = true;
        const Wrapped = function (...args) {
          const ctx = new AC(...args);
          try {
            const st = getDesktopMicOwnershipState();
            const stack = safeStackTop();
            ctx.__desktopMicOwnerTag = inferOwnerTagFromStack(stack);
            ctx.__desktopMicCreatedAt = nowISO();
            ctx.__desktopMicClosedAt = null;
            st.audioContexts.add(ctx);
          } catch {}

          try {
            const origClose = ctx.close?.bind(ctx);
            if (origClose && !ctx.__desktopMicCloseWrapped) {
              ctx.__desktopMicCloseWrapped = true;
              ctx.close = () => {
                try { ctx.__desktopMicClosedAt = nowISO(); } catch {}
                return origClose();
              };
            }
          } catch {}

          return ctx;
        };

        Wrapped.prototype = AC.prototype;
        if (window.AudioContext) window.AudioContext = Wrapped;
        if (window.webkitAudioContext) window.webkitAudioContext = Wrapped;
      }
    } catch {}

    // Hook createMediaStreamSource
    try {
      const ACp = (window.AudioContext || window.webkitAudioContext)?.prototype;
      const origCMS = ACp?.createMediaStreamSource;
      if (ACp && typeof origCMS === "function" && !ACp.__desktopMicOwnershipCmsWrapped) {
        ACp.__desktopMicOwnershipCmsWrapped = true;
        ACp.createMediaStreamSource = function (stream) {
          const node = origCMS.call(this, stream);
          try {
            const st = getDesktopMicOwnershipState();
            node.__desktopMicOwnerTag = this?.__desktopMicOwnerTag || "desktop-unknown";
            node.__desktopMicCreatedAt = nowISO();
            node.__desktopMicDisconnectedAt = null;
            node.__desktopMicStreamSnapshot = snapshotStream(stream);
            st.mediaStreamSources.add(node);
          } catch {}

          try {
            const origDisc = node.disconnect?.bind(node);
            if (origDisc && !node.__desktopMicDisconnectWrapped) {
              node.__desktopMicDisconnectWrapped = true;
              node.disconnect = (...args) => {
                try { node.__desktopMicDisconnectedAt = nowISO(); } catch {}
                return origDisc(...args);
              };
            }
          } catch {}

          return node;
        };
      }
    } catch {}

    log(`[${nowISO()}] [desktop:mic-owner] hooks installed`);
  } catch {}
}
