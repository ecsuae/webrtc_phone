import { nowISO } from "../../../config.js";
import { logLine } from "../../../log.js";

let _stats = null;
let _statsImport = null;

function getRuntimeCb() {
  try {
    const fromGlobal = typeof window !== "undefined" && window.__BUILD_CB ? String(window.__BUILD_CB) : "";
    if (fromGlobal) return fromGlobal;
  } catch {}
  try {
    const u = new URL(import.meta.url);
    return (u.searchParams.get("cb") || "").trim();
  } catch {
    return "";
  }
}

function loadPcStats() {
  if (_stats) return Promise.resolve(_stats);
  if (_statsImport) return _statsImport;

  const cb = getRuntimeCb();
  const url = cb ? `../../pc/stats.js?cb=${encodeURIComponent(cb)}` : "../../pc/stats.js";
  _statsImport = import(url)
    .then((m) => {
      _stats = m;
      return m;
    })
    .catch((err) => {
      try {
        console.error("[incoming/handlers] Failed to import pc/stats.js", err);
      } catch {}
      try {
        const line = `[${nowISO()}] [incoming:diag] loadPcStats import FAILED url=${url} err=${err?.message || err}`;
        logLine(line);
        console.error(line);
      } catch {}
      throw err;
    });

  return _statsImport;
}

export function scheduleMediaStatsSnapshots(pc, label, diagCtx) {
  loadPcStats()
    .then((m) => {
      const fn = m?.scheduleMediaStatsSnapshots;
      if (typeof fn !== "function") {
        try {
          console.error("[incoming/handlers] Missing stats export scheduleMediaStatsSnapshots");
        } catch {}
        return;
      }
      fn(pc, label, diagCtx);
    })
    .catch(() => {});
}
