import * as Push from "../../push.js";
import { checkIOSInstallation } from "../../ui/iosInstallPrompt.js";
import { setupInstallShortcut } from "../../push/installShortcut.js";

export function setupDesktopPush({ el, logLine, nowISO }) {
  Push.init().catch((err) => console.warn("Push notifications not available:", err));

  setTimeout(() => {
    checkIOSInstallation();
  }, 2000);

  setupInstallShortcut({ button: el.btnInstallApp, logLine });

  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    window.addEventListener("load", () => {
      logLine(`[${nowISO()}] [iOS] Push initialization`);
      Push.init().catch(() => {});
    });
  }
}
