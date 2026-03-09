import { renderAppLayout } from "../layout/renderAppLayout.js?v=1773023054";
import { initDialpadInput } from "./dialpadInput.js?v=1773023054";
import { initKeyboardToggle } from "./keyboardToggle.js?v=1773023054";
import { setupCacheActions } from "./cacheActions.js";
import { setupDebugToggleUi } from "./debugToggleUi.js";
import { initSkinMode } from "./skinMode.js";

export async function bootstrapPage() {
  console.log("[boot] index module loader running");
  console.log("[boot] window.SIP present?", !!window.SIP);

  initSkinMode();
  renderAppLayout();
  initDialpadInput();
  initKeyboardToggle();
  setupCacheActions();
  setupDebugToggleUi();

  await import("../main.js?v=1773031000");
}
