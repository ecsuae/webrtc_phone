import { headerSection } from "./headerSection.js?v=1772995480";
import { statusBarSection } from "./statusBarSection.js?v=1772995480";
import { registrationSection } from "./registrationSection.js?v=1772995480";
import { dialpadSection } from "./dialpadSection.js?v=1772995480";
import { logSection } from "./logSection.js?v=1772995480";

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
