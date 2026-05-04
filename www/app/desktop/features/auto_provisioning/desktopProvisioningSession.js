const KEY_PENDING = "desktop_auto_provision_pending_login";
const KEY_ACTIVE = "desktop_auto_provision_active_login";

let _provisionedSipConfig = null;

function encode(info) {
  return JSON.stringify({
    provisioningId: String(info?.provisioningId || ""),
    deviceId: String(info?.deviceId || ""),
  });
}

function decode(raw) {
  try {
    const v = JSON.parse(String(raw || "{}"));
    const provisioningId = String(v?.provisioningId || "").trim();
    const deviceId = String(v?.deviceId || "").trim();
    return provisioningId && deviceId ? { provisioningId, deviceId } : null;
  } catch {
    return null;
  }
}

export function markPendingDesktopAutoProvisioningLogin(info) {
  try {
    sessionStorage.setItem(KEY_PENDING, encode(info));
  } catch {}
}

export function setDesktopProvisionedSipConfig(config) {
  try {
    const sipUsername = String(config?.sipUsername || "");
    const sipPassword = String(config?.sipPassword || "");
    const sipDomain = String(config?.sipDomain || "");
    if (!sipUsername || !sipPassword || !sipDomain) {
      _provisionedSipConfig = null;
      return { ok: false };
    }
    _provisionedSipConfig = { sipUsername, sipPassword, sipDomain };
    return { ok: true };
  } catch {
    _provisionedSipConfig = null;
    return { ok: false };
  }
}

export function consumeDesktopProvisionedSipConfig() {
  const v = _provisionedSipConfig;
  _provisionedSipConfig = null;
  return v;
}

export function clearDesktopProvisionedSipConfig() {
  _provisionedSipConfig = null;
}

export function consumePendingDesktopAutoProvisioningLogin() {
  try {
    const info = decode(sessionStorage.getItem(KEY_PENDING));
    sessionStorage.removeItem(KEY_PENDING);
    if (info) {
      const encoded = encode(info);
      sessionStorage.setItem(KEY_ACTIVE, encoded);
      localStorage.setItem(KEY_ACTIVE, encoded);
    }
    return info;
  } catch {
    return null;
  }
}

export function getActiveDesktopAutoProvisioningSession() {
  return decode(sessionStorage.getItem(KEY_ACTIVE)) || decode(localStorage.getItem(KEY_ACTIVE));
}

function shortId(v) {
  return String(v || "").slice(0, 12);
}

export function logDesktopAutoProvisioningLogout(msg) {
  try {
    console.log(`[auto-prov-logout] ${msg}`);
  } catch {}
}

export async function releaseDesktopAutoProvisioningSession(info) {
  const sessionInfo = info || getActiveDesktopAutoProvisioningSession();
  logDesktopAutoProvisioningLogout(
    `start provisioning_id_present=${!!sessionInfo?.provisioningId} device_id_present=${!!sessionInfo?.deviceId} device_id_short=${shortId(sessionInfo?.deviceId)}`
  );
  if (!sessionInfo) return { ok: false, status: 0 };
  try {
    logDesktopAutoProvisioningLogout("fetch endpoint called yes");
    try { console.log("[auto-prov-logout] fetch endpoint called yes"); } catch {}
    const res = await fetch("/api/provisioning/desktop/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        provisioning_id: sessionInfo.provisioningId,
        device_id: sessionInfo.deviceId,
      }),
    });
    logDesktopAutoProvisioningLogout(`response status=${res?.status || 0}`);
    let data = null;
    try {
      data = await res.json();
    } catch {}
    const activeAfter = data?.device?.active_after === false || data?.device?.active === false ? "false" : "unknown";
    logDesktopAutoProvisioningLogout(`backend active_after=${activeAfter}`);
    if (res.ok) {
      try {
        sessionStorage.removeItem(KEY_ACTIVE);
        localStorage.removeItem(KEY_ACTIVE);
      } catch {}
    }
    return { ok: res.ok, status: res.status, activeAfter };
  } catch (err) {
    logDesktopAutoProvisioningLogout(`fetch error=${err?.message || err}`);
    return { ok: false, status: 0 };
  }
}

export function clearAutoProvisionedVisibleCredentials(desktopEl) {
  try {
    if (desktopEl?.ext) desktopEl.ext.value = "";
    if (desktopEl?.pass) desktopEl.pass.value = "";
    logDesktopAutoProvisioningLogout(`clear visible credentials called yes ext_empty=${!desktopEl?.ext?.value} pass_empty=${!desktopEl?.pass?.value}`);
  } catch {}
}
