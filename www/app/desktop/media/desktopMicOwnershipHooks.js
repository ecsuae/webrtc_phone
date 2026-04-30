import { nowISO, logLine } from "../desktopLogging.js";
import { getDesktopMicOwnershipState } from "./desktopMicOwnershipTracker.js";
import {
  inferDesktopMicOwnerTagFromStack,
  recordDesktopMicGumResult,
  safeDesktopMicStackTop,
} from "./ext/desktopMicOwnershipHookHelpers.js";
import { installDesktopMicOwnershipWebAudioHooks } from "./ext/desktopMicOwnershipWebAudioHooks.js";

let _installed = false;

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
          const stack = safeDesktopMicStackTop();
          const ownerTag = inferDesktopMicOwnerTagFromStack(stack);
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
          recordDesktopMicGumResult(owner, stream);
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
            const stack = safeDesktopMicStackTop();
            const ownerTag = inferDesktopMicOwnerTagFromStack(stack);
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
                recordDesktopMicGumResult(owner, stream);
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

    try {
      installDesktopMicOwnershipWebAudioHooks();
    } catch {}

    log(`[${nowISO()}] [desktop:mic-owner] hooks installed`);
  } catch {}
}
