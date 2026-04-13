import { desktopHeaderSection, desktopLogSection, desktopStatusBarSection } from "./desktopShellSections.js";
import { buildDesktopLayoutSections } from "./ext/desktopLayoutSections.js";

const { desktopRegistrationSection, desktopDialpadSection } = buildDesktopLayoutSections();

export function renderDesktopAppLayout() {
  const root = document.getElementById("appRoot");
  if (!root) return;

  root.innerHTML = `
    <div class="container">
      ${desktopHeaderSection()}
      ${desktopStatusBarSection()}
      ${desktopRegistrationSection()}
      ${desktopDialpadSection()}
      ${desktopLogSection()}
    </div>
  `;
}
