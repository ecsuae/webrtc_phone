import { nowISO, logLine } from "../../desktopLogging.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

function elapsedSinceCallStartMs(audioEl, atIso) {
  const start = audioEl?.__callMediaDiagContext?.t_callStart;
  const startMs = start ? Date.parse(start) : NaN;
  const atMs = atIso ? Date.parse(atIso) : NaN;
  return Number.isFinite(startMs) && Number.isFinite(atMs) ? Math.max(0, atMs - startMs) : undefined;
}

function buildPayload(audioEl, detail = {}) {
  const t_audioEnergy = nowISO();
  return {
    ...(audioEl?.__callMediaDiagContext || {}),
    dir: "outbound",
    t_audioEnergy,
    audioEnergyElapsedMs: elapsedSinceCallStartMs(audioEl, t_audioEnergy),
    ...detail,
  };
}

function logEnergy(label, payload) {
  const line =
    `[${payload.t_audioEnergy}] [desktop:audio-energy] ${label}` +
    ` elapsedMs=${payload.audioEnergyElapsedMs ?? "n/a"}` +
    ` packets=${payload.inboundAudioPacketsReceived ?? "n/a"}` +
    ` bytes=${payload.inboundAudioBytesReceived ?? "n/a"}` +
    ` audioLevel=${payload.inboundAudioLevel ?? "n/a"}` +
    ` totalAudioEnergy=${payload.inboundTotalAudioEnergy ?? "n/a"}`;
  logLine(line);
  console.log(line);
}

function emitEnergy(audioEl, type, label, detail = {}) {
  const payload = buildPayload(audioEl, detail);
  sendCallMediaEvent({ type, ...payload });
  logEnergy(label, payload);
}

function readInboundAudioStats(stats) {
  const out = {
    packets: 0,
    bytes: 0,
    audioLevel: undefined,
    totalAudioEnergy: undefined,
    concealedSamples: undefined,
    silentConcealedSamples: undefined,
    energyFieldsAvailable: false,
  };

  stats.forEach((r) => {
    if (r?.type !== "inbound-rtp" || (r.kind && r.kind !== "audio")) return;
    if (typeof r.packetsReceived === "number") out.packets += r.packetsReceived;
    if (typeof r.bytesReceived === "number") out.bytes += r.bytesReceived;
    if (typeof r.audioLevel === "number") {
      out.audioLevel = Math.max(out.audioLevel || 0, r.audioLevel);
      out.energyFieldsAvailable = true;
    }
    if (typeof r.totalAudioEnergy === "number") {
      out.totalAudioEnergy = Math.max(out.totalAudioEnergy || 0, r.totalAudioEnergy);
      out.energyFieldsAvailable = true;
    }
    if (typeof r.concealedSamples === "number") out.concealedSamples = (out.concealedSamples || 0) + r.concealedSamples;
    if (typeof r.silentConcealedSamples === "number") out.silentConcealedSamples = (out.silentConcealedSamples || 0) + r.silentConcealedSamples;
  });

  return out;
}

function hasNonzeroEnergy(stats, previousEnergy) {
  const level = typeof stats.audioLevel === "number" ? stats.audioLevel : 0;
  const energy = typeof stats.totalAudioEnergy === "number" ? stats.totalAudioEnergy : 0;
  const energyDelta = energy - (previousEnergy || 0);
  return level > 0 || energyDelta > 0;
}

export function startDesktopOutboundAudioEnergyProbe(session, audioEl) {
  const pc = session?.sessionDescriptionHandler?.peerConnection;
  if (!pc || pc.__desktopAudioEnergyProbeBound || typeof pc.getStats !== "function") return;
  pc.__desktopAudioEnergyProbeBound = true;

  let ticks = 0;
  let sawPackets = false;
  let sawEnergy = false;
  let lastTotalEnergy = 0;

  const timer = setInterval(async () => {
    ticks += 1;
    try {
      const inbound = readInboundAudioStats(await pc.getStats());
      const detail = {
        inboundAudioPacketsReceived: inbound.packets,
        inboundAudioBytesReceived: inbound.bytes,
        inboundAudioLevel: inbound.audioLevel,
        inboundTotalAudioEnergy: inbound.totalAudioEnergy,
        inboundConcealedSamples: inbound.concealedSamples,
        inboundSilentConcealedSamples: inbound.silentConcealedSamples,
        audioEnergyFieldsAvailable: inbound.energyFieldsAvailable,
        audioEnergyProbeTicks: ticks,
      };

      if (inbound.packets > 0 && !sawPackets) {
        sawPackets = true;
        emitEnergy(audioEl, "desktop-first-inbound-rtp", "inbound-rtp", {
          ...detail,
          firstInboundRtpPacketsDelta: inbound.packets,
          firstInboundRtpBytesDelta: inbound.bytes,
        });
      }

      if (inbound.packets > 0 && !sawEnergy && hasNonzeroEnergy(inbound, lastTotalEnergy)) {
        sawEnergy = true;
        emitEnergy(audioEl, "desktop-first-nonzero-audio-energy", "first-nonzero-energy", detail);
      } else if (inbound.packets > 0 && !sawEnergy && (ticks === 1 || ticks % 4 === 0)) {
        emitEnergy(audioEl, "desktop-packets-with-zero-audio-energy", "packets-with-zero-energy", detail);
      } else if (inbound.packets > 0 && ticks % 4 === 0) {
        emitEnergy(audioEl, "desktop-inbound-audio-energy", "inbound-rtp", detail);
      }

      if (typeof inbound.totalAudioEnergy === "number") lastTotalEnergy = inbound.totalAudioEnergy;
    } catch (error) {
      emitEnergy(audioEl, "desktop-audio-energy-error", "error", {
        errorName: error?.name,
        errorMessage: error?.message,
      });
      clearInterval(timer);
    }

    if (ticks >= 24 || session?.state === "Terminated") clearInterval(timer);
  }, 250);
}
