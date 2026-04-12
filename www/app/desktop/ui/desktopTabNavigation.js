function activateTab(tabId) {
  const tabButtons = document.querySelectorAll(".tab-btn[data-tab]");
  const tabContents = document.querySelectorAll(".tab-content");
  tabButtons.forEach((b) => b.classList.remove("active"));
  tabContents.forEach((c) => c.classList.remove("active"));
  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  activeBtn?.classList.add("active");
  document.getElementById(tabId)?.classList.add("active");
}

function lockTabsToDial(lockEnabled) {
  const tabButtons = document.querySelectorAll(".tab-btn[data-tab]");
  tabButtons.forEach((btn) => {
    const isDialBtn = btn.getAttribute("data-tab") === "dial-tab";
    btn.classList.toggle("is-tab-locked", lockEnabled && !isDialBtn);
    btn.setAttribute("aria-disabled", lockEnabled && !isDialBtn ? "true" : "false");

    if (lockEnabled && !isDialBtn) {
      btn.style.pointerEvents = "none";
    } else {
      btn.style.pointerEvents = "";
    }
  });

  const tabContents = document.querySelectorAll(".tab-content");
  tabContents.forEach((content) => {
    const isDialTab = content.id === "dial-tab";
    if (lockEnabled && !isDialTab) {
      content.style.pointerEvents = "none";
    } else {
      content.style.pointerEvents = "";
    }
  });
  if (lockEnabled) activateTab("dial-tab");
}

export function setupDesktopTabNavigation(st) {
  const tabButtons = document.querySelectorAll(".tab-btn[data-tab]");

  const isDialLockActive = () => !!(st?.session || st?.incomingInvitation);

  const syncLockState = () => {
    lockTabsToDial(isDialLockActive());
  };

  syncLockState();
  window.addEventListener("ui:buttons-updated", syncLockState);

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (isDialLockActive() && btn.getAttribute("data-tab") !== "dial-tab") {
        activateTab("dial-tab");
        return;
      }

      const tabId = btn.getAttribute("data-tab");
      if (tabId) activateTab(tabId);
    });
  });
}