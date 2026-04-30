import { updateDomainDisplay, updateUsernameDisplay } from "../../features/accountDisplay.js";
import { desktopEl } from "./desktopDomRefs.js";
import {
  getDesktopUiDefaultsFromBody,
  parseDesktopUiSipAccount,
  setDesktopUiText,
  updateDesktopUiControlVisibility,
} from "./ext/desktopAppUiHelpers.js";

export function createDesktopUi(st) {
  const d = getDesktopUiDefaultsFromBody();

  try {
    if (desktopEl.domain && !desktopEl.domain.value) desktopEl.domain.value = d.sipDomain;
    if (desktopEl.wss && !desktopEl.wss.value) desktopEl.wss.value = d.wssHost;
  } catch {}

  const ui = {
    ext: () => desktopEl.ext?.value?.trim(),
    domain: () => desktopEl.domain?.value?.trim(),
    domainFallback: () => d.sipDomain,
    account: () => parseDesktopUiSipAccount(desktopEl.ext?.value, desktopEl.domain?.value, d.sipDomain),
    pass: () => desktopEl.pass?.value ?? "",
    wss: () => desktopEl.wss?.value,
    wssFallback: () => window.location?.host || d.wssHost || "",
    dial: () => desktopEl.dial?.value?.trim(),
    remoteAudio: () => document.getElementById("remoteAudio"),
    setStatus: (s) => {
      const account = st.account || ui.account();
      if (st.registered && account?.username && account?.domain) {
        updateUsernameDisplay(account.username, desktopEl.status);
        updateDomainDisplay(account.domain, desktopEl.domainDisplay);
      } else {
        setDesktopUiText(desktopEl.status, s);
        setDesktopUiText(desktopEl.domainDisplay, "-");
      }
      document.getElementById("statusIndicator")?.classList?.toggle("connected", !!st.registered);

      try {
        const logOffBtn = document.getElementById("logOffBtn");
        if (logOffBtn) logOffBtn.style.display = st.registered ? "" : "none";
      } catch {}
    },
    setTransport: (s) => setDesktopUiText(desktopEl.tstatus, s),
    setButtons: () => updateDesktopUiControlVisibility(st, ui),
  };

  ui.setStatus("Idle");
  ui.setTransport("-");
  ui.setButtons();
  return ui;
}
