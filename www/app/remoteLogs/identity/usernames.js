import { state } from "../state.js";
import { getDeviceIdSyncFallback } from "./deviceIds.js";

export function getUsernameHistory() {
  try {
    const stored = localStorage.getItem("webrtc_username_history");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function resolveCurrentUsername() {
  if (state.currentUsername && state.currentUsername !== "not-logged-in") {
    try {
      const deviceId = getDeviceIdSyncFallback();
      console.log(`[META_BOOT_USERNAME] deviceId=${deviceId} user=${state.currentUsername} src=state`);
    } catch {}
    return state.currentUsername;
  }

  try {
    const storedCurrent = (localStorage.getItem("webrtc_current_username") || "").trim();
    if (storedCurrent) {
      try {
        const deviceId = getDeviceIdSyncFallback();
        console.log(`[META_BOOT_USERNAME] deviceId=${deviceId} user=${storedCurrent} src=localStorage`);
      } catch {}
      return storedCurrent;
    }
  } catch {
    // Ignore localStorage read failures.
  }

  try {
    const extEl = document.getElementById("ext");
    const raw = (extEl?.value || "").trim();
    if (raw) {
      const parsed = raw.includes("@") ? raw.split("@")[0].trim() : raw;
      if (parsed) {
        try {
          const deviceId = getDeviceIdSyncFallback();
          console.log(`[META_BOOT_USERNAME] deviceId=${deviceId} user=${parsed} src=ext_input`);
        } catch {}
        return parsed;
      }
    }
  } catch {
    // Ignore DOM lookup failures.
  }

  const history = getUsernameHistory();
  if (history.length > 0) {
    const picked = history[history.length - 1] || "not-logged-in";
    try {
      const deviceId = getDeviceIdSyncFallback();
      console.log(`[META_BOOT_USERNAME] deviceId=${deviceId} user=${picked} src=history`);
    } catch {}
    return picked;
  }

  try {
    const deviceId = getDeviceIdSyncFallback();
    console.log(`[META_RESET_USERNAME] deviceId=${deviceId} user=not-logged-in src=resolveCurrentUsername`);
  } catch {}
  return "not-logged-in";
}
