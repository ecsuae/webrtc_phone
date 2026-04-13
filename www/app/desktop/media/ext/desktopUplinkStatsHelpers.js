export function pickDesktopUplinkAudioSender(pc) {
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

export function snapDesktopUplinkTrack(track) {
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

export async function getDesktopUplinkSenderStatsSnapshot(sender) {
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

export function isDesktopUplinkLikelySilent({ prev, curr }) {
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
