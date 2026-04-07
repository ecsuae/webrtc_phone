let _stats = null;
let _statsImport = null;

function getRuntimeCb() {
  try {
    const fromGlobal = (typeof window !== 'undefined' && window.__BUILD_CB) ? String(window.__BUILD_CB) : '';
    if (fromGlobal) return fromGlobal;
  } catch {}
  try {
    const u = new URL(import.meta.url);
    return (u.searchParams.get('cb') || '').trim();
  } catch {
    return '';
  }
}

function loadStats() {
  if (_stats) return Promise.resolve(_stats);
  if (_statsImport) return _statsImport;

  const cb = getRuntimeCb();
  const url = cb ? `../stats.js?cb=${encodeURIComponent(cb)}` : '../stats.js';
  _statsImport = import(url)
    .then((m) => {
      _stats = m;
      return m;
    })
    .catch((err) => {
      try {
        console.error('[pc/bind] Failed to import pc/stats.js', err);
      } catch {}
      throw err;
    });
  return _statsImport;
}

function withStats(fnName, runner) {
  return (...args) => {
    loadStats()
      .then((m) => {
        const fn = m?.[fnName];
        if (typeof fn !== 'function') {
          try {
            console.error(`[pc/bind] Missing stats export ${fnName}`);
          } catch {}
          return;
        }
        runner(fn, args);
      })
      .catch(() => {});
  };
}

export const logSelectedPair = withStats('logSelectedPair', (fn, args) => fn(...args));
export const startRtpStats = withStats('startRtpStats', (fn, args) => fn(...args));
export const stopRtpStats = withStats('stopRtpStats', (fn, args) => fn(...args));
export const scheduleMediaStatsSnapshots = withStats('scheduleMediaStatsSnapshots', (fn, args) => fn(...args));
