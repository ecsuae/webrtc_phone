'use strict';

const { escHtml } = require('./callLogHtmlEscape');

function fmtPktBits(stats, label) {
  if (!stats || typeof stats !== 'object') return '';
  const recv = (typeof stats.inboundAudioPacketsReceived === 'number' && Number.isFinite(stats.inboundAudioPacketsReceived))
    ? stats.inboundAudioPacketsReceived
    : null;
  const sent = (typeof stats.outboundAudioPacketsSent === 'number' && Number.isFinite(stats.outboundAudioPacketsSent))
    ? stats.outboundAudioPacketsSent
    : null;
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
    return json
      ? `<details style="margin-top: 6px;"><summary style="cursor: pointer; color: var(--dim); font-family: var(--mono); font-size: 11px;">${escHtml(label)}</summary><div style="margin-top: 6px; border: 1px solid rgba(160,160,160,.25); border-radius: 6px; background: rgba(0,0,0,.08); padding: 8px;"><pre style="white-space: pre; overflow: auto; max-height: 320px; font-family: var(--mono); font-size: 11px; line-height: 1.35; margin: 0; color: var(--dim);">${escHtml(json)}</pre></div></details>`
      : '';
  } catch {
    return '';
  }
}

function renderStatsAnnotation(ev, { viewMode } = {}) {
  // For stats rows in summary, annotate zero RTP counts inline so they stand out.
  if (viewMode !== 'summary') return '';
  const inP = ev.inboundAudioPacketsReceived;
  const outP = ev.outboundAudioPacketsSent;
  const hasPackets = (typeof inP === 'number') || (typeof outP === 'number');
  const codec = (typeof ev.inboundCodecMimeType === 'string' && ev.inboundCodecMimeType.trim())
    ? ev.inboundCodecMimeType.trim()
    : '';
  const pt = (typeof ev.inboundCodecPayloadType === 'number' && Number.isFinite(ev.inboundCodecPayloadType))
    ? ev.inboundCodecPayloadType
    : null;
  const dec = (typeof ev.decoderImplementation === 'string' && ev.decoderImplementation.trim())
    ? ev.decoderImplementation.trim()
    : '';
  const decoded = (typeof ev.totalSamplesDecoded === 'number' && Number.isFinite(ev.totalSamplesDecoded))
    ? ev.totalSamplesDecoded
    : null;
  const concealed = (typeof ev.concealedSamples === 'number' && Number.isFinite(ev.concealedSamples))
    ? ev.concealedSamples
    : null;
  const discarded = (typeof ev.packetsDiscarded === 'number' && Number.isFinite(ev.packetsDiscarded))
    ? ev.packetsDiscarded
    : null;

  const hasCodec = !!(codec || dec || decoded !== null || concealed !== null || discarded !== null);
  if (!hasPackets && !hasCodec) return '';
  const fmt = (label, v) => {
    if (typeof v !== 'number') return `${label}: ?`;
    const cls = v === 0 ? ' class="rtp-problem"' : '';
    return `${label}: <span${cls}>${v}</span>`;
  };

  const pktLine = hasPackets
    ? `${fmt('recv', inP)} | ${fmt('sent', outP)}`
    : '';

  const codecBits = [];
  if (codec) codecBits.push(`codec=${escHtml(codec)}${pt !== null ? ` pt=${pt}` : ''}`);
  if (dec) codecBits.push(`dec=${escHtml(dec)}`);
  if (decoded !== null) codecBits.push(`decoded=${decoded}`);
  if (concealed !== null) codecBits.push(`concealed=${concealed}`);
  if (discarded !== null) codecBits.push(`discarded=${discarded}`);
  const codecLine = codecBits.length ? codecBits.join(' ') : '';

  const lines = [pktLine, codecLine].filter(Boolean);
  return lines.length
    ? `<br><span style="font-family: var(--mono); font-size: 11px;">${lines.join('<br>')}</span>`
    : '';
}

module.exports = {
  fmtPktBits,
  renderRawPayloadDetails,
  renderStatsAnnotation,
};
