import { renderAppLayout } from "../layout/renderAppLayout.js";
import { initDialpadInput } from "./dialpadInput.js";
import { setupCacheActions } from "./cacheActions.js";
import { setupDebugToggleUi } from "./debugToggleUi.js";

export async function bootstrapPage() {
  console.log("[boot] index module loader running");
  console.log("[boot] window.SIP present?", !!window.SIP);

  renderAppLayout();
  initDialpadInput();
  setupCacheActions();
  setupDebugToggleUi();

  await import("../main.js?v=20260307-ringback-debug-v6");
}
