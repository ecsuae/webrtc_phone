export function parseDesktopSdpAudioSummary(sdp) {
  try {
    if (!sdp || typeof sdp !== "string") return [];
    const lines = sdp.split(/\r?\n/);
    const out = [];
    let cur = null;
    for (const ln of lines) {
      if (!ln) continue;
      if (ln.startsWith("m=")) {
        if (cur) out.push(cur);
        cur = null;
        if (ln.startsWith("m=audio")) {
          cur = { mLine: ln, mid: null, direction: null, msid: null };
        }
        continue;
      }
      if (!cur) continue;
      if (ln.startsWith("a=mid:")) cur.mid = ln.slice("a=mid:".length) || null;
      else if (ln === "a=sendrecv" || ln === "a=sendonly" || ln === "a=recvonly" || ln === "a=inactive") cur.direction = ln.slice(2);
      else if (ln.startsWith("a=msid:")) cur.msid = ln.slice("a=msid:".length) || null;
    }
    if (cur) out.push(cur);
    return out.slice(0, 4);
  } catch {
    return [];
  }
}
