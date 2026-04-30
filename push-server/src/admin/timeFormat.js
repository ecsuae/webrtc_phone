'use strict';

const ADMIN_TIMEZONE = 'Asia/Karachi';
const ADMIN_TZ_LABEL = 'PKT';

function formatTs(ts) {
  const v = ts || '';
  if (!v) return '';
  try {
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) throw new Error('invalid-date');
    const s = new Intl.DateTimeFormat('sv-SE', {
      timeZone: ADMIN_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(d);
    return `${s} ${ADMIN_TZ_LABEL}`;
  } catch {
    return String(v).replace('T', ' ').slice(0, 19);
  }
}

function parseTsMs(ts) {
  const d = new Date(ts);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

module.exports = {
  formatTs,
  parseTsMs,
};
