import { readAppAudioRouteDiagSnapshot } from "../../../ui/callControlAudioRoute.js";
import { enableAudioOutputRouteDiag } from "../diagFlags.js";

export async function readAudioOutputSnapshot(audioEl) {
  const desiredModeRaw = (() => {
    try {
      const v = localStorage.getItem("audioRouteMode");
      return v === "speaker" || v === "earpiece" ? v : undefined;
    } catch {
      return undefined;
    }
  })();

  const desiredMode = desiredModeRaw || "unknown";

  const sinkSupported = !!(audioEl && typeof audioEl.setSinkId === "function");
  const sinkId = (() => {
    try {
      return audioEl && typeof audioEl.sinkId === "string" ? audioEl.sinkId : undefined;
    } catch {
      return undefined;
    }
  })();

  const enumerateDevicesAvailable = !!navigator.mediaDevices?.enumerateDevices;
  const setSinkIdAvailable = !!(audioEl && typeof audioEl.setSinkId === "function");

  let outputs = undefined;
  try {
    if (enumerateDevicesAvailable) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      outputs = (devices || [])
        .filter((d) => d && d.kind === "audiooutput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
    }
  } catch {}

  const routeInfoUnavailable = !enumerateDevicesAvailable && !setSinkIdAvailable;

  const outputsList = Array.isArray(outputs) ? outputs : [];
  const defaultOnly = outputsList.length === 1 && String(outputsList[0]?.deviceId || "") === "default" && String(outputsList[0]?.label || "").toLowerCase().includes("default");

  const enable = enableAudioOutputRouteDiag();
  const androidRouteControlAvailable = enable ? false : undefined;
  const effectiveOutput = enable && defaultOnly && !setSinkIdAvailable ? "default-only" : undefined;
  const routeDecision = enable && !setSinkIdAvailable ? "web-cannot-determine-android-route" : undefined;
  const routeDecisionReason = enable && defaultOnly && !setSinkIdAvailable
    ? "enumerateDevices only exposes Default and setSinkId unsupported"
    : (enable && !setSinkIdAvailable ? "setSinkId unsupported on this runtime" : undefined);

  const appRoute = (() => {
    try {
      const d = readAppAudioRouteDiagSnapshot?.();
      return d && typeof d === "object" ? d : null;
    } catch {
      return null;
    }
  })();

  const audioRouteMismatch = (() => {
    try {
      const appMode = appRoute?.appAudioRouteMode;
      const wants = appMode === "speaker" || appMode === "earpiece";
      const limited = routeDecision === "web-cannot-determine-android-route" || effectiveOutput === "default-only";
      return !!(wants && limited);
    } catch {
      return false;
    }
  })();

  return {
    desiredMode,
    routedTo: desiredModeRaw || "unknown",
    sinkSupported,
    sinkId: (sinkId || (setSinkIdAvailable ? "unknown" : "unsupported")),
    outputs,
    enumerateDevicesAvailable,
    setSinkIdAvailable,
    routeInfoUnavailable,
    routeInfoSource: routeInfoUnavailable ? "web-runtime-limited" : "web-runtime",
    androidRouteControlAvailable,
    effectiveOutput,
    routeDecision,
    routeDecisionReason,
    appRoute,
    audioRouteMismatch,
  };
}
