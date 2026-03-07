export function setupCacheActions() {
  window.clearAllCacheAndReload = async function () {
    const btn = document.getElementById("refreshBtn");
    if (!btn) return;

    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      console.log("[CACHE] Clearing localStorage, sessionStorage, IndexedDB, and Service Worker caches");
      localStorage.clear();
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
