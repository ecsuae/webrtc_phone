import { nowISO, logLine } from "../desktopLogging.js";
import { attemptDesktopUplinkRecovery } from "./desktopCallAudioRecovery.js";
import {
  getDesktopUplinkSenderStatsSnapshot,
  isDesktopUplinkLikelySilent,
  pickDesktopUplinkAudioSender,
  snapDesktopUplinkTrack,
} from "./ext/desktopUplinkStatsHelpers.js";

export function startDesktopUplinkDiagnostics(SIP, session, ui, reason = "established") {
  try {
    if (!session || session.__desktopUplinkDiagStarted) return { ok: false, skipped: true };
    session.__desktopUplinkDiagStarted = true;
  } catch {}

  try {
    if (!Array.isArray(session.__desktopUplinkDiagHistory)) session.__desktopUplinkDiagHistory = [];
  } catch {}

  const pc = session?.sessionDescriptionHandler?.peerConnection || null;
  if (!pc) {
    logLine(`[${nowISO()}] [desktop:uplink:diag] skipped: no peerConnection (reason=${reason})`);
    return { ok: false, reason: "missing-pc" };
  }

  const sender = pickDesktopUplinkAudioSender(pc);
  const t = snapDesktopUplinkTrack(sender?.track);

  logLine(
    `[${nowISO()}] [desktop:uplink:diag] start reason=${reason} sender=${!!sender} trackId=${t.id || "?"} enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`
  );

  let prev = null;
  let silentHits = 0;
  let tick = 0;

  const interval = setInterval(async () => {
    tick += 1;
    const curr = await getDesktopUplinkSenderStatsSnapshot(sender);

    try {
      session.__desktopUplinkDiagHistory.push({
        ts: nowISO(),
        tick,
        pk: curr?.outbound?.packetsSent ?? null,
        bytes: curr?.outbound?.bytesSent ?? null,
        lvl: curr?.audioSource?.audioLevel ?? null,
        eng: curr?.audioSource?.totalAudioEnergy ?? null,
      });
      if (session.__desktopUplinkDiagHistory.length > 20) {
        session.__desktopUplinkDiagHistory.splice(0, session.__desktopUplinkDiagHistory.length - 20);
      }
    } catch {}

    try {
      const pk = curr?.outbound?.packetsSent;
      const by = curr?.outbound?.bytesSent;
      const lvl = curr?.audioSource?.audioLevel;
      const eng = curr?.audioSource?.totalAudioEnergy;
      logLine(
        `[${nowISO()}] [desktop:uplink:diag] tick=${tick} pk=${Number.isFinite(pk) ? pk : "?"} bytes=${Number.isFinite(by) ? by : "?"} lvl=${typeof lvl === "number" ? lvl.toFixed(4) : "?"} eng=${typeof eng === "number" ? eng.toFixed(6) : "?"}`
      );
    } catch {}

    if (prev) {
      const silent = isDesktopUplinkLikelySilent({ prev, curr });
      if (silent) silentHits += 1;
      else silentHits = 0;

      if (silentHits >= 2) {
        logLine(`[${nowISO()}] [desktop:uplink:diag] likely-silent-uplink detected; attempting recovery`);
        try {
          await attemptDesktopUplinkRecovery(session, ui, "diag-silent-uplink");
        } catch {}
        silentHits = -999;
      }
    }

    prev = curr;

    if (tick >= 6) {
      // stop after ~12s
      try {
        clearInterval(interval);
      } catch {}
    }
  }, 2000);

  const stop = () => {
    try {
      clearInterval(interval);
    } catch {}
  };

  try {
    session.__desktopUplinkDiagStop = stop;
  } catch {}

  try {
    session.stateChange?.addListener?.((s) => {
      const termEnum = SIP?.SessionState?.Terminated;
      const isTerminated = termEnum ? s === termEnum : String(s) === "Terminated";
      if (isTerminated) {
        stop();
        logLine(`[${nowISO()}] [desktop:uplink:diag] stopped (terminated)`);
      }
    });
  } catch {}

  return { ok: true, stop };
}

export function stopDesktopUplinkDiagnostics(session) {
  try {
    const fn = session?.__desktopUplinkDiagStop;
    if (typeof fn === "function") fn();
    session.__desktopUplinkDiagStop = null;
  } catch {}
}
