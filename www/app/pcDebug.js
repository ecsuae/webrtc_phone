// Compatibility facade for peer-connection debug helpers.

let _bindPeerConnection = null;
let _bindImport = null;

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

function loadBindPeerConnection() {
  if (_bindPeerConnection) return Promise.resolve(_bindPeerConnection);
  if (_bindImport) return _bindImport;

  const cb = getRuntimeCb();
  const url = cb ? `./pc/bind.js?cb=${encodeURIComponent(cb)}` : './pc/bind.js';
  _bindImport = import(url)
    .then((m) => {
      _bindPeerConnection = m.bindPeerConnection;
      return _bindPeerConnection;
    })
    .catch((err) => {
      try {
        console.error('[pcDebug] Failed to import pc/bind.js', err);
      } catch {}
      throw err;
    });

  return _bindImport;
}

export function bindPeerConnection(...args) {
  // Keep call sites unchanged: they expect a sync function.
  // We lazy-load the heavy module and then execute.
  loadBindPeerConnection()
    .then((fn) => {
      try {
        fn(...args);
      } catch (err) {
        try {
          console.error('[pcDebug] bindPeerConnection error', err);
        } catch {}
      }
    })
    .catch(() => {});
}
