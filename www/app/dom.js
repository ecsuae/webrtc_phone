// www/app/dom.js
export const $ = (sel) => document.querySelector(sel);

export const el = {
  ext: null,
  domain: null,
  pass: null,
  wss: null,
  dial: null,
  status: null,
  tstatus: null,
  domainDisplay: null,
  remoteAudio: null,
  log: null,
  btnStart: null,
  btnStop: null,
  btnInstallApp: null,
  btnCall: null,
  btnHangup: null,
  btnAnswer: null,
  btnReject: null,
};

export function refreshEl() {
  el.ext = $("#ext");
  el.domain = $("#domain");
  el.pass = $("#pass");
  el.wss = $("#wsshost");
  el.dial = $("#dial");
  el.status = $("#status");
  el.tstatus = $("#tstatus");
  el.domainDisplay = $("#domainDisplay");
  el.remoteAudio = $("#remoteAudio");
  el.log = $("#log");
  el.btnStart = $("#btnStart");
  el.btnStop = $("#btnStop");
  el.btnInstallApp = $("#btnInstallApp");
  el.btnCall = $("#btnCall");
  el.btnHangup = $("#btnHangup");
  el.btnAnswer = $("#btnAnswer");
  el.btnReject = $("#btnReject");
  return el;
}

refreshEl();

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

export function parseSipAccount(usernameValue, domainValue, fallbackDomainValue) {
  const rawUsername = (usernameValue || "").trim();
  const explicitDomain = (domainValue || "").trim();
  const fallbackDomain = (fallbackDomainValue || "").trim();

  let username = rawUsername;
  let inlineDomain = "";

  const atIndex = rawUsername.lastIndexOf("@");
  if (atIndex > 0 && atIndex < rawUsername.length - 1) {
    username = rawUsername.slice(0, atIndex).trim();
    inlineDomain = rawUsername.slice(atIndex + 1).trim();
  }

  const domain = inlineDomain || explicitDomain || fallbackDomain;
  console.log('[parseSipAccount] raw=%s, explicit=%s, fallback=%s -> user=%s, inline=%s, final domain=%s', 
    rawUsername, explicitDomain, fallbackDomain, username, inlineDomain, domain);
  return {
    rawUsername,
    username,
    domain,
    inlineDomain,
    hasInlineDomain: !!inlineDomain,
  };
}

export function normalizeWssServer(value, fallback) {
  const raw = (value || fallback || "").trim();
  if (!raw) return "";
  if (raw.startsWith("ws://") || raw.startsWith("wss://")) return raw;
  return `wss://${raw.replace(/\/$/, "")}/ws`;
}