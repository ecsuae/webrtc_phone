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

  // If debug mode is already enabled (e.g., persisted across reloads), ensure we have
  // a stable batchId so the server can aggregate uploads into a single file.
  if (state.debugMode) {
    try {
      const existing = sessionStorage.getItem("webrtc_debug_batch_id");
      if (existing && existing.trim()) {
        state.batchId = existing.trim();
      } else {
        state.batchId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem("webrtc_debug_batch_id", state.batchId);
      }
    } catch {
      state.batchId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    console.log(`[RemoteLogs] Debug batchId (init): ${state.batchId}`);
  }
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

  if (state.debugMode) {
    try {
      const existing = sessionStorage.getItem("webrtc_debug_batch_id");
      if (existing && existing.trim()) {
        state.batchId = existing.trim();
      } else {
        state.batchId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem("webrtc_debug_batch_id", state.batchId);
      }
    } catch {
      state.batchId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    console.log(`[RemoteLogs] Debug batchId: ${state.batchId}`);
  } else {
    state.batchId = null;
    try {
      sessionStorage.removeItem("webrtc_debug_batch_id");
    } catch {}
  }

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
  // Intercept console methods to capture all logs
  if (!window.__consoleIntercepted) {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = function(...args) {
      originalLog.apply(console, args);
      try {
        const message = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
        captureLog("log", message);
      } catch (err) {
        // Silently fail
      }
    };

    console.error = function(...args) {
      originalError.apply(console, args);
      try {
        const message = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
        captureLog("error", message);
      } catch (err) {
        // Silently fail
      }
    };

    console.warn = function(...args) {
      originalWarn.apply(console, args);
      try {
        const message = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
        captureLog("warn", message);
      } catch (err) {
        // Silently fail
      }
    };

    window.__consoleIntercepted = true;
    originalLog("[RemoteLogs] Console interception enabled");
  }

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

  // Prime persistent device ID asynchronously to keep startup non-blocking.
  getOrCreateDeviceId().catch(() => {
    // Ignore identity bootstrap failures.
  });

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
    `[RemoteLogs] Service started - Device: ${state.deviceId || "pending"}, Debug: ${state.debugMode}`
  );

  if (!state.debugMode) {
    console.log("[RemoteLogs] To enable mobile debug logging, click the BUG icon in the status bar");
  } else {
    console.log("[RemoteLogs] Debug mode is ON - all console logs are being captured and sent to the dashboard");
  }
}

export function getLogBuffer() {
  return [...state.logBuffer];
}

export function getInfo() {
  return getDeviceInfo();
}
