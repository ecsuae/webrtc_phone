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

import { sendCallMediaEvent } from './callMediaLog.js';

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

  function renderProfileBadgeBeforeLogin(selectedProfile) {
    const badge = document.getElementById('activeProfileBadge');
    if (!badge) return;
    const renderedIcon = selectedProfile === 'lte' ? '5g' : 'wifi';
    const renderedIconClass = selectedProfile === 'lte' ? 'fa-solid fa-signal' : 'fa-solid fa-wifi';
    const renderedLabel = selectedProfile === 'lte' ? 'LTE' : 'Wi-Fi';
    badge.innerHTML = `<i class="${renderedIconClass}"></i>`;
    badge.classList.toggle('profile-lte', selectedProfile === 'lte');
    badge.classList.toggle('profile-wifi', selectedProfile !== 'lte');
    badge.setAttribute('title', selectedProfile === 'lte' ? 'LTE/5G compatibility profile selected' : 'Normal (Wi-Fi) profile selected');

    try {
      sendCallMediaEvent({
        type: 'profile-badge-rendered',
        selectedProfile,
        renderedIcon,
        renderedIconClass,
        renderedLabel,
        beforeLogin: true,
        msg: 'Profile badge rendered (toggle)',
      });
    } catch {
      // no-op
    }
  }

  function refresh() {
    const on = isMobileCompatModeEnabled();
    btn.classList.toggle("mobile-compat-active", on);
    btn.title = on
      ? "LTE/5G Compatibility Mode: ON — all media via TURN relay. Click to disable."
      : "LTE/5G Compatibility Mode: OFF — click to enable if registration fails on mobile data.";
    btn.querySelector(".compat-label").textContent = on
      ? "LTE/5G Mode: ON"
      : "LTE/5G Mode";

    renderProfileBadgeBeforeLogin(on ? 'lte' : 'wifi');
  }

  btn.addEventListener("click", () => {
    const nextOn = !isMobileCompatModeEnabled();
    setMobileCompatMode(nextOn);
    try {
      sendCallMediaEvent({
        type: 'profile-toggle-changed',
        selectedProfile: nextOn ? 'lte' : 'wifi',
        lteMode: nextOn,
        beforeLogin: true,
        msg: 'User toggled LTE/5G compatibility mode',
      });
    } catch {
      // no-op
    }
    refresh();
  });

  refresh();
}
