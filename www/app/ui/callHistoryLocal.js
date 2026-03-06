export function createCallHistory() {
  const calls = [];

  const updateDisplay = () => {
    const list = document.getElementById("historyList");
    if (!list) return;

    if (calls.length === 0) {
      list.innerHTML = '<li style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-phone-slash" style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>No calls yet</li>';
      return;
    }

    list.innerHTML = calls.map((call) => {
      const typeClass = call.type;
      const typeLabel = call.type === "incoming" ? "Incoming" : call.type === "outgoing" ? "Outgoing" : "Missed";
      const icon = call.type === "incoming" ? "fa-arrow-down" : call.type === "outgoing" ? "fa-arrow-up" : "fa-phone-slash";
      return `<li class="history-item"><div class="history-item-left"><div class="history-number"><span class="history-type ${typeClass}"><i class="fas ${icon}"></i> ${typeLabel}</span>${call.number}</div><div class="history-time">${call.displayTime}</div></div></li>`;
    }).join("");
  };

  const save = () => {
    try {
      localStorage.setItem("callHistory", JSON.stringify(calls));
    } catch {}
  };

  const load = () => {
    try {
      const saved = localStorage.getItem("callHistory");
      if (saved) {
        calls.splice(0, calls.length, ...JSON.parse(saved));
      }
      updateDisplay();
    } catch {}
  };

  const addCall = (number, type, duration = 0) => {
    const timestamp = new Date();
    calls.unshift({
      number,
      type,
      duration,
      timestamp,
      displayTime: timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
    if (calls.length > 50) calls.splice(50);
    updateDisplay();
    save();
  };

  load();
  return { calls, addCall, updateDisplay, save, load };
}
