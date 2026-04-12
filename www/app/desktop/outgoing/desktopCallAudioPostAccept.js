import { nowISO, logLine } from "../desktopLogging.js";

export async function syncDesktopUplinkAfterEstablished(session, ui, reason = "post-accept") {
  logLine(`[${nowISO()}] [desktop:call-audio] post-accept sync no-op reason=${reason} - using SIP.js localMediaStream`);
  return { ok: true, reason: "no-op-restored" };
}