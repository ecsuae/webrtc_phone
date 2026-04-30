import { renderAppLayout } from "../layout/renderAppLayout.js?v=1773033002";
import { refreshEl } from "../dom.js?v=1773033002";
import { initDialpadInput } from "./dialpadInput.js?v=1773033002";
import { initKeyboardToggle } from "./keyboardToggle.js?v=1773033002";
import { setupCacheActions } from "./cacheActions.js";
import { setupDebugToggleUi } from "./debugToggleUi.js";
import { initSkinMode } from "./skinMode.js";
import { initMobileCompatToggle } from "../features/mobileNetworkMode.js";

export async function bootstrapPage() {
  try {
    const build = String(window.__APP_BUILD__ || '');
    const cb = String(window.__BUILD_CB || '');
    console.log(`[BOOT_MARKER_BOOTSTRAP_PAGE] build=${build} cb=${cb} ts=${Date.now()} url=${import.meta.url}`);
  } catch {}
  try {
    const url = new URL(window.location.href);
    const hr = url.searchParams.get('hr') || '';
    const enabled = (() => {
      try { return localStorage.getItem('webrtc_calls_enabled'); } catch { return null; }
    })();
    const lastReg = (() => {
      try { return localStorage.getItem('webrtc_last_registration'); } catch { return null; }
    })();
    const lastPass = (() => {
      try { return sessionStorage.getItem('webrtc_last_pass'); } catch { return null; }
    })();
    console.log(`[POST_REFRESH_BOOT] hr=${hr} build=${String(window.__APP_BUILD__ || '')} cb=${String(window.__BUILD_CB || '')} enabled=${enabled} lastReg=${lastReg ? 'present' : 'null'} lastPass=${lastPass ? 'present' : 'null'} href=${window.location.href}`);
  } catch {}
  try {
    const controlled = Boolean(navigator.serviceWorker?.controller);
    console.log(`[SW_CONTROLLED] controlled=${controlled} controller=${navigator.serviceWorker?.controller?.scriptURL || 'none'} src=app/page/bootstrapPage.js`);
  } catch {}
  try {
    console.log(`[BOOT_BUILD_ID] url=${import.meta.url} src=app/page/bootstrapPage.js`);
  } catch {}
  console.log("[boot] index module loader running");
  console.log("[boot] window.SIP present?", !!window.SIP);

  initSkinMode();
  renderAppLayout();
  refreshEl();
  initDialpadInput();
  initKeyboardToggle();
  setupCacheActions();
  setupDebugToggleUi();
  try {
    const ua = String(navigator?.userAgent || "").toLowerCase();
    const isMobile = ua.includes("android") || ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod");
    if (isMobile) initMobileCompatToggle();
  } catch {}

  const cb = typeof window !== 'undefined' ? (window.__BUILD_CB || '') : '';
  const mainUrl = cb ? `../main.js?cb=${encodeURIComponent(cb)}` : "../main.js";
  await import(mainUrl);
}
