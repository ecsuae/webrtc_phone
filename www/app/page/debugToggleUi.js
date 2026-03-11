import { toggleDebugMode, isDebugMode } from "../remoteLogs.js?v=20260310-r1";

export function setupDebugToggleUi() {
  window.toggleDebugModeUI = function () {
    try {
      const btn = document.getElementById("debugToggle");
      const isDebug = toggleDebugMode();
      if (!btn) return;

      if (isDebug) {
        btn.classList.add("debug-active");
        btn.title = "Debug Mode ON - Logs are being captured";
        alert("Debug Mode ENABLED\n\nLogs will now be captured and sent every 60 seconds.");
      } else {
        btn.classList.remove("debug-active");
        btn.title = "Debug Mode OFF - Only metadata is being tracked";
        alert("Debug Mode DISABLED\n\nOnly device metadata will be tracked.");
      }
    } catch (err) {
      console.error("[DebugToggle] Error toggling debug mode:", err);
      alert("Error toggling debug mode. Check console for details.");
    }
  };

  const btn = document.getElementById("debugToggle");
  if (!btn) return;

  if (isDebugMode()) {
    btn.classList.add("debug-active");
    btn.title = "Debug Mode ON - Logs are being captured";
  } else {
    btn.title = "Debug Mode OFF - Only metadata is being tracked";
  }
}
