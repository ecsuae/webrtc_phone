import { nowISO } from "../../desktopLogging.js";
import { getDesktopMicOwnershipState } from "../desktopMicOwnershipTracker.js";
import {
  inferDesktopMicOwnerTagFromStack,
  safeDesktopMicStackTop,
  snapshotDesktopMicStream,
} from "./desktopMicOwnershipHookHelpers.js";

export function installDesktopMicOwnershipWebAudioHooks() {
  // Hook AudioContext creation + close
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !AC.__desktopMicOwnershipWrapped) {
      AC.__desktopMicOwnershipWrapped = true;
      const Wrapped = function (...args) {
        const ctx = new AC(...args);
        try {
          const st = getDesktopMicOwnershipState();
          const stack = safeDesktopMicStackTop();
          ctx.__desktopMicOwnerTag = inferDesktopMicOwnerTagFromStack(stack);
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
          node.__desktopMicStreamSnapshot = snapshotDesktopMicStream(stream);
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
}
