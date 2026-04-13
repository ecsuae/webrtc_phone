import {
  emitDesktopHardRefreshBootMarkers,
  setupDesktopHardRefreshButtonBinding,
} from "./ext/desktopCacheHardRefreshSetup.js";
import { installDesktopClearAllCacheAndReload } from "./ext/desktopCacheHardRefreshClear.js";

export function setupDesktopCacheActions() {
  try {
    emitDesktopHardRefreshBootMarkers({ phase: "setup" });
  } catch {}

  try {
    setupDesktopHardRefreshButtonBinding();
  } catch {}

  try {
    installDesktopClearAllCacheAndReload();
  } catch {}
}
