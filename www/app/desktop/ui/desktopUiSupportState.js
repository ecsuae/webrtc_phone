function formatDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return "unknown";

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return raw.toLowerCase();
  return hasPlus ? `+${digits}` : digits;
}

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeType(value) {
  const t = String(value || "").trim().toLowerCase();
  if (["incoming", "outgoing", "missed", "rejected", "answered"].includes(t)) return t;
  return "outgoing";
}

function typeToLabel(type) {
  if (type === "incoming") return "Incoming";
  if (type === "missed") return "Missed";
  if (type === "rejected") return "Rejected";
  if (type === "answered") return "Answered";
  return "Outgoing";
}

function typeToIcon(type) {
  if (type === "incoming") return "fa-arrow-down";
  if (type === "missed") return "fa-phone-slash";
  if (type === "rejected") return "fa-phone-slash";
  if (type === "answered") return "fa-phone";
  return "fa-arrow-up";
}

function formatSipMeta(item) {
  const code = item?.sipCode ? String(item.sipCode) : "";
  const reason = item?.sipReason ? String(item.sipReason) : "";
  const q850Cause = item?.q850Cause ? String(item.q850Cause) : "";
  const q850Text = item?.q850Text ? String(item.q850Text) : "";
  const status = code || reason ? `${code}${code && reason ? " " : ""}${reason}`.trim() : "";
  const q850 = q850Cause ? `Q.850 ${q850Cause}${q850Text ? ` (${q850Text})` : ""}` : "";
  return { status, q850 };
}

export function createDesktopHistoryActivity(options = {}) {
  const storageKey = "callHistoryV2";
  const historyDays = Number(options.historyDays || 10);
  const onDial = typeof options.onDial === "function" ? options.onDial : () => {};

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
                numberKey: normalizeNumber(number),
                type: normalizeType(item?.type || "outgoing"),
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

  function groupedView() {
    const groups = new Map();

    for (const call of calls) {
      const key = call.numberKey || normalizeNumber(call.number);
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          numberKey: key,
          displayNumber: call.number || key,
          count: 1,
          lastTimestamp: call.timestamp,
          items: [call],
        });
      } else {
        existing.count += 1;
        if (Number(call.timestamp) > Number(existing.lastTimestamp)) {
          existing.lastTimestamp = call.timestamp;
          existing.displayNumber = call.number || existing.displayNumber;
        }
        existing.items.push(call);
      }
    }

    const result = Array.from(groups.values());
    result.sort((a, b) => Number(b.lastTimestamp) - Number(a.lastTimestamp));
    result.forEach((g) => g.items.sort((a, b) => Number(b.timestamp) - Number(a.timestamp)));
    return result;
  }

  function render() {
    const list = document.getElementById("historyList");
    if (!list) return;

    const groups = groupedView();

    if (!groups.length) {
      list.innerHTML = '<li style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-phone-slash" style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>No calls in last 10 days</li>';
      return;
    }

    list.innerHTML = groups
      .map((group) => {
        const latest = group.items[0];
        const latestType = normalizeType(latest?.type || "outgoing");
        const typeLabel = typeToLabel(latestType);
        const icon = typeToIcon(latestType);
        const latestMeta = formatSipMeta(latest);

        const detailsHtml = group.items
          .map((item) => {
            const itemType = normalizeType(item.type || "outgoing");
            const itemLabel = typeToLabel(itemType);
            const meta = formatSipMeta(item);
            return `<li class="history-detail-item"><span class="history-type ${esc(itemType)}">${esc(itemLabel)}</span><span class="history-detail-time">${esc(formatDateTime(item.timestamp))}${meta.status ? ` | SIP: ${esc(meta.status)}` : ""}${meta.q850 ? ` | ${esc(meta.q850)}` : ""}</span><button class="history-dial-btn" type="button" data-number="${esc(group.displayNumber)}" title="Call ${esc(group.displayNumber)}"><i class="fas fa-phone"></i></button></li>`;
          })
          .join("");

        return `<li class="history-item history-group" data-number-key="${esc(group.numberKey)}"><div class="history-item-left"><div class="history-number"><span class="history-type ${esc(latestType)}"><i class="fas ${icon}"></i> ${typeLabel}</span>${esc(group.displayNumber)}</div><div class="history-time">Last: ${esc(formatTime(group.lastTimestamp))} | Total calls: ${group.count}${latestMeta.status ? ` | SIP: ${esc(latestMeta.status)}` : ""}${latestMeta.q850 ? ` | ${esc(latestMeta.q850)}` : ""}</div></div><div class="history-item-actions"><button class="history-toggle-btn" type="button" data-action="toggle" title="Show details"><i class="fas fa-chevron-down"></i></button><button class="history-dial-btn" type="button" data-number="${esc(group.displayNumber)}" title="Call ${esc(group.displayNumber)}"><i class="fas fa-phone"></i></button></div><ul class="history-detail-list" hidden>${detailsHtml}</ul></li>`;
      })
      .join("");
  }

  function handleListClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const dialBtn = target.closest(".history-dial-btn");
    if (dialBtn) {
      const number = dialBtn.getAttribute("data-number") || "";
      if (number) onDial(number);
      return;
    }

    const toggleBtn = target.closest(".history-toggle-btn");
    const row = target.closest(".history-group");
    if (!row) return;

    if (toggleBtn || target.closest(".history-item-left")) {
      const detail = row.querySelector(".history-detail-list");
      const icon = row.querySelector(".history-toggle-btn i");
      if (!detail) return;
      const nextHidden = !detail.hasAttribute("hidden");
      if (nextHidden) detail.setAttribute("hidden", "hidden");
      else detail.removeAttribute("hidden");
      if (icon) {
        icon.classList.toggle("fa-chevron-down", !nextHidden);
        icon.classList.toggle("fa-chevron-up", nextHidden);
      }
    }
  }

  function ensureEventsBound() {
    const list = document.getElementById("historyList");
    if (!list || list.__historyEventsBound) return;
    list.__historyEventsBound = true;
    list.addEventListener("click", handleListClick);
  }

  function addCall(number, type = "outgoing", duration = 0, meta = {}) {
    if (!number) return;
    const normalizedType = normalizeType(type);
    calls.unshift({
      number: String(number).trim(),
      numberKey: normalizeNumber(number),
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
    render();
  }

  load();
  setTimeout(() => {
    ensureEventsBound();
    render();
  }, 0);

  return { calls, addCall, render, load, save, historyDays };
}
