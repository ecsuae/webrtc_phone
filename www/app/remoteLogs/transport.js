import { state } from "./state.js";
import { getDeviceInfo } from "./identity.js";

export function pageIsVisible() {
  return typeof document !== "undefined" && document.visibilityState === "visible";
}

export function trySendMetadataBeacon() {
  try {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
      return false;
    }
    const payload = JSON.stringify(getDeviceInfo());
    const blob = new Blob([payload], { type: "application/json" });
    return navigator.sendBeacon("/api/logs/mobile/metadata", blob);
  } catch {
    return false;
  }
}

export async function sendMetadataToServer() {
  // iOS/Safari often cancels fetch while page is backgrounded; skip noisy attempts.
  if (!pageIsVisible()) {
    const sent = trySendMetadataBeacon();
    if (!sent) {
      console.log("[RemoteLogs] Skipping metadata fetch while app is hidden");
    }
    return;
  }

  try {
    const deviceInfo = getDeviceInfo();
    console.log("[RemoteLogs] Sending metadata with:", {
      deviceModel: deviceInfo.deviceModel,
      browserName: deviceInfo.browserName,
      browserVersion: deviceInfo.browserVersion,
      osName: deviceInfo.osName,
      osVersion: deviceInfo.osVersion,
      platform: deviceInfo.platform,
      language: deviceInfo.language,
      timeZone: deviceInfo.timeZone,
      screenInfo: deviceInfo.screenInfo,
      currentUsername: deviceInfo.currentUsername,
      debugMode: deviceInfo.debugMode
    });

    const response = await fetch("/api/logs/mobile/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deviceInfo),
    });

    if (response.ok) {
      console.log("[RemoteLogs] Metadata sent successfully");
    } else {
      const text = await response.text();
      console.warn(`[RemoteLogs] Metadata server returned ${response.status}: ${text}`);
    }
  } catch (err) {
    // Browser may abort requests during navigation/background; treat as non-fatal noise.
    const msg = err?.message || String(err);
    if (msg.includes("Load failed") || msg.includes("NetworkError")) {
      console.log(`[RemoteLogs] Metadata transient skip: ${msg}`);
      return;
    }
    if (!pageIsVisible()) {
      console.log(`[RemoteLogs] Metadata send skipped while hidden: ${msg}`);
      return;
    }
    console.warn("[RemoteLogs] Failed to send metadata:", msg);
    console.warn("[RemoteLogs] Error details:", err);
  }
}

export async function sendLogsToServer() {
  if (!state.debugMode || state.logBuffer.length === 0) return;

  const logsToSend = state.logBuffer.slice();
  state.logBuffer = []; // Clear buffer

  try {
    const response = await fetch("/api/logs/mobile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...getDeviceInfo(),
        logs: logsToSend,
      }),
    });

    if (!response.ok) {
      console.warn(`[RemoteLogs] Server returned ${response.status}`);
      // Re-add logs if send failed.
      state.logBuffer = logsToSend.concat(state.logBuffer);
    }
  } catch (err) {
    console.warn("[RemoteLogs] Failed to send logs:", err);
    // Re-add logs if send failed.
    state.logBuffer = logsToSend.concat(state.logBuffer);
  }
}
