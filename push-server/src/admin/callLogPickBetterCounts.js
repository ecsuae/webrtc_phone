'use strict';

const { isConcreteCount } = require('./callLogConcreteCount');

function pickBetterCounts(best, ev) {
  const next = { ...best };
  for (const k of ['relay', 'host', 'srflx', 'total']) {
    const cur = next[k];
    const cand = ev[k];
    if (!isConcreteCount(cur) && isConcreteCount(cand)) next[k] = cand;
    if (isConcreteCount(cur) && isConcreteCount(cand) && cand > cur) next[k] = cand;
  }
  if (next.icePolicy === undefined && typeof ev.icePolicy === 'string') next.icePolicy = ev.icePolicy;
  if (next.timedOut === undefined && typeof ev.timedOut === 'boolean') next.timedOut = ev.timedOut;
  if (next.selectedPair === undefined && typeof ev.selectedPair === 'string') next.selectedPair = ev.selectedPair;
  if (next.candSummary === undefined && typeof ev.candSummary === 'string') next.candSummary = ev.candSummary;
  return next;
}

module.exports = {
  pickBetterCounts,
};
