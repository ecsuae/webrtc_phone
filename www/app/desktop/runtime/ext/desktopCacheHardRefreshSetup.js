function readPrevHardRefreshClickTsFromWindowName() {
  try {
    const raw = String(window.name || "");
    const m = raw.match(/__desktop_hard_refresh_click_ts=([^;]+)/);
    return m?.[1] || "";
  } catch {
    return "";
  }
}

function clearHardRefreshClickTsFromWindowName() {
  try {
    const raw = String(window.name || "");
    window.name = raw.replace(/(?:^|;)__desktop_hard_refresh_click_ts=[^;]*/g, "");
  } catch {}
}

function clearHardRefreshClickTsFromStorage() {
  try {
    localStorage.removeItem("__desktop_hard_refresh_click_ts");
  } catch {}
}

function consumeDesktopHardRefreshQueryFlagIfPresent() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("hr") !== "1") return;
    url.searchParams.delete("hr");
    history.replaceState(null, "", url.toString());
  } catch {}
}

export function writeDesktopHardRefreshClickTs(ts) {
  try {
    const raw = String(window.name || "");
    const next = raw ? `${raw};__desktop_hard_refresh_click_ts=${ts}` : `__desktop_hard_refresh_click_ts=${ts}`;
    window.name = next;
  } catch {}
  try {
    localStorage.setItem("__desktop_hard_refresh_click_ts", ts);
  } catch {}
}

export function emitDesktopHardRefreshBootMarkers({ phase }) {
  try {
    const build = String(window.__APP_BUILD__ || "");
    const cb = String(window.__BUILD_CB || "");
    const ts = Date.now();
    const tag = phase === "setup" ? "BOOT_MARKER_DESKTOP_CACHE_ACTIONS_SETUP" : "BOOT_MARKER_DESKTOP_CACHE_ACTIONS_RUN";
    console.log(`[${tag}] build=${build} cb=${cb} ts=${ts}`);
  } catch {}
}

export function setupDesktopHardRefreshButtonBinding() {
  try {
    const prev = readPrevHardRefreshClickTsFromWindowName();
    if (prev) console.log(`[DESKTOP_HARD_REFRESH_PREV_CLICK] ts=${prev} href=${location.href}`);
    clearHardRefreshClickTsFromWindowName();
    if (prev) {
      clearHardRefreshClickTsFromStorage();
      consumeDesktopHardRefreshQueryFlagIfPresent();
      try {
        console.log(`[DESKTOP_HARD_REFRESH_CONSUMED] ts=${prev} href=${location.href}`);
      } catch {}
    }
  } catch {}

  try {
    const btn = document.getElementById("refreshBtn");
    if (btn && !btn.__desktopHardRefreshBound) {
      btn.__desktopHardRefreshBound = true;

      try {
        btn.onclick = (e) => {
          try {
            console.log(`[DESKTOP_HARD_REFRESH_CLICK] ts=${Date.now()} href=${location.href} (src=onclick)`);
          } catch {}
          try {
            const ts = String(Date.now());
            writeDesktopHardRefreshClickTs(ts);
          } catch {}
          try {
            e?.preventDefault?.();
          } catch {}
          try {
            void window.clearAllCacheAndReload?.();
          } catch {}
          return false;
        };
      } catch {}

      btn.addEventListener(
        "click",
        (e) => {
          try {
            console.log(`[DESKTOP_HARD_REFRESH_CLICK] ts=${Date.now()} href=${location.href}`);
          } catch {}
          try {
            const ts = String(Date.now());
            writeDesktopHardRefreshClickTs(ts);
          } catch {}
          try {
            e?.preventDefault?.();
          } catch {}
          try {
            void window.clearAllCacheAndReload?.();
          } catch {}
        },
        { capture: true }
      );
    }
  } catch {}
}
