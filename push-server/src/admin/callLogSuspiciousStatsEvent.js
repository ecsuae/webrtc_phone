'use strict';

function isSuspiciousStatsEvent(ev) {
  if (!ev || typeof ev !== 'object') return false;
  const inP = typeof ev.inboundAudioPacketsReceived === 'number' ? ev.inboundAudioPacketsReceived : null;
  const outP = typeof ev.outboundAudioPacketsSent === 'number' ? ev.outboundAudioPacketsSent : null;
  if (inP === null && outP === null) return false;
  if (inP === 0 && outP > 0) return true;
  if (outP === 0 && inP > 0) return true;
  return false;
}

module.exports = {
  isSuspiciousStatsEvent,
};
