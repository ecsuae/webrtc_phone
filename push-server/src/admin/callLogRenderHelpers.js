'use strict';

const { escHtml } = require('./callLogCoreUtils');

function fmtPktBits(stats, label) {
  if (!stats || typeof stats !== 'object') return '';
  const recv = (typeof stats.inboundAudioPacketsReceived === 'number' && Number.isFinite(stats.inboundAudioPacketsReceived)) ? stats.inboundAudioPacketsReceived : null;
  const sent = (typeof stats.outboundAudioPacketsSent === 'number' && Number.isFinite(stats.outboundAudioPacketsSent)) ? stats.outboundAudioPacketsSent : null;
  if (recv === null && sent === null) return '';
  const parts = [];
  if (recv !== null) parts.push(`recv=${recv}`);
  if (sent !== null) parts.push(`sent=${sent}`);
  return `${label} ${parts.join(' ')}`;
}

function renderRawPayloadDetails(ev, { viewMode } = {}) {
  if (viewMode !== 'raw') return '';
  try {
    const json = JSON.stringify(ev, null, 2);
    const labelBits = [];
    if (ev.type) labelBits.push(String(ev.type));
    if (ev.dir) labelBits.push(String(ev.dir));
    if (ev._seq !== undefined) labelBits.push(`#${String(ev._seq)}`);
    const ts0 = ev.ts || ev._serverTs;
    if (ts0) labelBits.push(String(ts0));
    const label = labelBits.length ? `payload ${labelBits.join(' ')}` : 'payload';
    return json ? `<details style="margin-top: 6px;"><summary style="cursor: pointer; color: var(--dim); font-family: var(--mono); font-size: 11px;">${escHtml(label)}</summary><div style="margin-top: 6px; border: 1px solid rgba(160,160,160,.25); border-radius: 6px; background: rgba(0,0,0,.08); padding: 8px;"><pre style="white-space: pre; overflow: auto; max-height: 320px; font-family: var(--mono); font-size: 11px; line-height: 1.35; margin: 0; color: var(--dim);">${escHtml(json)}</pre></div></details>` : '';
  } catch {
    return '';
  }
}

function renderStatsAnnotation(ev, { viewMode } = {}) {
  if (viewMode !== 'summary') return '';
  const inP = ev.inboundAudioPacketsReceived;
  const outP = ev.outboundAudioPacketsSent;
  const hasPackets = (typeof inP === 'number') || (typeof outP === 'number');
  const codec = (typeof ev.inboundCodecMimeType === 'string' && ev.inboundCodecMimeType.trim()) ? ev.inboundCodecMimeType.trim() : '';
  const pt = (typeof ev.inboundCodecPayloadType === 'number' && Number.isFinite(ev.inboundCodecPayloadType)) ? ev.inboundCodecPayloadType : null;
  const dec = (typeof ev.decoderImplementation === 'string' && ev.decoderImplementation.trim()) ? ev.decoderImplementation.trim() : '';
  const decoded = (typeof ev.totalSamplesDecoded === 'number' && Number.isFinite(ev.totalSamplesDecoded)) ? ev.totalSamplesDecoded : null;
  const concealed = (typeof ev.concealedSamples === 'number' && Number.isFinite(ev.concealedSamples)) ? ev.concealedSamples : null;
  const discarded = (typeof ev.packetsDiscarded === 'number' && Number.isFinite(ev.packetsDiscarded)) ? ev.packetsDiscarded : null;
  const hasCodec = !!(codec || dec || decoded !== null || concealed !== null || discarded !== null);
  if (!hasPackets && !hasCodec) return '';
  const fmt = (label, v) => {
    if (typeof v !== 'number') return `${label}: ?`;
    const cls = v === 0 ? ' class="rtp-problem"' : '';
    return `${label}: <span${cls}>${v}</span>`;
  };
  const pktLine = hasPackets ? `${fmt('recv', inP)} | ${fmt('sent', outP)}` : '';
  const codecBits = [];
  if (codec) codecBits.push(`codec=${escHtml(codec)}${pt !== null ? ` pt=${pt}` : ''}`);
  if (dec) codecBits.push(`dec=${escHtml(dec)}`);
  if (decoded !== null) codecBits.push(`decoded=${decoded}`);
  if (concealed !== null) codecBits.push(`concealed=${concealed}`);
  if (discarded !== null) codecBits.push(`discarded=${discarded}`);
  const codecLine = codecBits.length ? codecBits.join(' ') : '';
  const lines = [pktLine, codecLine].filter(Boolean);
  return lines.length ? `<br><span style="font-family: var(--mono); font-size: 11px;">${lines.join('<br>')}</span>` : '';
}

