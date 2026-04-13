import {
  normalizeDesktopHistoryNumber,
  normalizeDesktopHistoryType,
} from "./desktopHistoryActivityFormatters.js";

export function createDesktopHistoryActivityStore({ storageKey = "callHistoryV2", historyDays = 10 } = {}) {
  const calls = [];

  function pruneOld() {
    const cutoff = Date.now() - historyDays * 24 * 60 * 60 * 1000;
    const filtered = calls.filter((c) => Number(c.timestamp) >= cutoff);
    calls.splice(0, calls.length, ...filtered);
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(calls));
    } catch (err) {
      console.warn("[history] save failed:", err?.message || err);
    }
  }

  function load() {
    try {
      let raw = localStorage.getItem(storageKey);
      if (!raw) raw = localStorage.getItem("callHistory");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => {
              const timestamp = Number(item?.timestamp ? new Date(item.timestamp).getTime() : Date.now());
              const number = String(item?.number || "").trim();
              if (!number) return null;
              return {
                number,
                numberKey: normalizeDesktopHistoryNumber(number),
                type: normalizeDesktopHistoryType(item?.type || "outgoing"),
                duration: Number(item?.duration || 0),
                timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
                sipCode: item?.sipCode ? String(item.sipCode) : "",
                sipReason: item?.sipReason ? String(item.sipReason) : "",
                q850Cause: item?.q850Cause ? String(item.q850Cause) : "",
                q850Text: item?.q850Text ? String(item.q850Text) : "",
              };
            })
            .filter(Boolean);
          calls.splice(0, calls.length, ...normalized);
        }
      }
    } catch (err) {
      console.warn("[history] load failed:", err?.message || err);
    }

    pruneOld();
    save();
  }

  function addCall(number, type = "outgoing", duration = 0, meta = {}) {
    if (!number) return;
    const normalizedType = normalizeDesktopHistoryType(type);
    calls.unshift({
      number: String(number).trim(),
      numberKey: normalizeDesktopHistoryNumber(number),
      type: normalizedType,
      duration,
      timestamp: Number(meta.timestamp || Date.now()),
      sipCode: meta?.sipCode ? String(meta.sipCode) : "",
      sipReason: meta?.sipReason ? String(meta.sipReason) : "",
      q850Cause: meta?.q850Cause ? String(meta.q850Cause) : "",
      q850Text: meta?.q850Text ? String(meta.q850Text) : "",
    });

    pruneOld();
    if (calls.length > 500) calls.splice(500);

    save();
  }

  return { calls, pruneOld, save, load, addCall };
}
