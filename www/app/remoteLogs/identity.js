import { state } from "./state.js";

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

function detectOSInfo() {
  const ua = navigator.userAgent;
  let osName = "unknown";
  let osVersion = "unknown";

  // Detect OS from user agent
  if (/Windows NT/.test(ua)) {
    osName = "Windows";
    const match = ua.match(/Windows NT ([\d.]+)/);
    if (match) {
      const versions = { "10.0": "10", "6.3": "8.1", "6.2": "8", "6.1": "7" };
      osVersion = versions[match[1]] || match[1];
    }
  } else if (/Mac OS X/.test(ua)) {
    osName = "macOS";
    const match = ua.match(/Mac OS X ([\d_]+)/);
    if (match) {
      osVersion = match[1].replace(/_/g, ".");
      // Note: Safari freezes user agent at 10_15_7 for privacy reasons
      if (osVersion === "10.15.7") {
        osVersion = "10.15.7+";
      }
    }
  } else if (/iPhone|iPad/.test(ua)) {
    osName = /iPhone/.test(ua) ? "iOS" : "iPadOS";
    const match = ua.match(/OS ([\d_]+)/);
    if (match) osVersion = match[1].replace(/_/g, ".");
  } else if (/Android/.test(ua)) {
    osName = "Android";
    const match = ua.match(/Android ([\d.]+)/);
    if (match) osVersion = match[1];
  } else if (/Linux/.test(ua)) {
    osName = "Linux";
  }

  return { osName, osVersion, osInfo: `${osName}-${osVersion}` };
}

