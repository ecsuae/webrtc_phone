import { emitDesktopHardRefreshBootMarkers, writeDesktopHardRefreshClickTs } from "./desktopCacheHardRefreshSetup.js";

export function installDesktopClearAllCacheAndReload() {
  window.clearAllCacheAndReload = async function () {
    try {
      const ts = String(Date.now());
      writeDesktopHardRefreshClickTs(ts);
    } catch {}

    try {
      const build = String(window.__APP_BUILD__ || "");
      const cb = String(window.__BUILD_CB || "");
      const lsKeys = (() => {
        try {
          return Object.keys(localStorage || {});
        } catch {
          return [];
        }
      })();
      const ssKeys = (() => {
        try {
          return Object.keys(sessionStorage || {});
        } catch {
          return [];
        }
      })();
      console.log(
        `[HARD_REFRESH_BEGIN] build=${build} cb=${cb} href=${location.href} lsKeys=${JSON.stringify(lsKeys)} ssKeys=${JSON.stringify(ssKeys)}`
      );
      try {
        console.log(
          `[HARD_REFRESH_BEFORE] webrtc_calls_enabled=${localStorage.getItem("webrtc_calls_enabled")} webrtc_last_registration=${localStorage.getItem("webrtc_last_registration")} webrtc_last_pass=${sessionStorage.getItem("webrtc_last_pass")}`
        );
      } catch {}
    } catch {}

    const btn = document.getElementById("refreshBtn");
    if (!btn) return;

    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      emitDesktopHardRefreshBootMarkers({ phase: "run" });

      console.log("[CACHE] Clearing cache storage and unregistering service workers");

      try {
        const controlled = Boolean(navigator.serviceWorker?.controller);
        console.log(
          `[SW_CONTROLLED] controlled=${controlled} controller=${navigator.serviceWorker?.controller?.scriptURL || "none"} src=desktop/runtime/desktopCacheActions.js:clearAllCacheAndReload`
        );
      } catch {}

      const username = localStorage.getItem("sipUsername");
      const password = localStorage.getItem("sipPassword");
      const hideShortcut = localStorage.getItem("hideInstallShortcut");
      const selectedSkin = localStorage.getItem("webrtc_skin");
      const callHistoryV2 = localStorage.getItem("callHistoryV2");
      const callHistoryLegacy = localStorage.getItem("callHistory");

      try {
        console.log(
          `[HARD_REFRESH_PRESERVE] callHistoryV2=${callHistoryV2 ? callHistoryV2.length : 0} callHistory=${callHistoryLegacy ? callHistoryLegacy.length : 0} src=desktop/runtime/desktopCacheActions.js:clearAllCacheAndReload`
        );
      } catch {}

      try {
        localStorage.removeItem("webrtc_calls_enabled");
        localStorage.removeItem("webrtc_last_registration");
        sessionStorage.removeItem("webrtc_last_pass");
        console.log("[HARD_REFRESH_REMOVE] removed webrtc_calls_enabled/webrtc_last_registration/webrtc_last_pass");
      } catch {}

      localStorage.clear();
      if (username) localStorage.setItem("sipUsername", username);
      if (password) localStorage.setItem("sipPassword", password);
      if (hideShortcut) localStorage.setItem("hideInstallShortcut", hideShortcut);
      if (selectedSkin) localStorage.setItem("webrtc_skin", selectedSkin);
      if (callHistoryV2) localStorage.setItem("callHistoryV2", callHistoryV2);
      if (callHistoryLegacy) localStorage.setItem("callHistory", callHistoryLegacy);

      try {
        const a = localStorage.getItem("callHistoryV2");
        const b = localStorage.getItem("callHistory");
        console.log(
          `[HARD_REFRESH_RESTORED] callHistoryV2=${a ? a.length : 0} callHistory=${b ? b.length : 0} src=desktop/runtime/desktopCacheActions.js:clearAllCacheAndReload`
        );
      } catch {}

      try {
        localStorage.removeItem("webrtc_calls_enabled");
        localStorage.removeItem("webrtc_last_registration");
        console.log("[HARD_REFRESH_AFTER_CLEAR] ensured webrtc_calls_enabled/webrtc_last_registration removed");
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
        console.log(`[SW_UNREGISTER_OK] regs=${regs.length} ok=${ok} src=desktop/runtime/desktopCacheActions.js:clearAllCacheAndReload`);
      }

      await new Promise((r) => setTimeout(r, 250));

      console.log("[CACHE] Cache clear complete");
      try {
        const cacheNames = "caches" in window ? await caches.keys() : [];
        console.log(`[CACHE_CLEAR_OK] cachesRemaining=${cacheNames.length} src=desktop/runtime/desktopCacheActions.js:clearAllCacheAndReload`);
      } catch {}
    } catch (err) {
      console.error("[CACHE] Error clearing cache:", err);
    } finally {
      setTimeout(() => {
        const url = new URL(window.location.href);
        const cb = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        url.searchParams.set("cb", cb);
        url.searchParams.set("hr", "1");
        try {
          try {
            console.log(`[HARD_REFRESH_AFTER_CLEAR_LOCALSTORAGE] lsKeys=${JSON.stringify(Object.keys(localStorage || {}))}`);
          } catch {}
          console.log(`[HARD_REFRESH_REDIRECT] url=${url.toString()} src=desktop/runtime/desktopCacheActions.js:clearAllCacheAndReload`);
        } catch {}
        location.replace(url.toString());
      }, 300);

      btn.innerHTML = originalIcon;
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  };
}
