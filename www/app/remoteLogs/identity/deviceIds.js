import { state } from "../state.js";
import { getCookie, setCookie } from "./cookies.js";
import { getDeviceFingerprint } from "./fingerprints.js";

export function getOrCreateBrowserId() {
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

function openDeviceDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("webrtc_device_db", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("device")) {
        db.createObjectStore("device");
      }
    };
  });
}

async function getDeviceIdFromDB() {
  try {
    const db = await openDeviceDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["device"], "readonly");
      const store = transaction.objectStore("device");
      const request = store.get("deviceId");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function saveDeviceIdToDB(deviceId) {
  try {
    const db = await openDeviceDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["device"], "readwrite");
      const store = transaction.objectStore("device");
      const request = store.put(deviceId, "deviceId");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Ignore DB write failures
  }
}

export async function getOrCreateDeviceId({ ua } = {}) {
  if (state.deviceId) return state.deviceId;

  let stored = null;

  try {
    stored = await getDeviceIdFromDB();
    console.log("[identity] Device ID from IndexedDB:", stored ? "found" : "not found");
  } catch (err) {
    console.warn("[identity] IndexedDB read failed:", err.message);
  }

  if (!stored) {
    try {
      stored = localStorage.getItem("webrtc_device_id");
      console.log("[identity] Device ID from localStorage:", stored ? "found" : "not found");
    } catch {
      stored = null;
    }
  }

  if (!stored) {
    stored = getCookie("webrtc_device_id");
    console.log("[identity] Device ID from cookie:", stored ? "found" : "not found");
  }

  if (!stored) {
    const fingerprint = getDeviceFingerprint({ ua });
    stored = `device_${fingerprint.slice(0, 8)}`;
    console.log("[identity] Generated NEW device ID:", stored);
  }

  state.deviceId = stored;

  try {
    await saveDeviceIdToDB(stored);
  } catch (err) {
    console.warn("[identity] IndexedDB write failed:", err.message);
  }

  try {
    localStorage.setItem("webrtc_device_id", stored);
  } catch (err) {
    console.warn("[identity] localStorage write failed:", err.message);
  }

  setCookie("webrtc_device_id", stored);

  console.log("[identity] Using device ID:", stored);
  return state.deviceId;
}

export function getDeviceIdSyncFallback({ ua } = {}) {
  if (state.deviceId && typeof state.deviceId === "string") return state.deviceId;

  try {
    const fromStorage = localStorage.getItem("webrtc_device_id");
    if (fromStorage) {
      state.deviceId = fromStorage;
      return fromStorage;
    }
  } catch {
    // Ignore localStorage read failures.
  }

  const fromCookie = getCookie("webrtc_device_id");
  if (fromCookie) {
    state.deviceId = fromCookie;
    return fromCookie;
  }

  const generated = `device_${getDeviceFingerprint({ ua }).slice(0, 8)}`;
  state.deviceId = generated;
  return generated;
}
