export function setupCacheActions() {
  try {
    const build = String(window.__APP_BUILD__ || '');
    const cb = String(window.__BUILD_CB || '');
    console.log(`[BOOT_MARKER_CACHE_ACTIONS_SETUP] build=${build} cb=${cb} ts=${Date.now()}`);
  } catch {}
  window.clearAllCacheAndReload = async function () {
    try {
      const build = String(window.__APP_BUILD__ || '');
      const cb = String(window.__BUILD_CB || '');
      const lsKeys = (() => {
        try { return Object.keys(localStorage || {}); } catch { return []; }
      })();
      const ssKeys = (() => {
        try { return Object.keys(sessionStorage || {}); } catch { return []; }
      })();
      console.log(`[HARD_REFRESH_BEGIN] build=${build} cb=${cb} href=${location.href} lsKeys=${JSON.stringify(lsKeys)} ssKeys=${JSON.stringify(ssKeys)}`);
      try {
        console.log(`[HARD_REFRESH_BEFORE] webrtc_calls_enabled=${localStorage.getItem('webrtc_calls_enabled')} webrtc_last_registration=${localStorage.getItem('webrtc_last_registration')} webrtc_last_pass=${sessionStorage.getItem('webrtc_last_pass')}`);
      } catch {}
    } catch {}

    const btn = document.getElementById("refreshBtn");
    if (!btn) return;

    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      try {
        const build = String(window.__APP_BUILD__ || '');
        const cb = String(window.__BUILD_CB || '');
        console.log(`[BOOT_MARKER_CACHE_ACTIONS_RUN] build=${build} cb=${cb} ts=${Date.now()}`);
      } catch {}
      console.log("[CACHE] Clearing cache storage and unregistering service workers");
      try {
        const controlled = Boolean(navigator.serviceWorker?.controller);
        console.log(`[SW_CONTROLLED] controlled=${controlled} controller=${navigator.serviceWorker?.controller?.scriptURL || 'none'} src=app/page/cacheActions.js:clearAllCacheAndReload`);
      } catch {}

      // Preserve critical credentials/settings before localStorage clear.
      const username = localStorage.getItem("sipUsername");
      const password = localStorage.getItem("sipPassword");
      const hideShortcut = localStorage.getItem("hideInstallShortcut");
      const selectedSkin = localStorage.getItem("webrtc_skin");
      const callHistoryV2 = localStorage.getItem("callHistoryV2");
      const callHistoryLegacy = localStorage.getItem("callHistory");

      // Explicitly remove app registration state before clearing everything.
      try {
        localStorage.removeItem('webrtc_calls_enabled');
        localStorage.removeItem('webrtc_last_registration');
        sessionStorage.removeItem('webrtc_last_pass');
        console.log('[HARD_REFRESH_REMOVE] removed webrtc_calls_enabled/webrtc_last_registration/webrtc_last_pass');
      } catch {}

      localStorage.clear();
      if (username) localStorage.setItem("sipUsername", username);
      if (password) localStorage.setItem("sipPassword", password);
      if (hideShortcut) localStorage.setItem("hideInstallShortcut", hideShortcut);
      if (selectedSkin) localStorage.setItem("webrtc_skin", selectedSkin);
      if (callHistoryV2) localStorage.setItem("callHistoryV2", callHistoryV2);
      if (callHistoryLegacy) localStorage.setItem("callHistory", callHistoryLegacy);

      // Belt-and-suspenders: ensure the enable flag cannot be restored by preserved keys.
      try {
        localStorage.removeItem('webrtc_calls_enabled');
        localStorage.removeItem('webrtc_last_registration');
        console.log('[HARD_REFRESH_AFTER_CLEAR] ensured webrtc_calls_enabled/webrtc_last_registration removed');
      } catch {}

      sessionStorage.clear();

      const dbs = (await indexedDB.databases?.()) || [];
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      }

      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        let ok = 0;
        for (const reg of regs) {
          try {
            const rOk = await reg.unregister();
            if (rOk) ok += 1;
          } catch {}
        }
        console.log(`[SW_UNREGISTER_OK] regs=${regs.length} ok=${ok} src=app/page/cacheActions.js:clearAllCacheAndReload`);
      }

      // Give the browser a moment to detach the old SW controller before navigating.
      await new Promise((r) => setTimeout(r, 250));

      console.log("[CACHE] Cache clear complete");
      try {
        const cacheNames = ("caches" in window) ? await caches.keys() : [];
        console.log(`[CACHE_CLEAR_OK] cachesRemaining=${cacheNames.length} src=app/page/cacheActions.js:clearAllCacheAndReload`);
      } catch {}
    } catch (err) {
      console.error("[CACHE] Error clearing cache:", err);
    } finally {
      setTimeout(() => {
        // Force a fresh navigation (avoids reusing cached JS module graphs on Android).
        // Preserve path + other query params + hash, but always replace cb=.
        const url = new URL(window.location.href);
        const cb = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        url.searchParams.set("cb", cb);
        url.searchParams.set("hr", "1");
        try {
          try {
            console.log(`[HARD_REFRESH_AFTER_CLEAR_LOCALSTORAGE] lsKeys=${JSON.stringify(Object.keys(localStorage || {}))}`);
          } catch {}
          console.log(`[HARD_REFRESH_REDIRECT] url=${url.toString()} src=app/page/cacheActions.js:clearAllCacheAndReload`);
        } catch {}
        location.replace(url.toString());
      }, 300);
      btn.innerHTML = originalIcon;
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  };
}
