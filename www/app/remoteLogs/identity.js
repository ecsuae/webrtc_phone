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

export function getDeviceInfo() {
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
    currentUsername: state.currentUsername || "not-logged-in",
    usernameHistory: getUsernameHistory(),
    debugMode: state.debugMode,
  };
}
