import { defaultsFromBody, el, parseSipAccount, setText } from "../dom.js";
import { updateUsernameDisplay, updateDomainDisplay } from "../features/accountDisplay.js";

function updateControlVisibility(st, ui) {
  const registered = st.registered;
  const hasIncoming = !!st.incomingInvitation;
  const inCall = !!st.session;

  document.getElementById("registrationCard")?.style.setProperty("display", registered ? "none" : "");
  document.getElementById("dialpadCard")?.style.setProperty("display", registered ? "" : "none");
  document.getElementById("refreshBtn")?.style.setProperty("display", "");
  document.getElementById("logOffBtn")?.style.setProperty("display", registered ? "" : "none");
  document.getElementById("accountFields")?.style.setProperty("display", registered ? "none" : "grid");

  if (el.btnStart) el.btnStart.style.display = registered ? "none" : "";
  if (el.btnStop) el.btnStop.style.display = registered ? "" : "";

  if (el.btnCall) {
    el.btnCall.disabled = !registered || inCall || hasIncoming;
    el.btnCall.style.display = hasIncoming ? "none" : "";
  }
  if (el.btnHangup) {
    el.btnHangup.disabled = !inCall;
    el.btnHangup.style.display = hasIncoming ? "none" : "";
  }
  if (el.btnAnswer) {
    el.btnAnswer.disabled = !hasIncoming;
    el.btnAnswer.style.display = hasIncoming ? "" : "none";
  }
  if (el.btnReject) {
    el.btnReject.disabled = !hasIncoming;
    el.btnReject.style.display = hasIncoming ? "" : "none";
  }

  document.querySelector(".dial-display")?.style.setProperty("display", inCall ? "none" : "");
  document.querySelector(".dial-buttons")?.style.setProperty("display", inCall ? "none" : "");
  document.getElementById("callControls")?.style.setProperty("display", inCall ? "grid" : "none");

  if (registered) {
    const currentAccount = st.account || ui.account();
    if (currentAccount?.username && currentAccount?.domain) {
      // Use account display feature to format username and domain separately
      updateUsernameDisplay(currentAccount.username, el.status);
      updateDomainDisplay(currentAccount.domain, el.domainDisplay);
    } else if (currentAccount?.username) {
      updateUsernameDisplay(currentAccount.username, el.status);
      setText(el.domainDisplay, "-");
    } else {
      setText(el.status, "-");
      setText(el.domainDisplay, "-");
    }
  }

  const indicator = document.getElementById("statusIndicator");
  if (indicator) indicator.classList.toggle("connected", registered);
}

export function createUi(st) {
  const d = defaultsFromBody();
  if (el.domain && !el.domain.value) el.domain.value = d.sipDomain;
  if (el.wss && !el.wss.value) el.wss.value = d.wssHost;

  const ui = {
    ext: () => el.ext?.value?.trim(),
    domain: () => el.domain?.value?.trim(),
    domainFallback: () => d.sipDomain,
    account: () => parseSipAccount(el.ext?.value, el.domain?.value, d.sipDomain),
    pass: () => el.pass?.value ?? "",
    wss: () => el.wss?.value,
    wssFallback: () => (window.location?.host || d.wssHost || ""),
    dial: () => el.dial?.value?.trim(),
    remoteAudio: () => el.remoteAudio,
    setStatus: (s) => {
      const account = st.account || ui.account();
      if (st.registered && account?.username && account?.domain) {
        // Use account display feature to format username and domain separately
        updateUsernameDisplay(account.username, el.status);
        updateDomainDisplay(account.domain, el.domainDisplay);
      } else {
        setText(el.status, s);
        setText(el.domainDisplay, "-");
      }
      document.getElementById("statusIndicator")?.classList.toggle("connected", st.registered);
    },
    setTransport: (s) => setText(el.tstatus, s),
    setButtons: () => updateControlVisibility(st, ui),
  };

  ui.setStatus("Idle");
  ui.setTransport("-");
  ui.setButtons();
  return ui;
}
