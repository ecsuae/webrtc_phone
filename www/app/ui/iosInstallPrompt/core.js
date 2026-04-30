import { getRuntimeEnv } from "../runtime/shared/runtimeEnv.js";
import {
  showIOSInstallBanner,
  showNotificationPromptBanner,
  bindIosInstallVisibilityRecheck,
  hideAllBanners,
} from "./iosInstallPrompt/banners.js";

let _bound = false;

export function checkIOSInstallation() {
  const env = getRuntimeEnv();
  const isIOS = !!env?.isIOS;

  if (!isIOS) return false;

  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;

  if (!isStandalone) {
    if (!_bound) {
      _bound = true;
      bindIosInstallVisibilityRecheck(() => {
        const standaloneNow = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
        if (!standaloneNow) return;
        hideAllBanners();
        if ("Notification" in window && Notification.permission === "default") {
          showNotificationPromptBanner();
        }
      });
    }

    showIOSInstallBanner();
    return false;
  }

  if ("Notification" in window && Notification.permission === "default") {
    showNotificationPromptBanner();
    return false;
  }

  return true;
}