function detectBrowserInfo() {
  const ua = navigator.userAgent;
  let browserName = "unknown";
  let browserVersion = "unknown";

  try {
    if (typeof navigator.brave !== "undefined") {
      browserName = "Brave";
      const braveMatch = ua.match(/Chrome\/([\d.]+)/);
      if (braveMatch) browserVersion = braveMatch[1];
      return { browserName, browserVersion };
    }
  } catch {
    // Ignore Brave detection errors.
  }

  // Detect browser
  if (/Arc\//.test(ua)) {
    browserName = "Arc";
    const match = ua.match(/Arc\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/EdgA\//.test(ua)) {
    browserName = "Edge Android";
    const match = ua.match(/EdgA\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/EdgiOS\//.test(ua)) {
    browserName = "Edge iOS";
    const match = ua.match(/EdgiOS\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Edg\//.test(ua)) {
    browserName = "Edge";
    const match = ua.match(/Edg\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/CriOS\//.test(ua)) {
    browserName = "Chrome iOS";
    const match = ua.match(/CriOS\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/FxiOS\//.test(ua)) {
    browserName = "Firefox iOS";
    const match = ua.match(/FxiOS\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
    browserName = "Chrome";
    const match = ua.match(/Chrome\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Vivaldi\//.test(ua)) {
    browserName = "Vivaldi";
    const match = ua.match(/Vivaldi\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    browserName = "Safari";
    const match = ua.match(/Version\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Firefox/.test(ua)) {
    browserName = "Firefox";
    const match = ua.match(/Firefox\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Opera|OPR/.test(ua)) {
    browserName = "Opera";
    const match = ua.match(/(?:Opera|OPR)\/([\d.]+)/);
    if (match) browserVersion = match[1];
  }

  return { browserName, browserVersion };
}

function detectDeviceModel() {
  const ua = navigator.userAgent;
  let deviceModel = "unknown";

  // Try to extract iPhone/iPad model
  if (/iPhone/.test(ua)) {
    deviceModel = "iPhone";
    // Note: iPhone models are hard to detect precisely from user agent alone
    // But we can show it's an iPhone
  } else if (/iPad/.test(ua)) {
    deviceModel = "iPad";
  } else if (/Android/.test(ua)) {
    // Try to extract Android device model
    const match = ua.match(/;\s*([^;)]+)\s+Build\//);
    if (match && match[1]) {
      deviceModel = match[1].trim();
    } else {
      deviceModel = "Android Device";
    }
  } else if (/Macintosh/.test(ua)) {
    deviceModel = "Mac";
  } else if (/Windows/.test(ua)) {
    deviceModel = "PC";
  } else if (/Linux/.test(ua)) {
    deviceModel = "Linux PC";
  }

  return deviceModel;
}

function getDeviceFingerprint() {
  const { osInfo } = detectOSInfo();
  const parts = [
    osInfo,
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
  if (state.browserId) return state.browserId;

  const cookieValue = getCookie("webrtc_browser_id");
  if (cookieValue) {
    state.browserId = cookieValue;
    return state.browserId;
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

  state.browserId = stored;
  try {
    localStorage.setItem("webrtc_browser_id", state.browserId);
  } catch {
    // Ignore localStorage write failures.
  }
  setCookie("webrtc_browser_id", state.browserId);
  return state.browserId;
}

export function getOrCreateDeviceId() {
  if (state.deviceId) return state.deviceId;

  try {
    let stored = localStorage.getItem("webrtc_device_id") || getCookie("webrtc_device_id");
    if (!stored) {
      const fingerprint = getDeviceFingerprint();
      stored = `device_${fingerprint.slice(0, 16)}`;
    }
    try {
      localStorage.setItem("webrtc_device_id", stored);
    } catch {
      // Ignore localStorage write failures.
    }
    setCookie("webrtc_device_id", stored);
    state.deviceId = stored;
  } catch {
    // Fallback if localStorage is not accessible.
    const fingerprint = getDeviceFingerprint();
    state.deviceId = `device_${fingerprint.slice(0, 16)}`;
    setCookie("webrtc_device_id", state.deviceId);
  }

  return state.deviceId;
}

export function getUsernameHistory() {
  try {
    const stored = localStorage.getItem("webrtc_username_history");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function resolveCurrentUsername() {
  if (state.currentUsername && state.currentUsername !== "not-logged-in") {
    return state.currentUsername;
  }

  try {
    const storedCurrent = (localStorage.getItem("webrtc_current_username") || "").trim();
    if (storedCurrent) return storedCurrent;
  } catch {
    // Ignore localStorage read failures.
  }

  // Fallback: read current value from login field if available.
  try {
    const extEl = document.getElementById("ext");
    const raw = (extEl?.value || "").trim();
    if (raw) {
      const parsed = raw.includes("@") ? raw.split("@")[0].trim() : raw;
      if (parsed) return parsed;
    }
  } catch {
    // Ignore DOM lookup failures.
  }

  // Final fallback: use last known username from history.
  const history = getUsernameHistory();
  if (history.length > 0) {
    return history[history.length - 1] || "not-logged-in";
  }

  return "not-logged-in";
}

export function getDeviceInfo() {
  const ua = navigator.userAgent.toLowerCase();
  let device = "unknown";
  if (ua.includes("iphone") || ua.includes("ipad")) device = "iOS";
  else if (ua.includes("android")) device = "Android";
  else if (ua.includes("macintosh")) device = "macOS";
  else if (ua.includes("windows")) device = "Windows";

  const { osName, osVersion } = detectOSInfo();
  const { browserName, browserVersion } = detectBrowserInfo();
  const deviceModel = detectDeviceModel();
  const currentUsername = resolveCurrentUsername();
  const platform = navigator.platform || "unknown";
  const language = navigator.language || "unknown";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  const screenInfo = `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`;

  console.log("[RemoteLogs] Captured device info:", {
    currentUsername,
    osName,
    osVersion,
    browserName,
    browserVersion,
    deviceModel,
    platform,
    screenInfo,
    timeZone
  });

  return {
    device,
    deviceType: device,
    deviceModel,
    browserName,
    browserVersion,
    osName,
    osVersion,
    platform,
    language,
    timeZone,
    screenInfo,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    deviceId: getOrCreateDeviceId(),
    browserId: getOrCreateBrowserId(),
    deviceFingerprint: getDeviceFingerprint(),
    browserFingerprint: getBrowserFingerprint(),
    currentUsername,
    usernameHistory: getUsernameHistory(),
    debugMode: state.debugMode,
  };
}
