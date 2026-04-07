import { state } from "./state.js";

export function ensureIncomingBanner() {
  let banner = document.getElementById("incomingAlertBanner");
  if (banner) return banner;

  banner = document.createElement("div");
  banner.id = "incomingAlertBanner";
  banner.style.position = "fixed";
  banner.style.left = "12px";
  banner.style.right = "12px";
  banner.style.top = "12px";
  banner.style.zIndex = "9999";
  banner.style.padding = "12px 14px";
  banner.style.borderRadius = "10px";
  banner.style.background = "#16a34a";
  banner.style.color = "#ffffff";
  banner.style.fontWeight = "700";
  banner.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
  banner.style.display = "none";
  banner.style.textAlign = "center";

  const title = document.createElement("div");
  title.id = "incomingAlertTitle";
  title.style.marginBottom = "10px";
  banner.appendChild(title);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.justifyContent = "center";

  const answerBtn = document.createElement("button");
  answerBtn.type = "button";
  answerBtn.textContent = "Answer";
  answerBtn.id = "incomingBannerAnswer";
  answerBtn.style.border = "none";
  answerBtn.style.borderRadius = "8px";
  answerBtn.style.padding = "8px 14px";
  answerBtn.style.fontWeight = "700";
  answerBtn.style.cursor = "pointer";
  answerBtn.style.background = "#ffffff";
  answerBtn.style.color = "#0f766e";
  answerBtn.addEventListener("click", () => document.getElementById("btnAnswer")?.click());

  const rejectBtn = document.createElement("button");
  rejectBtn.type = "button";
  rejectBtn.textContent = "Reject";
  rejectBtn.id = "incomingBannerReject";
  rejectBtn.style.border = "1px solid #ffffff";
  rejectBtn.style.borderRadius = "8px";
  rejectBtn.style.padding = "8px 14px";
  rejectBtn.style.fontWeight = "700";
  rejectBtn.style.cursor = "pointer";
  rejectBtn.style.background = "transparent";
  rejectBtn.style.color = "#ffffff";
  rejectBtn.addEventListener("click", () => document.getElementById("btnReject")?.click());

  actions.appendChild(answerBtn);
  actions.appendChild(rejectBtn);
  banner.appendChild(actions);
  document.body.appendChild(banner);

  state.installBanner = banner;
  return banner;
}
