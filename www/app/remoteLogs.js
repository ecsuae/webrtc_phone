// Remote Logging Service
// Captures logs and sends them to SBC server for mobile debugging
// Especially useful for iOS/Android where console is not accessible
// Supports debug mode (full logs) and normal mode (metadata only)

const MAX_LOGS_PER_BATCH = 100;
const SEND_INTERVAL = 60000;  // Send every 60 seconds
const METADATA_SEND_INTERVAL = 300000; // Send metadata every 5 minutes

let logBuffer = [];
let sendTimer = null;
let metadataTimer = null;
let debugMode = false;
let currentUsername = null;
let deviceId = null;
let browserId = null;

function simpleHash(input) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return Math.abs(hash).toString(16);
}

function getCookie(name) {
  try {
    const prefix = `${name}=`;
    const parts = document.cookie.split(";").map((s) => s.trim());
    const found = parts.find((p) => p.startsWith(prefix));
    return found ? decodeURIComponent(found.slice(prefix.length)) : null;
  } catch {
    return null;
  }
}

function setCookie(name, value, days = 3650) {
  try {
    const expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    // Ignore cookie write failures.
  }
}

function getDeviceFingerprint() {
  const parts = [
    navigator.platform || "na",
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(window.devicePixelRatio || 1),
    String(navigator.hardwareConcurrency || "na"),
    String(navigator.deviceMemory || "na"),
    String(navigator.maxTouchPoints || 0),
    Intl.DateTimeFormat().resolvedOptions().timeZone || "na",
    navigator.language || "na",
  ];
  return simpleHash(parts.join("|"));
}

function getBrowserFingerprint() {
  const parts = [
    navigator.userAgent || "na",
    navigator.vendor || "na",
    navigator.platform || "na",
    navigator.language || "na",
    Intl.DateTimeFormat().resolvedOptions().timeZone || "na",
  ];
  return simpleHash(parts.join("|"));
}

