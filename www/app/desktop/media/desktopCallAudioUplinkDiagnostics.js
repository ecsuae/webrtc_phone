import { nowISO, logLine } from "../desktopLogging.js";
import { attemptDesktopUplinkRecovery } from "./desktopCallAudioRecovery.js";

function pickAudioSender(pc) {
  try {
    const tr = (pc.getTransceivers?.() || []).find((t) => {
      const sk = t?.sender?.track?.kind;
      const rk = t?.receiver?.track?.kind;
      return sk === "audio" || rk === "audio";
    });
    if (tr?.sender) return tr.sender;
  } catch {}

  try {
    return (pc.getSenders?.() || []).find((s) => s?.track?.kind === "audio") || null;
  } catch {
    return null;
  }
}

function snapTrack(track) {
  try {
    return {
      id: track?.id || null,
      enabled: typeof track?.enabled === "boolean" ? track.enabled : null,
      muted: typeof track?.muted === "boolean" ? track.muted : null,
      readyState: track?.readyState || null,
    };
  } catch {
    return { id: null, enabled: null, muted: null, readyState: null };
  }
}

function extractOutbound(report) {
  const out = {
    bytesSent: null,
    packetsSent: null,
    kind: null,
    codecId: null,
    timestamp: null,
  };

  try {
    if (!report) return out;
    out.bytesSent = Number(report.bytesSent ?? NaN);
    out.packetsSent = Number(report.packetsSent ?? NaN);
    out.kind = report.kind || null;
    out.codecId = report.codecId || null;
    out.timestamp = Number(report.timestamp ?? NaN);
  } catch {}

  if (!Number.isFinite(out.bytesSent)) out.bytesSent = null;
  if (!Number.isFinite(out.packetsSent)) out.packetsSent = null;
  if (!Number.isFinite(out.timestamp)) out.timestamp = null;
  return out;
}

function extractAudioSource(report) {
  const out = {
    audioLevel: null,
    totalAudioEnergy: null,
    totalSamplesDuration: null,
    timestamp: null,
  };

  try {
    if (!report) return out;
    out.audioLevel = typeof report.audioLevel === "number" ? report.audioLevel : null;
    out.totalAudioEnergy = typeof report.totalAudioEnergy === "number" ? report.totalAudioEnergy : null;
    out.totalSamplesDuration = typeof report.totalSamplesDuration === "number" ? report.totalSamplesDuration : null;
    out.timestamp = Number(report.timestamp ?? NaN);
  } catch {}

  if (!Number.isFinite(out.timestamp)) out.timestamp = null;
  return out;
}

async function getSenderStatsSnapshot(sender) {
  const snap = {
    outbound: null,
    audioSource: null,
  };

  if (!sender?.getStats) return snap;

  try {
    const stats = await sender.getStats();
    stats?.forEach?.((r) => {
      if (!r) return;
      if (r.type === "outbound-rtp" && (r.kind === "audio" || r.mediaType === "audio")) {
        snap.outbound = extractOutbound(r);
      }
      if (r.type === "media-source" && (r.kind === "audio" || r.mediaType === "audio")) {
        snap.audioSource = extractAudioSource(r);
      }
    });
  } catch {}

  return snap;
}

function isLikelySilent({ prev, curr }) {
  try {
    const prevPk = prev?.outbound?.packetsSent;
    const currPk = curr?.outbound?.packetsSent;
    if (!(Number.isFinite(prevPk) && Number.isFinite(currPk))) return false;

    const dPk = currPk - prevPk;
    if (dPk < 8) return false;

    const e1 = prev?.audioSource?.totalAudioEnergy;
    const e2 = curr?.audioSource?.totalAudioEnergy;
    if (typeof e1 === "number" && typeof e2 === "number") {
      const dE = e2 - e1;
      if (dE <= 0.000001) return true;
      return false;
    }

    const lvl = curr?.audioSource?.audioLevel;
    if (typeof lvl === "number") {
      if (lvl <= 0.0001) return true;
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

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

  const sender = pickAudioSender(pc);
  const t = snapTrack(sender?.track);

  logLine(
    `[${nowISO()}] [desktop:uplink:diag] start reason=${reason} sender=${!!sender} trackId=${t.id || "?"} enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`
  );

  let prev = null;
  let silentHits = 0;
  let tick = 0;

  const interval = setInterval(async () => {
    tick += 1;
    const curr = await getSenderStatsSnapshot(sender);

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
      const silent = isLikelySilent({ prev, curr });
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
