import { headerSection } from "./headerSection.js";
import { statusBarSection } from "./statusBarSection.js";
import { registrationSection } from "./registrationSection.js";
import { dialpadSection } from "./dialpadSection.js";
import { logSection } from "./logSection.js";

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
