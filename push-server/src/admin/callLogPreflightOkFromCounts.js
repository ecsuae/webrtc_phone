'use strict';

function preflightOkFromCounts(ev) {
  if (typeof ev.relay === 'number') return ev.relay > 0;
  if (typeof ev.total === 'number') return ev.total > 0;
  return null;
}

module.exports = {
  preflightOkFromCounts,
};
