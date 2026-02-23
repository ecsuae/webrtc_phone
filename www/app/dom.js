// www/app/dom.js
export const $ = (sel) => document.querySelector(sel);

export const el = {
  ext: $("#ext"),
  domain: $("#domain"),
  pass: $("#pass"),
  wss: $("#wsshost"),
  dial: $("#dial"),
  status: $("#status"),
  tstatus: $("#tstatus"),
  remoteAudio: $("#remoteAudio"),
  log: $("#log"),
  btnStart: $("#btnStart"),
  btnStop: $("#btnStop"),
  btnCall: $("#btnCall"),
  btnHangup: $("#btnHangup"),
};

export function setText(node, text) {
  if (!node) return;
  node.textContent = text;
}

export function defaultsFromBody() {
  const d = document.body?.dataset || {};
  return {
    sipDomain: (d.sipDomain || "").trim(),
    wssHost: (d.wssHost || "").trim(),
  };
}

export function normalizeWssServer(value, fallback) {
  const raw = (value || fallback || "").trim();
  if (!raw) return "";
  if (raw.startsWith("ws://") || raw.startsWith("wss://")) return raw;
  return `wss://${raw.replace(/\/$/, "")}/ws`;
}