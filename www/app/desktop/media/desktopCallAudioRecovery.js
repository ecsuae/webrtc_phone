import { nowISO, logLine } from "../desktopLogging.js";

export async function attemptDesktopUplinkRecovery(session, ui, reason = "silent-uplink") {
  logLine(`[${nowISO()}] [desktop:uplink:recovery] no-op - using SIP.js localMediaStream - reason=${reason}`);
  return { ok: true, reason: "no-op-restored" };
}