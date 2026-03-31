import { ICE_SERVERS, ICE_TRANSPORT_POLICY, nowISO } from "../config.js";
import { formatSipResponse, logLine } from "../log.js";

export async function stopSecondaryRegistration(st) {
  try { await st.sbcReg?.unregister?.(); } catch {}
  try { await st.sbcUa?.stop?.(); } catch {}
  st.sbcUa = null;
  st.sbcReg = null;
}
