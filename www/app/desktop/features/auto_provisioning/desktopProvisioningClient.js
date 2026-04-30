export async function requestDesktopProvisioning({
  provisioningId,
  pin,
  deviceId,
  deviceName,
  platform,
  appVersion,
}) {
  const url = "/api/provisioning/desktop";

  const body = {
    provisioning_id: String(provisioningId || ""),
    pin: String(pin || ""),
    device_id: String(deviceId || ""),
    device_name: String(deviceName || ""),
    platform: String(platform || ""),
    app_version: String(appVersion || ""),
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      error_code: "NETWORK_ERROR",
      message: err?.message || String(err),
      status: 0,
    };
  }

  const status = Number(res?.status || 0);

  let payload = null;
  try {
    payload = await res.json();
  } catch (err) {
    return {
      ok: false,
      error_code: "INVALID_JSON",
      message: "Invalid JSON response from server",
      status,
    };
  }

  const success = !!payload?.success;
  if (success) {
    return {
      ok: true,
      config: payload?.config || null,
    };
  }

  return {
    ok: false,
    error_code: String(payload?.error_code || "UNKNOWN_ERROR"),
    message: String(payload?.message || "Request failed"),
    status,
  };
}
