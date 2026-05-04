import { logLine } from "../../desktopLogging.js";
import { requestDesktopProvisioning } from "./desktopProvisioningClient.js";
import { applyProvisionedConfigToDesktopInputs } from "./applyProvisionedConfigToDesktopInputs.js";
import { desktopEl } from "../../ui/desktopDomRefs.js";
import { saveSessionPassword } from "../../desktopRecoverySession.js";
import { getDesktopAutoProvisionDeviceId } from "./desktopAutoProvisioningStorage.js";
import { markPendingDesktopAutoProvisioningLogin } from "./desktopProvisioningSession.js";

export function syncAutoProvisionStartButton() {
  const btn = document.getElementById("btnAutoProvisionStart");
  const idEl = document.getElementById("provisioningId");
  if (!btn || !idEl) return;
  const v = String(idEl?.value || "").trim();
  btn.disabled = !v;
}

export function getTrimmedValueById(id) {
  const el = document.getElementById(id);
  const v = String(el?.value || "").trim();
  return { el, value: v };
}

export async function runProvisioningFlow() {
  const { value: provisioningId } = getTrimmedValueById("provisioningId");
  const { value: pin } = getTrimmedValueById("provisioningPin");

  if (!provisioningId || !pin) {
    return { ok: false, message: "Provisioning ID and PIN are required." };
  }

  const deviceId = getDesktopAutoProvisionDeviceId();
  const res = await requestDesktopProvisioning({
    provisioningId,
    pin,
    deviceId,
    deviceName: "Desktop WebRTC",
    platform: "desktop",
    appVersion: "",
  });

  if (!res?.ok) {
    return { ok: false, message: res?.message || "Provisioning request failed" };
  }

  const applied = applyProvisionedConfigToDesktopInputs({
    config: res?.config,
    desktopEl,
    saveSessionPassword,
  });

  if (!applied?.ok) {
    return { ok: false, message: applied?.message || "Failed to apply provisioned settings" };
  }

  try {
    markPendingDesktopAutoProvisioningLogin({ provisioningId, deviceId });
    logLine("[ui] Auto Provision: applied");
  } catch {}

  return { ok: true };
}

export function triggerStartAndRegister(startAndRegister) {
  if (typeof startAndRegister !== "function") {
    return { ok: false, error_code: "MISSING_START_AND_REGISTER", message: "Registration trigger is not available." };
  }
  try {
    void startAndRegister();
  } catch (err) {
    return { ok: false, error_code: "START_AND_REGISTER_FAILED", message: err?.message || String(err) };
  }
  return { ok: true };
}
