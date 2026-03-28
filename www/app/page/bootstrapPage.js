import { renderAppLayout } from "../layout/renderAppLayout.js?v=1773032001";
import { refreshEl } from "../dom.js?v=1773032001";
import { initDialpadInput } from "./dialpadInput.js?v=1773032001";
import { initKeyboardToggle } from "./keyboardToggle.js?v=1773032001";
import { setupCacheActions } from "./cacheActions.js";
import { setupDebugToggleUi } from "./debugToggleUi.js";
import { initSkinMode } from "./skinMode.js";
import { initMobileCompatToggle } from "../features/mobileNetworkMode.js";

export async function bootstrapPage() {
  console.log("[boot] index module loader running");
  console.log("[boot] window.SIP present?", !!window.SIP);

  initSkinMode();
  renderAppLayout();
  refreshEl();
  initDialpadInput();
  initKeyboardToggle();
  setupCacheActions();
  setupDebugToggleUi();
  initMobileCompatToggle();

  await import("../main.js?v=1773032001");
}
