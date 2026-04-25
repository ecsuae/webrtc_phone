import { logLine } from "../../desktopLogging.js";
import { requestDesktopProvisioning } from "./desktopProvisioningClient.js";
import { applyProvisionedConfigToDesktopInputs } from "./applyProvisionedConfigToDesktopInputs.js";
import { desktopEl } from "../../ui/desktopDomRefs.js";
import { saveSessionPassword } from "../../desktopRecoverySession.js";
import { persistDesktopLastRegistration } from "../../registration/ext/desktopRegistrationStorage.js";

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

function getTrimmedValueById(id) {
  const el = document.getElementById(id);
  const v = String(el?.value || "").trim();
  return { el, value: v };
}

function getTempDeterministicDeviceId() {
  const platform = String(navigator?.platform || "").replace(/\s+/g, "_").slice(0, 24);
  const ua = String(navigator?.userAgent || "");
  const uaCompact = ua.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 32);
  const host = String(window?.location?.host || "").replace(/[^a-zA-Z0-9.:-]+/g, "_").slice(0, 32);
  return `desktop_${platform || "unknown"}_${host || "local"}_${uaCompact || "ua"}`;
}

async function runProvisioningFlow() {
  const { value: provisioningId } = getTrimmedValueById("provisioningId");
  const { value: pin } = getTrimmedValueById("provisioningPin");

  if (!provisioningId || !pin) {
    return {
      ok: false,
      message: "Provisioning ID and PIN are required.",
    };
  }

  const res = await requestDesktopProvisioning({
    provisioningId,
    pin,
    deviceId: getTempDeterministicDeviceId(),
    deviceName: "Desktop WebRTC",
    platform: "desktop",
    appVersion: "",
  });

  if (!res?.ok) {
    return {
      ok: false,
      message: res?.message || "Provisioning request failed",
    };
  }

  const applied = applyProvisionedConfigToDesktopInputs({
    config: res?.config,
    desktopEl,
    saveSessionPassword,
    persistDesktopLastRegistration,
  });

  if (!applied?.ok) {
    return {
      ok: false,
      message: applied?.message || "Failed to apply provisioned settings",
    };
  }

  try {
    const a = applied?.applied || {};
    const ext = String(a?.ext || "");
    const domain = String(a?.domain || "");
    const wss = String(a?.wss || "");
    logLine(`[ui] Auto Provision: applied ext=${ext} domain=${domain} wsshost=${wss}`);
  } catch {}

  return { ok: true };
}

function triggerStartAndRegister(startAndRegister) {
  if (typeof startAndRegister !== "function") {
    return {
      ok: false,
      error_code: "MISSING_START_AND_REGISTER",
      message: "Registration trigger is not available.",
    };
  }
  try {
    void startAndRegister();
  } catch (err) {
    return {
      ok: false,
      error_code: "START_AND_REGISTER_FAILED",
      message: err?.message || String(err),
    };
  }
  return { ok: true };
}

export function bindDesktopAutoProvisioningModalHandlers({ startAndRegister } = {}) {
  const openBtn = document.getElementById("btnAutoProvisionOpen");
  const cancelBtn = document.getElementById("btnAutoProvisionCancel");
  const configureBtn = document.getElementById("btnAutoProvisionConfigure");
  const modalEl = document.getElementById("autoProvisionModal");

  if (!openBtn || !cancelBtn || !configureBtn || !modalEl) return;

  if (openBtn.__autoProvisionBound) return;
  openBtn.__autoProvisionBound = true;

  openBtn.addEventListener("click", () => {
    clearLocalStatus();
    setModalVisible(modalEl, true);
  });

  cancelBtn.addEventListener("click", () => {
    clearLocalStatus();
    setModalVisible(modalEl, false);
  });

  configureBtn.addEventListener("click", async () => {
    clearLocalStatus();

    configureBtn.disabled = true;
    try {
      showLocalStatus("Contacting provisioning service...");

      const out = await runProvisioningFlow();
      if (!out?.ok) {
        showLocalStatus(out?.message || "Auto provisioning failed");
        return;
      }

      const reg = triggerStartAndRegister(startAndRegister);
      if (!reg?.ok) {
        showLocalStatus(reg?.message || "Provisioning complete, but registration did not start.");
        return;
      }

      try {
        logLine("[ui] Auto Provision: config applied to desktop inputs");
      } catch {}
      showLocalStatus("Auto provisioning complete. Registration started.");
    } catch (err) {
      showLocalStatus(err?.message || String(err));
    } finally {
      configureBtn.disabled = false;
    }
  });
}
