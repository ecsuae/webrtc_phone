import { renderAppLayout } from "../layout/renderAppLayout.js?v=20260308-mobi-solid-v25";
import { initDialpadInput } from "./dialpadInput.js?v=20260308-mobi-solid-v25";
import { initKeyboardToggle } from "./keyboardToggle.js?v=20260308-mobi-solid-v25";
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

  await import("../main.js?v=20260307-ringback-debug-v6");
}
