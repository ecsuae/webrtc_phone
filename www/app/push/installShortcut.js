import { getRuntimeEnv } from "../runtime/shared/runtimeEnv.js";

export function setupInstallShortcut({ button, logLine }) {
  if (!button) return;

  const HIDE_KEY = "webrtc_install_shortcut_hidden";
  let deferredInstallPrompt = null;

  const hideButton = () => {
    button.style.display = "none";
  };

  const shouldHideByDefault = () => {
    const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
    const hidden = localStorage.getItem(HIDE_KEY) === "1";
    return isStandalone || hidden;
  };

  if (shouldHideByDefault()) {
    hideButton();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  button.addEventListener("click", async () => {
    localStorage.setItem(HIDE_KEY, "1");
    hideButton();

    const env = getRuntimeEnv();
    const isIOS = !!env?.isIOS;
    const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;

    if (deferredInstallPrompt) {
      try {
        await deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
      } catch {}
      deferredInstallPrompt = null;
      return;
    }

    if (isIOS && !isStandalone) {
      alert("To add this app: tap Share (square with arrow) in Safari, then tap 'Add to Home Screen'.");
      return;
    }

    alert("Install option appears when supported by your browser. On iPhone Safari, use Share -> Add to Home Screen.");
    logLine?.("[Push] Install shortcut clicked");
  });
}
