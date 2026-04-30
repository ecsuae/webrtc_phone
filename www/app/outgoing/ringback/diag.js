import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { readAppAudioRouteDiagSnapshot } from "../../ui/callControlAudioRoute.js";

let _diagTimer = null;
let _deviceChangeHandler = null;

function readRouteAvailability() {
  const enumerateDevicesAvailable = !!navigator.mediaDevices?.enumerateDevices;
  const setSinkIdAvailable = false;
  const routeInfoUnavailable = !enumerateDevicesAvailable;
  return {
    enumerateDevicesAvailable,
    setSinkIdAvailable,
    routeInfoUnavailable,
    routeInfoSource: routeInfoUnavailable ? "web-runtime-limited" : "web-runtime",
  };
}

async function readAudioOutputs() {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return undefined;
    const devices = await navigator.mediaDevices.enumerateDevices();
    return (devices || [])
      .filter((d) => d && d.kind === "audiooutput")
      .map((d) => ({ deviceId: d.deviceId, label: d.label }));
  } catch {
    return undefined;
  }
}

export function emitRingbackEvent({ type, dir, ringbackCtx, ringbackRunning, trigger, reason, msg, extra }) {
  try {
    const avail = readRouteAvailability();

    const desiredModeRaw = (() => {
      try {
        const v = localStorage.getItem("audioRouteMode");
        return v === "speaker" || v === "earpiece" ? v : undefined;
      } catch {
        return undefined;
      }
    })();

    const desiredMode = desiredModeRaw || "unknown";

    const appRoute = (() => {
      try {
        const d = readAppAudioRouteDiagSnapshot?.();
        return d && typeof d === "object" ? d : null;
      } catch {
        return null;
      }
    })();

    sendCallMediaEvent({
      type,
      dir,
      audioElPaused: undefined,
      audioElMuted: undefined,
      audioElVolume: undefined,
      audioElCurrentTime: undefined,
      audioElReadyState: undefined,
      desiredMode,
      routedTo: desiredModeRaw || "unknown",
      sinkSupported: false,
      sinkId: "unsupported",
      enumerateDevicesAvailable: avail.enumerateDevicesAvailable,
      setSinkIdAvailable: avail.setSinkIdAvailable,
      routeInfoUnavailable: avail.routeInfoUnavailable,
      routeInfoSource: avail.routeInfoSource,
      ringbackRunning,
      ringbackCtxState: ringbackCtx?.state,
      ringbackCtxCurrentTime: typeof ringbackCtx?.currentTime === "number" ? ringbackCtx.currentTime : undefined,
      appAudioRouteMode: appRoute?.appAudioRouteMode || "unknown",
      appAudioRouteSource: appRoute?.appAudioRouteSource || "none",
      appAudioRouteDetail: appRoute?.appAudioRouteDetail || "none",
      speakerButtonActive: typeof appRoute?.speakerButtonActive === "boolean" ? appRoute.speakerButtonActive : false,
      earpieceButtonActive: typeof appRoute?.earpieceButtonActive === "boolean" ? appRoute.earpieceButtonActive : false,
      audioRouteStateAvailable: typeof appRoute?.audioRouteStateAvailable === "boolean" ? appRoute.audioRouteStateAvailable : false,
      audioRouteSnapshotTs: appRoute?.audioRouteSnapshotTs || undefined,
      audioOutputs: extra?.audioOutputs,
      trigger,
      reason,
      msg,
      ...(extra || {}),
    });
  } catch {}
}

export function startRingbackDiag({ dir, getCtx, getRunning, getTrigger }) {
  try {
    if (_diagTimer) return;
    _diagTimer = window.setInterval(() => {
      try {
        if (!getRunning()) return;
        readAudioOutputs().then((audioOutputs) => {
          emitRingbackEvent({
            type: "ringback-diag",
            dir,
            ringbackCtx: getCtx(),
            ringbackRunning: getRunning(),
            trigger: getTrigger() || undefined,
            reason: undefined,
            msg: "Ringback diag snapshot",
            extra: { audioOutputs },
          });
        });
      } catch {}
    }, 2500);
  } catch {}

  try {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.addEventListener !== "function") return;
    if (_deviceChangeHandler) return;
    _deviceChangeHandler = () => {
      try {
        if (!getRunning()) return;
        readAudioOutputs().then((audioOutputs) => {
          emitRingbackEvent({
            type: "ringback-output-route",
            dir,
            ringbackCtx: getCtx(),
            ringbackRunning: getRunning(),
            trigger: "devicechange",
            reason: undefined,
            msg: "Ringback output route devicechange observed",
            extra: { audioOutputs },
          });
        });
      } catch {}
    };
    navigator.mediaDevices.addEventListener("devicechange", _deviceChangeHandler);
  } catch {}
}

export function stopRingbackDiag() {
  try {
    if (_diagTimer) {
      clearInterval(_diagTimer);
      _diagTimer = null;
    }
  } catch {}

  try {
    if (_deviceChangeHandler && navigator.mediaDevices && typeof navigator.mediaDevices.removeEventListener === "function") {
      navigator.mediaDevices.removeEventListener("devicechange", _deviceChangeHandler);
    }
    _deviceChangeHandler = null;
  } catch {}
}

export async function emitRingbackOutputSnapshot({ dir, getCtx, getRunning, trigger, reason }) {
  try {
    const audioOutputs = await readAudioOutputs();
    emitRingbackEvent({
      type: "ringback-output-route",
      dir,
      ringbackCtx: getCtx(),
      ringbackRunning: getRunning(),
      trigger,
      reason,
      msg: "Ringback output route snapshot",
      extra: { audioOutputs },
    });
  } catch {}
}
