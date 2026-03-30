import { headerSection } from "./headerSection.js?v=1773033002";
import { statusBarSection } from "./statusBarSection.js?v=1773033002";
import { registrationSection } from "./registrationSection.js?v=1773033002";
import { dialpadSection } from "./dialpadSection.js?v=1773033002";
import { logSection } from "./logSection.js?v=1773033002";

export function renderAppLayout() {
  const root = document.getElementById("appRoot");
  if (!root) return;

  root.innerHTML = `
    <div class="container">
      ${headerSection()}
      ${statusBarSection()}
      ${registrationSection()}
      ${dialpadSection()}
      ${logSection()}
    </div>
  `;
}
