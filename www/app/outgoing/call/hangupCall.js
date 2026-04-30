import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { stopLocalAudioStream } from "../../media.js";
import { stopRingbackTone } from "../ringback.js";

export async function hangupCall(SIP, st, ui, silent = false) {
  if (!st.session) return;
  const s = st.session;
  if (!silent) logLine(`[${nowISO()}] [call] hangup`);

  stopRingbackTone({ trigger: 'hangup', reason: 'hangup' });

  try {
    if (s.state === SIP.SessionState.Established) await s.bye();
    else await s.cancel();
  } catch {}

  stopLocalAudioStream();
  st.session = null;
  ui.setButtons();
  ui.setStatus('Idle');
}
