import { logLine } from "../../desktopLogging.js";
import {
  getTrimmedValueById,
  runProvisioningFlow,
  syncAutoProvisionStartButton,
  triggerStartAndRegister,
} from "./desktopProvisioningFlow.js";
import {
  clearSavedAutoProvisioningCreds,
  hasSavedAutoProvisioningCreds,
  loadSavedAutoProvisioningCreds,
  saveAutoProvisioningCreds,
} from "./desktopAutoProvisioningStorage.js";

function setModalVisible(modalEl, visible) {
  if (!modalEl) return;
  modalEl.style.setProperty("display", visible ? "block" : "none");
}

function showLocalStatus(msg) {
  const statusEl = document.getElementById("autoProvisionStatus");
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.setProperty("display", "block");
}

function clearLocalStatus() {
  const statusEl = document.getElementById("autoProvisionStatus");
  if (!statusEl) return;
  statusEl.textContent = "";
  statusEl.style.setProperty("display", "none");
}

function setForgetVisible(forgetBtn, visible) {
  if (!forgetBtn) return;
  forgetBtn.style.setProperty("display", visible ? "inline-flex" : "none");
}

function setSavedHintVisible(visible) {
  const hintEl = document.getElementById("autoProvisionSavedHint");
  if (!hintEl) return;
  hintEl.style.setProperty("display", visible ? "block" : "none");
}

function syncSavedUi({ forgetBtn, saveChk } = {}) {
  const hasSaved = hasSavedAutoProvisioningCreds();
  setForgetVisible(forgetBtn, hasSaved);
  setSavedHintVisible(hasSaved);
  if (saveChk && hasSaved) saveChk.checked = true;
  return hasSaved;
}

export function closeAutoProvisioningModal({ clearStatus = true } = {}) {
  setModalVisible(document.getElementById("autoProvisionModal"), false);
  if (clearStatus) clearLocalStatus();
}

export function bindDesktopAutoProvisioningModalHandlers({ startAndRegister } = {}) {
  const startBtn = document.getElementById("btnAutoProvisionStart");
  const cancelBtn = document.getElementById("btnAutoProvisionCancel");
  const loginBtn = document.getElementById("btnAutoProvisionConfigure");
  const modalEl = document.getElementById("autoProvisionModal");
  const idEl = document.getElementById("provisioningId");
  const saveChk = document.getElementById("chkSaveProvisioningCreds");
  const forgetBtn = document.getElementById("btnForgetProvisioningCreds");

  if (!startBtn || !cancelBtn || !loginBtn || !modalEl || !idEl) return;

  if (startBtn.__autoProvisionBound) return;
  startBtn.__autoProvisionBound = true;

  try {
    const saved = loadSavedAutoProvisioningCreds();
    if (!String(idEl?.value || "").trim() && saved?.id) idEl.value = saved.id;
    syncSavedUi({ forgetBtn, saveChk });
  } catch {}

  try {
    syncAutoProvisionStartButton();
    idEl.addEventListener("input", () => syncAutoProvisionStartButton());
  } catch {}

  startBtn.addEventListener("click", () => {
    const v = String(idEl?.value || "").trim();
    if (!v) return;
    clearLocalStatus();
    setModalVisible(modalEl, true);
    try {
      const pinEl = document.getElementById("provisioningPin");
      const saved = loadSavedAutoProvisioningCreds();
      if (pinEl && !String(pinEl.value || "").trim() && saved?.pin) pinEl.value = saved.pin;
      if (saveChk && (saved?.id || saved?.pin)) saveChk.checked = true;
      document.getElementById("provisioningPin")?.focus?.();
    } catch {}
  });

  cancelBtn.addEventListener("click", () => {
    closeAutoProvisioningModal();
  });

  loginBtn.addEventListener("click", async () => {
    clearLocalStatus();

    let wantsSave = false;
    try {
      wantsSave = !!saveChk?.checked;
    } catch {}

    loginBtn.disabled = true;
    try {
      showLocalStatus("Contacting provisioning service...");

      const out = await runProvisioningFlow();
      if (!out?.ok) {
        showLocalStatus(out?.message || "Auto provisioning failed");
        return;
      }

      if (wantsSave) {
        const { value: provisioningId } = getTrimmedValueById("provisioningId");
        const { value: pin } = getTrimmedValueById("provisioningPin");
        saveAutoProvisioningCreds({ id: provisioningId, pin });
        try {
          syncSavedUi({ forgetBtn, saveChk });
        } catch {
          setForgetVisible(forgetBtn, true);
          setSavedHintVisible(true);
        }
      }

      const reg = triggerStartAndRegister(startAndRegister);
      if (!reg?.ok) {
        showLocalStatus(reg?.message || "Provisioning complete, but registration did not start.");
        return;
      }

      try {
        logLine("[ui] Auto Provision: config applied to desktop inputs");
      } catch {}

      showLocalStatus(
        wantsSave
          ? "Auto provisioning complete. Registration started. ID & PIN saved on this device."
          : "Auto provisioning complete. Registration started."
      );
    } catch (err) {
      showLocalStatus(err?.message || String(err));
    } finally {
      loginBtn.disabled = false;
    }
  });

  try {
    forgetBtn?.addEventListener?.("click", () => {
      clearSavedAutoProvisioningCreds();
      try {
        if (saveChk) saveChk.checked = false;
      } catch {}
      try {
        const pinEl = document.getElementById("provisioningPin");
        if (pinEl) pinEl.value = "";
      } catch {}
      try {
        if (idEl) idEl.value = "";
        syncAutoProvisionStartButton();
      } catch {}
      try {
        setForgetVisible(forgetBtn, false);
        setSavedHintVisible(false);
      } catch {}
      showLocalStatus("Saved ID & PIN cleared.");
    });
  } catch {}
}
