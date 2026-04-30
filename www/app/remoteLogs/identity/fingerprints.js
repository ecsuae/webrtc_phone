import { simpleHash } from "./crypto.js";
import { getUaDerivedInfo } from "./uaDerived.js";

export function getDeviceFingerprint({ ua } = {}) {
  const { osInfo } = getUaDerivedInfo({ ua });
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

export function getBrowserFingerprint({ ua } = {}) {
  const parts = [
    ua || "na",
    navigator.vendor || "na",
    navigator.platform || "na",
    navigator.language || "na",
    Intl.DateTimeFormat().resolvedOptions().timeZone || "na",
  ];
  return simpleHash(parts.join("|"));
}
