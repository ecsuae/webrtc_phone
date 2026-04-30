export function getRuntimeCb() {
  try {
    const fromGlobal = (typeof window !== "undefined" && window.__BUILD_CB) ? String(window.__BUILD_CB) : "";
    if (fromGlobal) return fromGlobal;
  } catch {}
  try {
    const u = new URL(import.meta.url);
    return (u.searchParams.get("cb") || "").trim();
  } catch {
    return "";
  }
}
