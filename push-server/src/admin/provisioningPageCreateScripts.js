'use strict';

const CREATE_SCRIPT = `
const WS_URL_TEMPLATE = ({ sipDomain }) => 'wss://' + String(sipDomain || '') + ':7443';

function randDigits(n) {
  let out = '';
  for (let i = 0; i < n; i++) out += String(Math.floor(Math.random() * 10));
  return out;
}

function genProvId() {
  const el = document.getElementById('create_prov_id');
  if (!el) return;
  el.value = randDigits(8);
}

function genPin() {
  const el = document.getElementById('create_pin');
  if (!el) return;
  el.value = randDigits(4);
}

function toggleCreatePin() {
  const el = document.getElementById('create_pin');
  const btn = document.getElementById('create_pin_toggle');
  if (!el || !btn) return;
  const t = String(el.getAttribute('type') || 'password');
  const next = t === 'password' ? 'text' : 'password';
  el.setAttribute('type', next);
  btn.textContent = next === 'password' ? '👁 Show' : '🙈 Hide';
}

function setCreateMsg(text, kind) {
  const msg = document.getElementById('create_msg');
  if (!msg) return;
  msg.className = kind === 'ok' ? 'row-msg ok' : kind === 'err' ? 'row-msg err' : 'row-msg';
  msg.textContent = String(text || '');
}

function autoFillWebsocketUrlFromDomain(opts) {
  const sipDomainEl = document.getElementById('create_sip_domain');
  const wsEl = document.getElementById('create_websocket_url');
  if (!sipDomainEl || !wsEl) return;
  const sipDomain = String(sipDomainEl.value || '').trim();
  if (!sipDomain) {
    setCreateMsg('SIP domain is required to auto-fill WebSocket URL', 'err');
    return;
  }

  const allowOverwrite = !!(opts && opts.allowOverwrite);
  const existing = String(wsEl.value || '').trim();
  if (existing && !allowOverwrite) return;

  wsEl.value = WS_URL_TEMPLATE({ sipDomain });
}

function bindCreateDomainAutofill() {
  const sipDomainEl = document.getElementById('create_sip_domain');
  const wsEl = document.getElementById('create_websocket_url');
  if (!sipDomainEl || !wsEl) return;
  if (sipDomainEl.__autofillBound) return;
  sipDomainEl.__autofillBound = true;

  const maybeFill = () => {
    const existing = String(wsEl.value || '').trim();
    if (existing) return;
    autoFillWebsocketUrlFromDomain({ allowOverwrite: false });
  };

  sipDomainEl.addEventListener('blur', maybeFill);
  sipDomainEl.addEventListener('change', maybeFill);
}

async function createProvAccount() {
  try {
    bindCreateDomainAutofill();
  } catch (e) {}

  const btn = document.getElementById('create_btn');
  const msg = document.getElementById('create_msg');
  const pidEl = document.getElementById('create_prov_id');
  const pinEl = document.getElementById('create_pin');
  const labelEl = document.getElementById('create_label');
  const internalEl = document.getElementById('create_internal_label');
  const userEl = document.getElementById('create_sip_username');
  const passEl = document.getElementById('create_sip_pass');
  const domainEl = document.getElementById('create_sip_domain');
  const wsEl = document.getElementById('create_websocket_url');
  const maxEl = document.getElementById('create_max_devices');
  const enabledEl = document.getElementById('create_enabled');
  const autoEl = document.getElementById('create_auto');

  if (btn) btn.disabled = true;
  if (msg) {
    msg.className = 'row-msg';
    msg.textContent = 'Saving...';
  }

  const body = {
    provisioning_id: String((pidEl && pidEl.value) || '').trim(),
    pin: String((pinEl && pinEl.value) || '').trim(),
    label: String((labelEl && labelEl.value) || '').trim(),
    internal_label: String((internalEl && internalEl.value) || '').trim(),
    sip_username: String((userEl && userEl.value) || '').trim(),
    sip_domain: String((domainEl && domainEl.value) || '').trim(),
    websocket_url: String((wsEl && wsEl.value) || '').trim(),
    max_devices: Number(maxEl && maxEl.value),
    enabled: !!(enabledEl && enabledEl.checked),
    auto_provision_enabled: !!(autoEl && autoEl.checked),
  };

  body['sip_' + 'password'] = String((passEl && passEl.value) || '');

  try {
    const resp = await fetch('/admin/provisioning/account/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (resp.ok && data && data.ok) {
      if (msg) {
        msg.className = 'row-msg ok';
        msg.textContent = 'Created';
      }
      setTimeout(() => window.location.reload(), 250);
    } else {
      const errs = data && data.errors ? data.errors.join('; ') : data && data.error_code ? data.error_code : 'Create failed';
      if (msg) {
        msg.className = 'row-msg err';
        msg.textContent = errs;
      }
    }
  } catch (e) {
    if (msg) {
      msg.className = 'row-msg err';
      msg.textContent = 'Request failed';
    }
  }

  if (btn) btn.disabled = false;
}

try {
  bindCreateDomainAutofill();
} catch (e) {}
`;

module.exports = { CREATE_SCRIPT };
