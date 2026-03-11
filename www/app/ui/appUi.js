import { defaultsFromBody, el, parseSipAccount, setText } from "../dom.js";
import { updateUsernameDisplay, updateDomainDisplay } from "../features/accountDisplay.js";

let callNavigationLockActive = false;
let callNavigationGuardInstalled = false;

function installCallNavigationGuard() {
  if (callNavigationGuardInstalled || typeof window === "undefined") return;

  const forceDialTab = () => {
    const dialBtn = document.querySelector('.tab-btn[data-tab="dial-tab"]');
    if (dialBtn instanceof HTMLElement) dialBtn.click();
  };

  window.addEventListener("popstate", () => {
    if (!callNavigationLockActive) return;
    try {
      window.history.pushState({ dialerCallLock: true }, "", window.location.href);
    } catch {
      // Ignore browser history guard errors.
    }
    forceDialTab();
  });

  // Stop accidental taps/swipes from switching tabs during a call.
  // Capture phase so it wins against other handlers.
  const interactionGuard = (e) => {
    if (!callNavigationLockActive) return;
    const target = e.target;
    if (!(target instanceof Element)) return;

    const tabBtn = target.closest?.('.tab-btn[data-tab]');
    const tab = tabBtn?.getAttribute?.('data-tab');
    if (tab && tab !== 'dial-tab') {
      e.preventDefault?.();
      e.stopPropagation?.();
      forceDialTab();
    }
  };
  document.addEventListener("touchstart", interactionGuard, { capture: true, passive: false });
  document.addEventListener("click", interactionGuard, { capture: true });

  // Best-effort protection against leaving the page while a call is active.
  window.addEventListener("beforeunload", (e) => {
    if (!callNavigationLockActive) return;
    e.preventDefault();
    e.returnValue = "";
  });

  callNavigationGuardInstalled = true;
}

function setCallNavigationLock(enabled) {
  installCallNavigationGuard();
  if (!enabled) {
    callNavigationLockActive = false;
    return;
  }

  if (!callNavigationLockActive) {
    try {
      window.history.pushState({ dialerCallLock: true }, "", window.location.href);
    } catch {
      // Ignore browser history guard errors.
    }
  }
  callNavigationLockActive = true;
}

function updateControlVisibility(st, ui) {
  const registered = st.registered;
  const hasIncoming = !!st.incomingInvitation;
  const inCall = !!st.session;
  const showDialpad = registered || inCall || hasIncoming;

  const setButtonLabel = (button, iconClass, text) => {
    if (!button) return;
    const icon = button.querySelector("i");
    const span = button.querySelector("span");
    if (icon && iconClass) icon.className = iconClass;
    if (span) span.textContent = text;
  };

  const activateDialTab = () => {
    const dialBtn = document.querySelector('.tab-btn[data-tab="dial-tab"]');
    const allBtns = document.querySelectorAll(".tab-btn[data-tab]");
    const allTabs = document.querySelectorAll(".tab-content");
    allBtns.forEach((btn) => btn.classList.remove("active"));
    allTabs.forEach((tab) => tab.classList.remove("active"));
    dialBtn?.classList.add("active");
    document.getElementById("dial-tab")?.classList.add("active");
  };

  document.getElementById("registrationCard")?.style.setProperty("display", registered ? "none" : "");
  document.getElementById("dialpadCard")?.style.setProperty("display", showDialpad ? "" : "none");
  document.getElementById("refreshBtn")?.style.setProperty("display", "");
  document.getElementById("logOffBtn")?.style.setProperty("display", registered ? "" : "none");
  document.getElementById("accountFields")?.style.setProperty("display", registered ? "none" : "grid");

  if (el.btnStart) el.btnStart.style.display = registered ? "none" : "";
  if (el.btnStop) el.btnStop.style.display = registered ? "" : "";

  if (el.btnCall) {
    el.btnCall.disabled = !registered || inCall;
    el.btnCall.style.display = "";
    if (hasIncoming) {
      setButtonLabel(el.btnCall, "fas fa-phone", "Accept");
    } else {
      setButtonLabel(el.btnCall, "fas fa-phone", "Call");
    }
  }
  if (el.btnHangup) {
    el.btnHangup.disabled = !(inCall || hasIncoming);
    el.btnHangup.style.display = inCall || hasIncoming ? "" : "none";
    if (hasIncoming) {
      setButtonLabel(el.btnHangup, "fas fa-phone-slash", "Reject");
    } else {
      setButtonLabel(el.btnHangup, "fas fa-phone-slash", "End");
    }
  }
  if (el.btnAnswer) {
    el.btnAnswer.disabled = !hasIncoming;
    el.btnAnswer.style.display = "none";
  }
  if (el.btnReject) {
    el.btnReject.disabled = !hasIncoming;
    el.btnReject.style.display = "none";
  }

  document.querySelector(".dial-display")?.style.setProperty("display", inCall ? "none" : "");
  document.querySelector(".dial-buttons")?.style.setProperty("display", inCall ? "none" : "");
  document.getElementById("callControls")?.style.setProperty("display", inCall ? "grid" : "none");

  if (inCall || hasIncoming) {
    activateDialTab();
  }
  setCallNavigationLock(inCall || hasIncoming);

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
  window.dispatchEvent(new Event("ui:buttons-updated"));
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
    // Layout is rendered dynamically, so always resolve the audio element at call time.
    remoteAudio: () => document.getElementById("remoteAudio"),
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
