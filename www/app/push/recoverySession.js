const PASS_KEY = "webrtc_last_pass";

export function saveSessionPassword(pass) {
  if (!pass) return;
  try {
    sessionStorage.setItem(PASS_KEY, pass);
  } catch {}
}

export function clearSessionPassword() {
  try {
    sessionStorage.removeItem(PASS_KEY);
  } catch {}
}

export function hydratePasswordInput(passInput, logLine) {
  if (!passInput || passInput.value) return;
  try {
    const savedPass = sessionStorage.getItem(PASS_KEY);
    if (!savedPass) return;
    passInput.value = savedPass;
    logLine?.("[Recovery] Restored password from session");
  } catch {}
}
