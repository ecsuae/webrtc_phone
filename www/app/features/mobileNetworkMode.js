/**
 * Mobile Network Compatibility Mode
 *
 * When enabled, forces ICE transport policy to "relay" so all WebRTC media
 * flows through the TURN server. This works around carrier CGNAT and firewall
 * restrictions common on LTE/5G networks that block UDP STUN candidates.
 *
 * This is NOT an encryption feature. It is a relay/routing change only.
 * Normal Wi-Fi users should leave this off — it adds TURN relay overhead.
 *
 * Setting is persisted in localStorage and applied on the next UA construction
 * (i.e. on next login or reconnect).
 */

const STORAGE_KEY = "webrtc_mobile_compat_mode";

export function isMobileCompatModeEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setMobileCompatMode(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Bind the toggle button rendered by registrationSection.
 * Call this once after the layout is rendered.
 */
export function initMobileCompatToggle() {
  const btn = document.getElementById("btnMobileCompat");
  if (!btn) return;

  function refresh() {
    const on = isMobileCompatModeEnabled();
    btn.classList.toggle("mobile-compat-active", on);
    btn.title = on
      ? "LTE/5G Compatibility Mode: ON — all media via TURN relay. Click to disable."
      : "LTE/5G Compatibility Mode: OFF — click to enable if registration fails on mobile data.";
    btn.querySelector(".compat-label").textContent = on
      ? "LTE/5G Mode: ON"
      : "LTE/5G Mode";
  }

  btn.addEventListener("click", () => {
    setMobileCompatMode(!isMobileCompatModeEnabled());
    refresh();
  });

  refresh();
}
