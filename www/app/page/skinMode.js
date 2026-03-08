const STORAGE_KEY = "webrtc_skin";
const FALLBACK_SKIN = "modern-ops";
const ALLOWED_SKINS = new Set(["modern-ops", "minimal-ios", "dark-console"]);

function pickSkin() {
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  const fromConfig = window.APP_CONFIG?.SKIN;
  const candidate = fromStorage || fromConfig || FALLBACK_SKIN;
  return ALLOWED_SKINS.has(candidate) ? candidate : FALLBACK_SKIN;
}

export function applySkin(skin) {
  const selected = ALLOWED_SKINS.has(skin) ? skin : FALLBACK_SKIN;
  document.body.setAttribute("data-skin", selected);
  try {
    localStorage.setItem(STORAGE_KEY, selected);
  } catch {
    // Ignore storage failures.
  }
  return selected;
}

export function initSkinMode() {
  const active = applySkin(pickSkin());

  // Runtime helpers for quick switching without deploy changes.
  window.setWebphoneSkin = (skinName) => applySkin(skinName);
  window.getWebphoneSkin = () => document.body.getAttribute("data-skin") || active;
  window.listWebphoneSkins = () => Array.from(ALLOWED_SKINS);

  console.log("[skin] active:", active);
}
