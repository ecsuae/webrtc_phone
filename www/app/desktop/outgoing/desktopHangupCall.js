import { nowISO, logLine } from "../desktopLogging.js";
import { releaseDesktopCallAudio } from "../media/desktopCallAudioRuntime.js";
import { stopRingbackTone } from "./desktopRingbackDelegate.js";

function isInboundSession(session) {
  try {
    if (!session) return false;
    return !!session.remoteIdentity && !session.invite2xx && !session.outgoingRequestMessage?.callId;
  } catch {
    return false;
  }
}

export async function hangupCallDesktop(st, ui, silent = false) {
  if (!st?.session) return;

  const SIP = window.SIP;
  const s = st.session;
  const inbound = isInboundSession(s);

  if (!silent) logLine(`[${nowISO()}] [call] hangup`);

  stopRingbackTone({ trigger: "hangup", reason: "hangup" });

  try {
    if (s.state === SIP.SessionState.Established) await s.bye();
    else await s.cancel();
  } catch {}

  try {
    const releaseReason = inbound ? "inbound-hangup" : "outbound-hangup";
    releaseDesktopCallAudio(releaseReason, {
      session: s,
      corrId: s?.__webrtcCorrId || st?.__webrtcCorrId || null,
      callId: s?.outgoingRequestMessage?.callId || null,
      micId: s?.__desktopMicId || null,
    });
  } catch {}
  st.session = null;

  try {
    if (window.callTimer) window.callTimer.stop();
  } catch {}

  try {
    ui?.setButtons?.();
    ui?.setStatus?.("Idle");
  } catch {}
}
