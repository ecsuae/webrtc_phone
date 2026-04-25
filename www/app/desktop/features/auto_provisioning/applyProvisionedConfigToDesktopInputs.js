function missingField(name) {
  return {
    ok: false,
    error_code: "INVALID_CONFIG",
    message: `Missing required field: ${name}`,
  };
}

export function applyProvisionedConfigToDesktopInputs({
  config,
  desktopEl,
  saveSessionPassword,
  persistDesktopLastRegistration,
}) {
  if (!config) return { ok: false, error_code: "INVALID_CONFIG", message: "Missing config" };

  const sipUsername = config?.sip_username;
  const sipPassword = config?.sip_password;
  const sipDomain = config?.sip_domain;

  if (!sipUsername) return missingField("sip_username");
  if (!sipPassword) return missingField("sip_password");
  if (!sipDomain) return missingField("sip_domain");

  const extInput = desktopEl?.ext;
  const passInput = desktopEl?.pass;
  const domainInput = desktopEl?.domain;
  const wssInput = desktopEl?.wss;

  if (!extInput || !passInput || !domainInput || !wssInput) {
    return {
      ok: false,
      error_code: "MISSING_INPUTS",
      message: "Desktop inputs not available",
    };
  }

  try {
    extInput.value = String(sipUsername);
    passInput.value = String(sipPassword);
    domainInput.value = String(sipDomain);
  } catch (err) {
    return {
      ok: false,
      error_code: "WRITE_FAILED",
      message: err?.message || String(err),
    };
  }

  try {
    if (typeof saveSessionPassword === "function") saveSessionPassword(String(sipPassword));
  } catch {}

  try {
    if (typeof persistDesktopLastRegistration === "function") {
      persistDesktopLastRegistration({
        ext: String(sipUsername),
        domain: String(sipDomain),
        wss: String(wssInput?.value || ""),
      });
    }
  } catch {}

  return {
    ok: true,
    applied: {
      ext: String(sipUsername),
      domain: String(sipDomain),
      wss: String(wssInput?.value || ""),
    },
  };
}
