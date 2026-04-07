'use strict';

const {
  canonicalType,
  getLatestMediaStatsByDir,
} = require('../services/callDiagnosis');

function buildLegSummary(events, dir) {
  const evs = Array.isArray(events) ? events : [];
  const leg = evs.filter((e) => (e.dir || '') === dir);
  const any = leg.length > 0;
  const established = leg.some((e) => canonicalType(e) === 'call-established');
  const remoteTrack = leg.some((e) => canonicalType(e) === 'remote-audio-track-added');
  const remoteAudioPlayOk = leg.some((e) => canonicalType(e) === 'remote-audio-play-ok');
  const remoteAudioPlayFail = leg.some((e) => canonicalType(e) === 'remote-audio-play-failed');

  const latestStats = (() => {
    const stats = getLatestMediaStatsByDir(leg);
    return dir === 'outbound' ? stats.outbound : stats.inbound;
  })();

  const inboundRtp = typeof latestStats?.inboundAudioPacketsReceived === 'number'
    ? latestStats.inboundAudioPacketsReceived > 0
    : null;
  const outboundRtp = typeof latestStats?.outboundAudioPacketsSent === 'number'
    ? latestStats.outboundAudioPacketsSent > 0
    : null;
  const latestStatsTs = latestStats?.ts || latestStats?._serverTs || null;

  return {
    any,
    username: leg[0]?.username,
    aor: leg[0]?.aor,
    established,
    remoteTrack,
    remoteAudioPlayOk,
    remoteAudioPlayFail,
    inboundRtp,
    outboundRtp,
    latestStatsTs,
  };
}

module.exports = {
  buildLegSummary,
};
