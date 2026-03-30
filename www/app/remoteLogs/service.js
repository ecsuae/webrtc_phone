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
  sendLogsToServer as sendLogsToServerImpl,
  sendMetadataToServer,
  trySendMetadataBeacon,
} from "./transport.js";

export { sendMetadataToServer };

try {
  console.log(`[REMOTELOGS_BUILD_ID] url=${import.meta.url} src=app/remoteLogs/service.js`);
} catch {}

export function isDebugMode() {
  return state.debugMode;
}

function probe(tag, detail = "") {
  try {
    const suffix = detail ? ` ${detail}` : "";
    // Keep probes concise and machine-greppable.
    console.log(`[${tag}]${suffix}`);
  } catch {}
}

function initializeDebugMode() {
  try {
    const stored = localStorage.getItem("webrtc_debug_mode");
    state.debugMode = stored === "true";
  } catch {
    state.debugMode = false;
  }
  console.log(`[RemoteLogs] Debug mode initialized: ${state.debugMode}`);
  probe(state.debugMode ? "DEBUG_MODE_RUNTIME_ON" : "DEBUG_MODE_RUNTIME_OFF", "init");

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
  probe(state.debugMode ? "DEBUG_MODE_RUNTIME_ON" : "DEBUG_MODE_RUNTIME_OFF", "toggle");

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
      state.sendTimer = setInterval(() => {
        try {
          const now = Date.now();
          if (now - (state._probe?.lastTimerProbeTs || 0) >= 10000) {
            state._probe.lastTimerProbeTs = now;
            probe("DEBUG_FLUSH_TIMER_TICK", `buffer=${state.logBuffer.length}`);
          }
        } catch {}
        sendLogsToServer();
      }, SEND_INTERVAL);
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
    console.log(`[META_SET_USERNAME] user=${username} prev=${prevUsername || 'none'} src=remoteLogs/service.js:setUsername`);
  } catch {}

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

  try {
    const now = Date.now();
    if (now - (state._probe?.lastBufferProbeTs || 0) >= 5000) {
      state._probe.lastBufferProbeTs = now;
      probe("DEBUG_BUFFER_APPEND", `buffer=${state.logBuffer.length}`);
    }
  } catch {}

  // Keep only last 500 logs in memory.
  if (state.logBuffer.length > 500) {
    state.logBuffer = state.logBuffer.slice(-500);
  }

  if (state.logBuffer.length >= MAX_LOGS_PER_BATCH) {
    sendLogsToServer();
  }
}

export function sendLogsToServer() {
  try {
    const now = Date.now();
    if (now - (state._probe?.lastSendProbeTs || 0) >= 5000) {
      state._probe.lastSendProbeTs = now;
      probe("DEBUG_SENDLOGS_CALLED", `debugMode=${state.debugMode} buffer=${state.logBuffer.length}`);
    }
  } catch {}

  if (!state.debugMode) {
    probe("DEBUG_SENDLOGS_SKIPPED", "debugMode_off");
    return;
  }
  if (state.logBuffer.length === 0) {
    probe("DEBUG_SENDLOGS_EMPTY_BATCH");
    return;
  }

  return sendLogsToServerImpl();
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
    try {
      originalLog("[DEBUG_CONSOLE_INTERCEPT_ON]");
    } catch {}
  }

  // When app returns to foreground, send metadata once immediately.
  document.addEventListener("visibilitychange", () => {
    try {
      console.log(`[META_ANDROID_RESUME] vis=${document.visibilityState} user=${state.currentUsername || 'n/a'} src=remoteLogs/service.js:visibilitychange`);
    } catch {}
    if (document.visibilityState === "visible") {
      setTimeout(() => {
        sendMetadataToServer();
      }, 250);
    }
  });

  // Use beacon on unload/pagehide to avoid fetch cancellation errors.
  window.addEventListener("pagehide", () => {
    try {
      console.log(`[META_PAGEHIDE] user=${state.currentUsername || 'n/a'} src=remoteLogs/service.js:pagehide`);
    } catch {}
    trySendMetadataBeacon();
  });

  window.addEventListener("beforeunload", () => {
    try {
      console.log(`[META_PAGE_RELOAD] user=${state.currentUsername || 'n/a'} src=remoteLogs/service.js:beforeunload`);
    } catch {}
    trySendMetadataBeacon();
  });

  state.lifecycleEventsBound = true;
}

export function startRemoteLogging() {
  initializeDebugMode();
  probe("DEBUG_PIPELINE_LOCAL_OK", `debugMode=${state.debugMode}`);

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
      try {
        const now = Date.now();
        if (now - (state._probe?.lastTimerProbeTs || 0) >= 10000) {
          state._probe.lastTimerProbeTs = now;
          probe("DEBUG_FLUSH_TIMER_TICK", `buffer=${state.logBuffer.length}`);
        }
      } catch {}
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
