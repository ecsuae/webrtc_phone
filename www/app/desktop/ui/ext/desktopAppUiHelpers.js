import { updateDomainDisplay, updateUsernameDisplay } from "../../../features/accountDisplay.js";
import { isMobileCompatModeEnabled } from "../../../features/mobileNetworkMode.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { desktopEl } from "../desktopDomRefs.js";

export function setDesktopUiText(node, text) {
  if (!node) return;
  node.textContent = text;
}

export function getDesktopUiDefaultsFromBody() {
  const d = document.body?.dataset || {};
  return {
    sipDomain: (d.sipDomain || "").trim(),
    wssHost: (d.wssHost || "").trim(),
  };
}

export function parseDesktopUiSipAccount(usernameValue, domainValue, fallbackDomainValue) {
  const rawUsername = (usernameValue || "").trim();
  const explicitDomain = (domainValue || "").trim();
  const fallbackDomain = (fallbackDomainValue || "").trim();

  let username = rawUsername;
  let inlineDomain = "";

  const atIndex = rawUsername.lastIndexOf("@");
  if (atIndex > 0 && atIndex < rawUsername.length - 1) {
    username = rawUsername.slice(0, atIndex).trim();
    inlineDomain = rawUsername.slice(atIndex + 1).trim();
  }

  const domain = inlineDomain || explicitDomain || fallbackDomain;
  return {
    rawUsername,
    username,
    domain,
    inlineDomain,
    hasInlineDomain: !!inlineDomain,
  };
}

export function updateDesktopUiControlVisibility(st, ui) {
  const registered = !!st.registered;
  const hasIncoming = !!st.incomingInvitation;
  const inCall = !!st.session;
  const showDialpad = registered || inCall || hasIncoming;

  const prevInCall = !!updateDesktopUiControlVisibility.__prevInCall;
  updateDesktopUiControlVisibility.__prevInCall = inCall;
  if (prevInCall && !inCall) {
    try {
      if (desktopEl.dial) desktopEl.dial.value = "";
    } catch {}

    try {
      if (window.callTimer) window.callTimer.stop();
    } catch {}
  }

  const selectedProfile = st.selectedProfile;
  const profileBadge = document.getElementById("activeProfileBadge");
  if (profileBadge) {
    const beforeLogin = !registered;
    const resolved = selectedProfile === "lte" || selectedProfile === "wifi"
      ? selectedProfile
      : beforeLogin && isMobileCompatModeEnabled()
        ? "lte"
        : "wifi";

    const renderedIconClass = resolved === "lte" ? "fa-solid fa-signal" : "fa-solid fa-wifi";
    profileBadge.innerHTML = `<i class="${renderedIconClass}"></i>`;
    profileBadge.classList.toggle("profile-lte", resolved === "lte");
    profileBadge.classList.toggle("profile-wifi", resolved !== "lte");

    try {
      sendCallMediaEvent({
        type: "profile-badge-rendered",
        selectedProfile: resolved,
        renderedIconClass,
        beforeLogin,
        msg: "Profile badge rendered",
      });
    } catch {}
  }

  const setButtonLabel = (button, iconClass, text) => {
    if (!button) return;
    const icon = button.querySelector("i");
    const span = button.querySelector("span");
    if (icon && iconClass) icon.className = iconClass;
    if (span) span.textContent = text;
  };

  const activateDialTab = () => {
    const dialBtn = document.querySelector('.tab-btn[data-tab="dial-tab"]');
    const allBtns = document.querySelectorAll('.tab-btn[data-tab]');
    const allTabs = document.querySelectorAll('.tab-content');
    allBtns.forEach((btn) => btn.classList.remove("active"));
    allTabs.forEach((tab) => tab.classList.remove("active"));
    dialBtn?.classList.add("active");
    document.getElementById("dial-tab")?.classList.add("active");
  };

  desktopEl.registrationCard?.style?.setProperty("display", registered ? "none" : "");
  desktopEl.dialpadCard?.style?.setProperty("display", showDialpad ? "" : "none");

  desktopEl.btnStart && (desktopEl.btnStart.style.display = registered ? "none" : "");
  desktopEl.btnStop && (desktopEl.btnStop.style.display = registered ? "" : "none");

  try {
    const logOffBtn = document.getElementById("logOffBtn");
    if (logOffBtn) logOffBtn.style.display = registered ? "" : "none";
  } catch {}

  if (desktopEl.btnCall) {
    desktopEl.btnCall.disabled = !registered || inCall;
    desktopEl.btnCall.style.display = "";
    if (hasIncoming) setButtonLabel(desktopEl.btnCall, "fas fa-phone", "Accept");
    else setButtonLabel(desktopEl.btnCall, "fas fa-phone", "Call");
  }
  if (desktopEl.btnHangup) {
    desktopEl.btnHangup.disabled = !(inCall || hasIncoming);
    desktopEl.btnHangup.style.display = inCall || hasIncoming ? "" : "none";
    if (hasIncoming) setButtonLabel(desktopEl.btnHangup, "fas fa-phone-slash", "Reject");
    else setButtonLabel(desktopEl.btnHangup, "fas fa-phone-slash", "End");
  }

  document.querySelector(".dial-display")?.style?.setProperty("display", inCall ? "none" : "");
  document.querySelector(".dial-buttons")?.style?.setProperty("display", inCall ? "none" : "");
  document.getElementById("callControls")?.style?.setProperty("display", inCall ? "grid" : "none");

  try {
    const card = document.getElementById("dialpadCard");
    card?.classList?.toggle("in-call", inCall);
  } catch {}

  if (inCall || hasIncoming) activateDialTab();

  if (registered) {
    const currentAccount = st.account || ui.account();
    if (currentAccount?.username && currentAccount?.domain) {
      updateUsernameDisplay(currentAccount.username, desktopEl.status);
      updateDomainDisplay(currentAccount.domain, desktopEl.domainDisplay);
    } else if (currentAccount?.username) {
      updateUsernameDisplay(currentAccount.username, desktopEl.status);
      setDesktopUiText(desktopEl.domainDisplay, "-");
    } else {
      setDesktopUiText(desktopEl.status, "-");
      setDesktopUiText(desktopEl.domainDisplay, "-");
    }
  }

  try {
    document.getElementById("statusIndicator")?.classList?.toggle("connected", registered);
  } catch {}

  try {
    window.dispatchEvent(new Event("ui:buttons-updated"));
  } catch {}
}
