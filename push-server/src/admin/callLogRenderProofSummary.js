'use strict';

function fmtRenderProofSummary(ev) {
  if (!ev) return '';
  const parts = [];
  const msg = (typeof ev.msg === 'string' ? ev.msg : '') || '';
  const stage = (() => {
    if (/\b10s\b/i.test(msg)) return '10s';
    if (/\b5s\b/i.test(msg)) return '5s';
    if (/\bearly\b/i.test(msg)) return 'early';
    // Heuristic: early proof usually lacks RTP/energy fields.
    const hasAnyStats = (ev.inboundAudioPacketsReceived !== undefined)
      || (ev.outboundAudioPacketsSent !== undefined)
      || (ev.audioLevel !== undefined)
      || (ev.totalAudioEnergy !== undefined);
    return hasAnyStats ? '?' : 'early';
  })();

  const fmtBool = (v) => (typeof v === 'boolean' ? String(v) : '?');
  const fmtNum = (v, { digits } = {}) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '?';
    const s = String(v);
    return (typeof digits === 'number') ? s.slice(0, digits) : s;
  };

  const paused = (typeof ev.audioElPaused === 'boolean') ? ev.audioElPaused : null;
  const muted = (typeof ev.audioElMuted === 'boolean') ? ev.audioElMuted : null;
  const volume = (typeof ev.audioElVolume === 'number' && Number.isFinite(ev.audioElVolume)) ? ev.audioElVolume : null;
  const readyState = (typeof ev.audioElReadyState === 'number' && Number.isFinite(ev.audioElReadyState)) ? ev.audioElReadyState : null;
  const currentTime = (typeof ev.audioElCurrentTime === 'number' && Number.isFinite(ev.audioElCurrentTime)) ? ev.audioElCurrentTime : null;

  const elParts = [
    `paused=${fmtBool(paused)}`,
    `muted=${fmtBool(muted)}`,
    `volume=${fmtNum(volume, { digits: 6 })}`,
    `readyState=${readyState !== null ? String(readyState) : '?'}`,
    `currentTime=${(currentTime !== null) ? (currentTime > 0 ? '>0' : '0') : '?'}`,
  ];

  const recv = (typeof ev.inboundAudioPacketsReceived === 'number' && Number.isFinite(ev.inboundAudioPacketsReceived))
    ? ev.inboundAudioPacketsReceived
    : null;
  const sent = (typeof ev.outboundAudioPacketsSent === 'number' && Number.isFinite(ev.outboundAudioPacketsSent))
    ? ev.outboundAudioPacketsSent
    : null;
  const audioLevel = (typeof ev.audioLevel === 'number' && Number.isFinite(ev.audioLevel)) ? ev.audioLevel : null;
  const totalAudioEnergy = (typeof ev.totalAudioEnergy === 'number' && Number.isFinite(ev.totalAudioEnergy)) ? ev.totalAudioEnergy : null;
  const sParts = [
    `recv=${recv !== null ? String(recv) : '?'}`,
    `sent=${sent !== null ? String(sent) : '?'}`,
    `audioLevel=${fmtNum(audioLevel, { digits: 8 })}`,
    `totalAudioEnergy=${fmtNum(totalAudioEnergy, { digits: 10 })}`,
  ];

  const trackEnabled = (typeof ev.trackEnabled === 'boolean') ? ev.trackEnabled : null;
  const trackMuted = (typeof ev.trackMuted === 'boolean') ? ev.trackMuted : null;
  const trackReadyState = (typeof ev.trackReadyState === 'string' && ev.trackReadyState.trim()) ? ev.trackReadyState.trim() : null;
  const tParts = [
    `track=${trackReadyState || '?'}`,
    `track.muted=${fmtBool(trackMuted)}`,
    `track.enabled=${fmtBool(trackEnabled)}`,
  ];

  const codec = (typeof ev.inboundCodecMimeType === 'string' && ev.inboundCodecMimeType.trim())
    ? ev.inboundCodecMimeType.trim()
    : null;
  const pt = (typeof ev.inboundCodecPayloadType === 'number' && Number.isFinite(ev.inboundCodecPayloadType))
    ? ev.inboundCodecPayloadType
    : null;
  const decImpl = (typeof ev.decoderImplementation === 'string' && ev.decoderImplementation.trim())
    ? ev.decoderImplementation.trim()
    : null;
  const decoded = (typeof ev.totalSamplesDecoded === 'number' && Number.isFinite(ev.totalSamplesDecoded))
    ? ev.totalSamplesDecoded
    : null;
  const concealed = (typeof ev.concealedSamples === 'number' && Number.isFinite(ev.concealedSamples))
    ? ev.concealedSamples
    : null;
  const discarded = (typeof ev.packetsDiscarded === 'number' && Number.isFinite(ev.packetsDiscarded))
    ? ev.packetsDiscarded
    : null;
  const repaired = (typeof ev.packetsRepaired === 'number' && Number.isFinite(ev.packetsRepaired))
    ? ev.packetsRepaired
    : null;
  const jbDelay = (typeof ev.jitterBufferDelay === 'number' && Number.isFinite(ev.jitterBufferDelay))
    ? ev.jitterBufferDelay
    : null;
  const jbEmit = (typeof ev.jitterBufferEmittedCount === 'number' && Number.isFinite(ev.jitterBufferEmittedCount))
    ? ev.jitterBufferEmittedCount
    : null;
  const cParts = [];
  if (codec) cParts.push(`codec=${codec}${pt !== null ? ` pt=${pt}` : ''}`);
  if (decImpl) cParts.push(`dec=${decImpl}`);
  if (decoded !== null) cParts.push(`decoded=${decoded}`);
  if (concealed !== null) cParts.push(`concealed=${concealed}`);
  if (discarded !== null) cParts.push(`discarded=${discarded}`);
  if (repaired !== null) cParts.push(`repaired=${repaired}`);
  if (jbDelay !== null) cParts.push(`jbDelay=${fmtNum(jbDelay, { digits: 10 })}`);
  if (jbEmit !== null) cParts.push(`jbEmit=${jbEmit}`);

  parts.push(`Render[${stage}]: ${elParts.join(' ')}`);
  parts.push(`${tParts.join(' ')}`);
  parts.push(`${sParts.join(' ')}`);
  if (cParts.length) parts.push(`${cParts.join(' ')}`);

  const hasRtp = (recv !== null && recv > 0);
  const hasEnergy = ((typeof totalAudioEnergy === 'number' && totalAudioEnergy > 0) || (typeof audioLevel === 'number' && audioLevel > 0));

  // Mismatch evidence: only emit when strongly supported.
  if (hasRtp && !hasEnergy) {
    parts.push('MISMATCH: RTP present but no energy');
  }
  if (hasRtp && trackMuted === true) {
    parts.push('MISMATCH: RTP present but track muted');
  }
  const looksStuck = (paused === false)
    && (readyState !== null && readyState >= 3)
    && (currentTime !== null && currentTime === 0)
    && (trackMuted === true || hasRtp);
  if (looksStuck) {
    parts.push('MISMATCH: play ok but render stuck');
  }

  return parts.join(' | ');
}

module.exports = {
  fmtRenderProofSummary,
};
