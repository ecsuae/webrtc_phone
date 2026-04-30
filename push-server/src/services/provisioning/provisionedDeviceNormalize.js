'use strict';

function normalizeProvisionedDeviceRows(rows) {
  let changed = false;
  const devices = (Array.isArray(rows) ? rows : []).map((row) => {
    const d = row && typeof row === 'object' ? { ...row } : {};
    if (!Object.prototype.hasOwnProperty.call(d, 'active')) {
      d.active = false;
      changed = true;
    }
    if (d.active !== true && d.active !== false) {
      d.active = false;
      changed = true;
    }
    if (d.active !== true && d.active_since) {
      d.active_since = '';
      changed = true;
    }
    return d;
  });
  return { devices, changed };
}

module.exports = { normalizeProvisionedDeviceRows };
