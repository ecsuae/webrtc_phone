import { state } from "./state.js";
import { getDeviceInfo } from "./identity.js";

function probe(tag, detail = "") {
  try {
    const suffix = detail ? ` ${detail}` : "";
    console.log(`[${tag}]${suffix}`);
  } catch {}
}

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
    try {
      const info = getDeviceInfo();
      console.log(`[META_TIMER_TICK] deviceId=${info.deviceId} user=${info.currentUsername} debugMode=${info.debugMode} vis=hidden action=beacon src=remoteLogs/transport.js:sendMetadataToServer`);
    } catch {}
    const sent = trySendMetadataBeacon();
    if (!sent) {
      console.log("[RemoteLogs] Skipping metadata fetch while app is hidden");
    }
    return;
  }

  try {
    const deviceInfo = getDeviceInfo();
    try {
      console.log(`[META_TIMER_TICK] deviceId=${deviceInfo.deviceId} user=${deviceInfo.currentUsername} debugMode=${deviceInfo.debugMode} vis=visible action=fetch src=remoteLogs/transport.js:sendMetadataToServer`);
    } catch {}
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
    probe("DEBUG_LOG_UPLOAD_ATTEMPT", `count=${logsToSend.length}`);
    probe("DEBUG_LOG_UPLOAD_URL", "/api/logs/mobile");
    probe("DEBUG_SENDLOGS_FETCH_START", `count=${logsToSend.length}`);
    const response = await fetch("/api/logs/mobile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...getDeviceInfo(),
        batchId: state.batchId,
        logs: logsToSend,
      }),
    });

    if (!response.ok) {
      probe("DEBUG_SENDLOGS_FETCH_FAILED", `status=${response.status}`);
      console.warn(`[RemoteLogs] Server returned ${response.status}`);
      // Re-add logs if send failed.
      state.logBuffer = logsToSend.concat(state.logBuffer);
    } else {
      probe("DEBUG_SENDLOGS_FETCH_OK", `status=${response.status}`);
    }
  } catch (err) {
    probe("DEBUG_SENDLOGS_FETCH_FAILED", `err=${err?.message || err}`);
    console.warn("[RemoteLogs] Failed to send logs:", err);
    // Re-add logs if send failed.
    state.logBuffer = logsToSend.concat(state.logBuffer);
  }
}
