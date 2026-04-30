'use strict';

function mergeIceErrorDetail(best, ev) {
  const out = { ...best };
  const msg = ev.msg || '';
  if (!out.msg && msg) out.msg = msg;
  if (out.msg && msg && msg.length > out.msg.length) out.msg = msg;

  // Try to preserve useful single-line details if present
  for (const k of ['code', 'url', 'transport', 'error', 'errorText']) {
    if (out[k] === undefined && ev[k] !== undefined) out[k] = ev[k];
  }

  return out;
}

module.exports = {
  mergeIceErrorDetail,
};
