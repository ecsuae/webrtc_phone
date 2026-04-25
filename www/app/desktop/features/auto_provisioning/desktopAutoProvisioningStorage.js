const KEY_ID = "desktop_auto_provision_id";
const KEY_PIN = "desktop_auto_provision_pin";

export function loadSavedAutoProvisioningCreds() {
  try {
    const id = String(localStorage.getItem(KEY_ID) || "").trim();
    const pin = String(localStorage.getItem(KEY_PIN) || "").trim();
    return { id, pin };
  } catch {
    return { id: "", pin: "" };
  }
}

export function saveAutoProvisioningCreds({ id, pin } = {}) {
  try {
    localStorage.setItem(KEY_ID, String(id || ""));
    localStorage.setItem(KEY_PIN, String(pin || ""));
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
}

export function clearSavedAutoProvisioningCreds() {
  try {
    localStorage.removeItem(KEY_ID);
    localStorage.removeItem(KEY_PIN);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
}

export function hasSavedAutoProvisioningCreds() {
  try {
    const { id, pin } = loadSavedAutoProvisioningCreds();
    return !!(id || pin);
  } catch {
    return false;
  }
}
