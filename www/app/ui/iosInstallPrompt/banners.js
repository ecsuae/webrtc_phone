import { showIOSInstallBanner, dismissIOSInstallBanner, hasInstallBanner } from "./installBanner.js";
import { showNotificationPromptBanner, dismissNotificationBanner } from "./notificationBanner.js";

export { showIOSInstallBanner, dismissIOSInstallBanner, hasInstallBanner };
export { showNotificationPromptBanner, dismissNotificationBanner };

export function bindIosInstallVisibilityRecheck(onVisible) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      setTimeout(() => {
        onVisible?.();
      }, 1000);
    }
  });
}

export function hideAllBanners() {
  dismissIOSInstallBanner();
  dismissNotificationBanner();
}