function getOrCreateBrowserId() {
  if (browserId) return browserId;

  const cookieValue = getCookie("webrtc_browser_id");
  if (cookieValue) {
    browserId = cookieValue;
    return browserId;
  }

  let stored = null;
  try {
    stored = localStorage.getItem("webrtc_browser_id");
  } catch {
    stored = null;
  }

  if (!stored) {
    stored = `browser_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  browserId = stored;
  try {
    localStorage.setItem("webrtc_browser_id", browserId);
  } catch {
    // Ignore localStorage write failures.
  }
  setCookie("webrtc_browser_id", browserId);
  return browserId;
}

function pageIsVisible() {
  return typeof document !== "undefined" && document.visibilityState === "visible";
}

function trySendMetadataBeacon() {
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

// Generate or retrieve persistent device ID
function getOrCreateDeviceId() {
  if (deviceId) return deviceId;
  
  try {
    let stored = localStorage.getItem('webrtc_device_id') || getCookie('webrtc_device_id');
    if (!stored) {
      const fingerprint = getDeviceFingerprint();
      stored = `device_${fingerprint.slice(0, 16)}`;
    }
    try {
      localStorage.setItem('webrtc_device_id', stored);
    } catch {
      // Ignore localStorage write failures.
    }
    setCookie('webrtc_device_id', stored);
    deviceId = stored;
  } catch (e) {
    // Fallback if localStorage is not accessible
    const fingerprint = getDeviceFingerprint();
    deviceId = `device_${fingerprint.slice(0, 16)}`;
    setCookie('webrtc_device_id', deviceId);
  }
  return deviceId;
}

// Get username history for this device
function getUsernameHistory() {
  try {
    const stored = localStorage.getItem('webrtc_username_history');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

// Detect device type
function getDeviceInfo() {
  const ua = navigator.userAgent.toLowerCase();
  let device = "unknown";
  if (ua.includes("iphone") || ua.includes("ipad")) device = "iOS";
  else if (ua.includes("android")) device = "Android";
  else if (ua.includes("macintosh")) device = "macOS";
  else if (ua.includes("windows")) device = "Windows";
  
  return {
    device,
    deviceType: device,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    deviceId: getOrCreateDeviceId(),
    browserId: getOrCreateBrowserId(),
    deviceFingerprint: getDeviceFingerprint(),
    browserFingerprint: getBrowserFingerprint(),
    currentUsername: currentUsername || 'not-logged-in',
    usernameHistory: getUsernameHistory(),
    debugMode: debugMode
  };
}

// Check if debug mode is enabled
export function isDebugMode() {
  return debugMode;
}

// Toggle debug mode on/off
export function toggleDebugMode() {
  debugMode = !debugMode;
  try {
    localStorage.setItem('webrtc_debug_mode', debugMode ? 'true' : 'false');
  } catch (e) {
    // Ignore localStorage errors
  }
  console.log(`[RemoteLogs] Debug mode ${debugMode ? 'ENABLED' : 'DISABLED'}`);
  
  // Clear existing buffer if disabling debug mode
  if (!debugMode) {
    logBuffer = [];
  }
  
  // Manage timers based on debug mode
  if (debugMode) {
    // Start log sending timer if not running
    if (!sendTimer) {
      sendTimer = setInterval(sendLogsToServer, SEND_INTERVAL);
      console.log('[RemoteLogs] Started log sending timer');
    }
  } else {
    // Stop log sending timer
    if (sendTimer) {
      clearInterval(sendTimer);
      sendTimer = null;
      console.log('[RemoteLogs] Stopped log sending timer');
    }
  }
  
  // Send metadata update immediately
  sendMetadataToServer();
  
  return debugMode;
}

// Set current username
export function setUsername(username) {
  if (!username) return;
  
  const prevUsername = currentUsername;
  currentUsername = username;
  
  // Add username to history if new
  const history = getUsernameHistory();
  if (!history.includes(username)) {
    history.push(username);
    try {
      localStorage.setItem('webrtc_username_history', JSON.stringify(history));
      console.log(`[RemoteLogs] Added username to history: ${username}`);
    } catch (e) {
      // Ignore localStorage errors
    }
  }
  
  // Send metadata update immediately if username changed
  if (prevUsername !== username) {
    sendMetadataToServer();
  }
}

// Initialize debug mode from localStorage
function initializeDebugMode() {
  try {
    const stored = localStorage.getItem('webrtc_debug_mode');
    debugMode = stored === 'true';
  } catch (e) {
    debugMode = false;
  }
  console.log(`[RemoteLogs] Debug mode initialized: ${debugMode}`);
  return debugMode;
}

// Add log entry to buffer (only in debug mode)
export function captureLog(level, message) {
  // Only capture logs if debug mode is enabled
  if (!debugMode) return;
  
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };
  
  logBuffer.push(entry);
  
  // Keep only last 500 logs in memory
  if (logBuffer.length > 500) {
    logBuffer = logBuffer.slice(-500);
  }
  
  // Auto-send if buffer reaches max per batch
  if (logBuffer.length >= MAX_LOGS_PER_BATCH) {
    sendLogsToServer();
  }
}

// Send metadata to server (always sent, regardless of debug mode)
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
    console.log('[RemoteLogs] Sending metadata...');
    
    const response = await fetch("/api/logs/mobile/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deviceInfo),
    });
    
    if (response.ok) {
      console.log('[RemoteLogs] Metadata sent successfully');
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

// Send logs to server (only when debug mode enabled)
export async function sendLogsToServer() {
  if (!debugMode || logBuffer.length === 0) return;
  
  const logsToSend = logBuffer.slice();
  logBuffer = [];  // Clear buffer
  
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
      // Re-add logs if send failed
      logBuffer = logsToSend.concat(logBuffer);
    }
  } catch (err) {
    console.warn("[RemoteLogs] Failed to send logs:", err);
    // Re-add logs if send failed
    logBuffer = logsToSend.concat(logBuffer);
  }
}

// Start remote logging service
export function startRemoteLogging() {
  // Initialize debug mode from localStorage
  initializeDebugMode();
  
  // Send initial metadata after a short delay to ensure page is ready
  setTimeout(() => {
    sendMetadataToServer();
  }, 2000);
  
  // Start metadata sending timer (always active)
  if (!metadataTimer) {
    metadataTimer = setInterval(() => {
      sendMetadataToServer();
    }, METADATA_SEND_INTERVAL);
    console.log('[RemoteLogs] Started metadata timer');
  }
  
  // Start log sending timer only if debug mode is enabled
  if (debugMode && !sendTimer) {
    sendTimer = setInterval(() => {
      sendLogsToServer();
    }, SEND_INTERVAL);
    console.log('[RemoteLogs] Started log sending timer (debug mode)');
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
  
  console.log(`[RemoteLogs] Service started - Device: ${getOrCreateDeviceId()}, Debug: ${debugMode}`);
}

// Get current log buffer (for debugging)
export function getLogBuffer() {
  return [...logBuffer];
}

// Get device info
export function getInfo() {
  return getDeviceInfo();
}
