import { state } from "./state.js";
import { getRuntimeEnv } from "../runtime/shared/runtimeEnv.js";
import { getUaDerivedInfo } from "./identity/uaDerived.js";
import { getDeviceFingerprint, getBrowserFingerprint } from "./identity/fingerprints.js";
import {
  getOrCreateDeviceId as getOrCreateDeviceIdImpl,
  getOrCreateBrowserId,
  getDeviceIdSyncFallback,
} from "./identity/deviceIds.js";
import { getUsernameHistory, resolveCurrentUsername } from "./identity/usernames.js";

export async function getOrCreateDeviceId() {
  const env = getRuntimeEnv();
  const ua = String(env?.userAgent || "");
  return getOrCreateDeviceIdImpl({ ua });
}

export { getUsernameHistory };

export function getDeviceInfo() {
  const env = getRuntimeEnv();
  const ua = String(env?.userAgent || "");

  const uaLower = ua.toLowerCase();
  let device = "unknown";
  if (uaLower.includes("iphone") || uaLower.includes("ipad")) device = "iOS";
  else if (uaLower.includes("android")) device = "Android";
  else if (uaLower.includes("macintosh")) device = "macOS";
  else if (uaLower.includes("windows")) device = "Windows";

  let isBrave = false;
  try {
    isBrave = typeof navigator.brave !== "undefined";
  } catch {
    isBrave = false;
  }

  const { osName, osVersion, browserName, browserVersion, deviceModel } = getUaDerivedInfo({ ua, isBrave });
  const currentUsername = resolveCurrentUsername();
  const platform = navigator.platform || "unknown";
  const language = navigator.language || "unknown";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  const screenInfo = `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`;
  const deviceId = getDeviceIdSyncFallback({ ua });

  try {
    console.log(`[META_SEND_USERNAME] deviceId=${deviceId} user=${currentUsername} debugMode=${state.debugMode} src=remoteLogs/identity.js:getDeviceInfo`);
  } catch {}

  getOrCreateDeviceId().catch(() => {});

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
    userAgent: ua,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    deviceId,
    browserId: getOrCreateBrowserId(),
    deviceFingerprint: getDeviceFingerprint({ ua }),
    browserFingerprint: getBrowserFingerprint({ ua }),
    currentUsername,
    usernameHistory: getUsernameHistory(),
    debugMode: state.debugMode,
  };
}