function fmtRenderProofSummary(ev) {
  if (!ev) return '';
  const parts = [];
  const msg = (typeof ev.msg === 'string' ? ev.msg : '') || '';
  const stage = (() => {
    if (/\b10s\b/i.test(msg)) return '10s';
    if (/\b5s\b/i.test(msg)) return '5s';
    if (/\bearly\b/i.test(msg)) return 'early';
    const hasAnyStats = (ev.inboundAudioPacketsReceived !== undefined) || (ev.outboundAudioPacketsSent !== undefined) || (ev.audioLevel !== undefined) || (ev.totalAudioEnergy !== undefined);
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
  const recv = (typeof ev.inboundAudioPacketsReceived === 'number' && Number.isFinite(ev.inboundAudioPacketsReceived)) ? ev.inboundAudioPacketsReceived : null;
  const sent = (typeof ev.outboundAudioPacketsSent === 'number' && Number.isFinite(ev.outboundAudioPacketsSent)) ? ev.outboundAudioPacketsSent : null;
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
  const tParts = [`track=${trackReadyState || '?'}`, `track.muted=${fmtBool(trackMuted)}`, `track.enabled=${fmtBool(trackEnabled)}`];
  const codec = (typeof ev.inboundCodecMimeType === 'string' && ev.inboundCodecMimeType.trim()) ? ev.inboundCodecMimeType.trim() : null;
  const pt = (typeof ev.inboundCodecPayloadType === 'number' && Number.isFinite(ev.inboundCodecPayloadType)) ? ev.inboundCodecPayloadType : null;
  const decImpl = (typeof ev.decoderImplementation === 'string' && ev.decoderImplementation.trim()) ? ev.decoderImplementation.trim() : null;
  const decoded = (typeof ev.totalSamplesDecoded === 'number' && Number.isFinite(ev.totalSamplesDecoded)) ? ev.totalSamplesDecoded : null;
  const concealed = (typeof ev.concealedSamples === 'number' && Number.isFinite(ev.concealedSamples)) ? ev.concealedSamples : null;
  const discarded = (typeof ev.packetsDiscarded === 'number' && Number.isFinite(ev.packetsDiscarded)) ? ev.packetsDiscarded : null;
  const repaired = (typeof ev.packetsRepaired === 'number' && Number.isFinite(ev.packetsRepaired)) ? ev.packetsRepaired : null;
  const jbDelay = (typeof ev.jitterBufferDelay === 'number' && Number.isFinite(ev.jitterBufferDelay)) ? ev.jitterBufferDelay : null;
  const jbEmit = (typeof ev.jitterBufferEmittedCount === 'number' && Number.isFinite(ev.jitterBufferEmittedCount)) ? ev.jitterBufferEmittedCount : null;
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
  const hasEnergy = ((typeof totalAudioEnergy === 'number' && totalAudioEnergy > 0)
    || (typeof audioLevel === 'number' && audioLevel > 0));
  if (hasRtp && !hasEnergy) parts.push('MISMATCH: RTP present but no energy');
  if (hasRtp && trackMuted === true) parts.push('MISMATCH: RTP present but track muted');
  const looksStuck = (paused === false) && (readyState !== null && readyState >= 3) && (currentTime !== null && currentTime === 0) && (trackMuted === true || hasRtp);
  if (looksStuck) parts.push('MISMATCH: play ok but render stuck');
  return parts.join(' | ');
}

module.exports = { fmtPktBits, renderRawPayloadDetails, renderStatsAnnotation, fmtRenderProofSummary };
