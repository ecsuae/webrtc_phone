import {
  desktopHistoryTypeToIcon,
  desktopHistoryTypeToLabel,
  escapeDesktopHistoryHtml,
  formatDesktopHistoryDateTime,
  formatDesktopHistorySipMeta,
  formatDesktopHistoryTime,
  normalizeDesktopHistoryNumber,
  normalizeDesktopHistoryType,
} from "./desktopHistoryActivityFormatters.js";

function groupedView(calls) {
  const groups = new Map();

  for (const call of calls) {
    const key = call.numberKey || normalizeDesktopHistoryNumber(call.number);
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

function renderHistoryListIntoElement(list, groups, onDial) {
  if (!groups.length) {
    list.innerHTML = '<li style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-phone-slash" style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>No calls in last 10 days</li>';
    return;
  }

  list.innerHTML = groups
    .map((group) => {
      const latest = group.items[0];
      const latestType = normalizeDesktopHistoryType(latest?.type || "outgoing");
      const typeLabel = desktopHistoryTypeToLabel(latestType);
      const icon = desktopHistoryTypeToIcon(latestType);
      const latestMeta = formatDesktopHistorySipMeta(latest);

      const detailsHtml = group.items
        .map((item) => {
          const itemType = normalizeDesktopHistoryType(item.type || "outgoing");
          const itemLabel = desktopHistoryTypeToLabel(itemType);
          const meta = formatDesktopHistorySipMeta(item);
          return `<li class="history-detail-item"><span class="history-type ${escapeDesktopHistoryHtml(itemType)}">${escapeDesktopHistoryHtml(itemLabel)}</span><span class="history-detail-time">${escapeDesktopHistoryHtml(formatDesktopHistoryDateTime(item.timestamp))}${meta.status ? ` | SIP: ${escapeDesktopHistoryHtml(meta.status)}` : ""}${meta.q850 ? ` | ${escapeDesktopHistoryHtml(meta.q850)}` : ""}</span><button class="history-dial-btn" type="button" data-number="${escapeDesktopHistoryHtml(group.displayNumber)}" title="Call ${escapeDesktopHistoryHtml(group.displayNumber)}"><i class="fas fa-phone"></i></button></li>`;
        })
        .join("");

      return `<li class="history-item history-group" data-number-key="${escapeDesktopHistoryHtml(group.numberKey)}"><div class="history-item-left"><div class="history-number"><span class="history-type ${escapeDesktopHistoryHtml(latestType)}"><i class="fas ${icon}"></i> ${typeLabel}</span>${escapeDesktopHistoryHtml(group.displayNumber)}</div><div class="history-time">Last: ${escapeDesktopHistoryHtml(formatDesktopHistoryTime(group.lastTimestamp))} | Total calls: ${group.count}${latestMeta.status ? ` | SIP: ${escapeDesktopHistoryHtml(latestMeta.status)}` : ""}${latestMeta.q850 ? ` | ${escapeDesktopHistoryHtml(latestMeta.q850)}` : ""}</div></div><div class="history-item-actions"><button class="history-toggle-btn" type="button" data-action="toggle" title="Show details"><i class="fas fa-chevron-down"></i></button><button class="history-dial-btn" type="button" data-number="${escapeDesktopHistoryHtml(group.displayNumber)}" title="Call ${escapeDesktopHistoryHtml(group.displayNumber)}"><i class="fas fa-phone"></i></button></div><ul class="history-detail-list" hidden>${detailsHtml}</ul></li>`;
    })
    .join("");
}

function handleListClick(event, onDial) {
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

export function bindAndRenderDesktopHistoryActivity({
  listId = "historyList",
  calls,
  onDial,
} = {}) {
  const list = document.getElementById(listId);
  if (!list) return;

  const groups = groupedView(calls || []);

  if (!list.__historyEventsBound) {
    list.__historyEventsBound = true;
    list.addEventListener("click", (ev) => handleListClick(ev, onDial));
  }

  renderHistoryListIntoElement(list, groups, onDial);
}
