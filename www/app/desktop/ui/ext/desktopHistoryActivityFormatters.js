export function formatDesktopHistoryDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDesktopHistoryTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function normalizeDesktopHistoryNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return "unknown";

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return raw.toLowerCase();
  return hasPlus ? `+${digits}` : digits;
}

export function escapeDesktopHistoryHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeDesktopHistoryType(value) {
  const t = String(value || "").trim().toLowerCase();
  if (["incoming", "outgoing", "missed", "rejected", "answered"].includes(t)) return t;
  return "outgoing";
}

export function desktopHistoryTypeToLabel(type) {
  if (type === "incoming") return "Incoming";
  if (type === "missed") return "Missed";
  if (type === "rejected") return "Rejected";
  if (type === "answered") return "Answered";
  return "Outgoing";
}

export function desktopHistoryTypeToIcon(type) {
  if (type === "incoming") return "fa-arrow-down";
  if (type === "missed") return "fa-phone-slash";
  if (type === "rejected") return "fa-phone-slash";
  if (type === "answered") return "fa-phone";
  return "fa-arrow-up";
}

export function formatDesktopHistorySipMeta(item) {
  const code = item?.sipCode ? String(item.sipCode) : "";
  const reason = item?.sipReason ? String(item.sipReason) : "";
  const q850Cause = item?.q850Cause ? String(item.q850Cause) : "";
  const q850Text = item?.q850Text ? String(item.q850Text) : "";
  const status = code || reason ? `${code}${code && reason ? " " : ""}${reason}`.trim() : "";
  const q850 = q850Cause ? `Q.850 ${q850Cause}${q850Text ? ` (${q850Text})` : ""}` : "";
  return { status, q850 };
}
