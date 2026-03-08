export function setupCacheActions() {
  window.clearAllCacheAndReload = async function () {
    const btn = document.getElementById("refreshBtn");
    if (!btn) return;

    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      console.log("[CACHE] Clearing cache storage and unregistering service workers");

      // Preserve critical credentials/settings before localStorage clear.
      const username = localStorage.getItem("sipUsername");
      const password = localStorage.getItem("sipPassword");
      const hideShortcut = localStorage.getItem("hideInstallShortcut");
      const selectedSkin = localStorage.getItem("webrtc_skin");

      localStorage.clear();
      if (username) localStorage.setItem("sipUsername", username);
      if (password) localStorage.setItem("sipPassword", password);
      if (hideShortcut) localStorage.setItem("hideInstallShortcut", hideShortcut);
      if (selectedSkin) localStorage.setItem("webrtc_skin", selectedSkin);

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
        for (const reg of regs) {
          await reg.unregister();
        }
      }

      console.log("[CACHE] Cache clear complete");
    } catch (err) {
      console.error("[CACHE] Error clearing cache:", err);
    } finally {
      setTimeout(() => {
        location.reload();
      }, 300);
      btn.innerHTML = originalIcon;
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  };
}
