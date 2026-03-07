import {
  MAX_LOGS_PER_BATCH,
  SEND_INTERVAL,
  METADATA_SEND_INTERVAL,
  state,
} from "./state.js";
import {
  getDeviceInfo,
  getOrCreateDeviceId,
  getUsernameHistory,
} from "./identity.js";
import {
  sendLogsToServer,
  sendMetadataToServer,
  trySendMetadataBeacon,
} from "./transport.js";

export { sendLogsToServer, sendMetadataToServer };

export function isDebugMode() {
  return state.debugMode;
}

function initializeDebugMode() {
  try {
    const stored = localStorage.getItem("webrtc_debug_mode");
    state.debugMode = stored === "true";
  } catch {
    state.debugMode = false;
  }
  console.log(`[RemoteLogs] Debug mode initialized: ${state.debugMode}`);
  return state.debugMode;
}

export function toggleDebugMode() {
  state.debugMode = !state.debugMode;
  try {
    localStorage.setItem("webrtc_debug_mode", state.debugMode ? "true" : "false");
  } catch {
    // Ignore localStorage errors.
  }
  console.log(`[RemoteLogs] Debug mode ${state.debugMode ? "ENABLED" : "DISABLED"}`);

  // Clear existing buffer if disabling debug mode.
  if (!state.debugMode) {
    state.logBuffer = [];
  }

  if (state.debugMode) {
    if (!state.sendTimer) {
      state.sendTimer = setInterval(sendLogsToServer, SEND_INTERVAL);
      console.log("[RemoteLogs] Started log sending timer");
    }
  } else if (state.sendTimer) {
    clearInterval(state.sendTimer);
    state.sendTimer = null;
    console.log("[RemoteLogs] Stopped log sending timer");
  }

  // Send metadata update immediately.
  sendMetadataToServer();

  return state.debugMode;
}

export function setUsername(username) {
  if (!username) return;

  const prevUsername = state.currentUsername;
  state.currentUsername = username;
  console.log(`[RemoteLogs] Username set to: ${username}, previous: ${prevUsername || 'none'}, state now:`, state.currentUsername);

  try {
    localStorage.setItem("webrtc_current_username", username);
  } catch {
    // Ignore localStorage errors.
  }

  const history = getUsernameHistory();
  if (!history.includes(username)) {
    history.push(username);
    try {
      localStorage.setItem("webrtc_username_history", JSON.stringify(history));
      console.log(`[RemoteLogs] Added username to history: ${username}`);
    } catch {
      // Ignore localStorage errors.
    }
  }

  if (prevUsername !== username) {
    console.log(`[RemoteLogs] Username changed, sending metadata update...`);
    sendMetadataToServer();
  } else {
    console.log(`[RemoteLogs] Username unchanged, skipping metadata update`);
  }
}

export function captureLog(level, message) {
  if (!state.debugMode) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };

  state.logBuffer.push(entry);

  // Keep only last 500 logs in memory.
  if (state.logBuffer.length > 500) {
    state.logBuffer = state.logBuffer.slice(-500);
  }

  if (state.logBuffer.length >= MAX_LOGS_PER_BATCH) {
    sendLogsToServer();
  }
}

function bindLifecycleEvents() {
  if (state.lifecycleEventsBound) return;

  // When app returns to foreground, send metadata once immediately.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      setTimeout(() => {
        sendMetadataToServer();
      }, 250);
    }
  });

  // Use beacon on unload/pagehide to avoid fetch cancellation errors.
  window.addEventListener("pagehide", () => {
    trySendMetadataBeacon();
  });

  window.addEventListener("beforeunload", () => {
    trySendMetadataBeacon();
  });

  state.lifecycleEventsBound = true;
}

export function startRemoteLogging() {
  initializeDebugMode();

  // Send initial metadata after a short delay to ensure page is ready.
  setTimeout(() => {
    sendMetadataToServer();
  }, 2000);

  if (!state.metadataTimer) {
    state.metadataTimer = setInterval(() => {
      sendMetadataToServer();
    }, METADATA_SEND_INTERVAL);
    console.log("[RemoteLogs] Started metadata timer");
  }

  if (state.debugMode && !state.sendTimer) {
    state.sendTimer = setInterval(() => {
      sendLogsToServer();
    }, SEND_INTERVAL);
    console.log("[RemoteLogs] Started log sending timer (debug mode)");
  }

  bindLifecycleEvents();

  console.log(
    `[RemoteLogs] Service started - Device: ${getOrCreateDeviceId()}, Debug: ${state.debugMode}`
  );
}

export function getLogBuffer() {
  return [...state.logBuffer];
}

export function getInfo() {
  return getDeviceInfo();
}
