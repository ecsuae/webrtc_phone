import * as Push from "../../push.js";
import { setupInstallShortcut } from "../../push/installShortcut.js";

export function setupAndroidPush({ el, logLine }) {
  Push.init().catch((err) => console.warn("Push notifications not available:", err));
  setupInstallShortcut({ button: el.btnInstallApp, logLine });
}
