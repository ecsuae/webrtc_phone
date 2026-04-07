'use strict';

function modeLabel(ev) {
  if (ev.selectedProfile) return String(ev.selectedProfile);
  if (ev.mode) return String(ev.mode);
  if (ev.lteMode === true) return 'lte';
  if (ev.lteMode === false) return 'wifi';
  return '';
}

module.exports = {
  modeLabel,
};
