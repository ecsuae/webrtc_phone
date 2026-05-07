'use strict';
/**
 * routingPage.js — Admin page for PBX routing config and trusted SIP sources.
 *
 * Accessible at http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/admin/routing (WireGuard-only).
 * Shows currently loaded env values and allows editing the routing-config.json.
 * Saving does NOT auto-apply — operator must run `make routing-apply` on host.
 */

const { renderAdminLayout } = require('./adminLayout');

function h(str) {
  // Minimal HTML escape for values rendered in attributes/text
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRoutingPage(currentEnv, savedConfig) {
  const {
    pbxMappings: envMappings,
    trustedIps: envIps,
    trustedDomains: envDomains,
    primaryPbxIp,
    primaryPbxPort,
    publicIp,
    domain,
  } = currentEnv;

  const {
    pbxMappings: savedMappings,
    trustedIps: savedIps,
    trustedDomains: savedDomains,
    savedAt,
  } = savedConfig;

  // Use saved config if present, otherwise seed from current env
  const editMappings = savedMappings.length > 0 ? savedMappings : envMappings;
  const editIps = savedIps.length > 0 ? savedIps : envIps;
  const editDomains = savedDomains.length > 0 ? savedDomains : envDomains;

  const content = `
  <div class="routing-page">
    <div class="card" style="margin-bottom:14px">
      <h2>Current Loaded Config <span class="badge warn">read-only</span></h2>
      <div class="ro-grid">
        <span class="lbl">Primary PBX</span><span class="val mono">${h(primaryPbxIp)}:${h(primaryPbxPort)}</span>
        <span class="lbl">Public IP</span><span class="val mono">${h(publicIp)}</span>
        <span class="lbl">Domain</span><span class="val mono">${h(domain)}</span>
      </div>
      <div style="margin-top:14px">
        <table>
          <thead><tr><th>PBX Domain (active)</th><th>Host (active)</th></tr></thead>
          <tbody>
            ${
              envMappings.length === 0
                ? '<tr><td colspan="2" style="color:var(--muted)">None loaded</td></tr>'
                : envMappings
                    .map(
                      (m) =>
                        `<tr><td class="mono">${h(m.domain)}</td><td class="mono">${h(m.host)}</td></tr>`
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
      <div style="margin-top:10px">
        <table>
          <thead><tr><th>Trusted IP (active)</th><th>Trusted Domain (active)</th></tr></thead>
          <tbody>
            ${
              Math.max(envIps.length, envDomains.length, 1) === 1 && envIps.length === 0 && envDomains.length === 0
                ? '<tr><td colspan="2" style="color:var(--muted)">None loaded</td></tr>'
                : Array.from({ length: Math.max(envIps.length, envDomains.length) }, (_, i) =>
                    `<tr><td class="mono">${envIps[i] ? h(envIps[i].ip) : ''}</td><td class="mono">${envDomains[i] ? h(envDomains[i].domain) : ''}</td></tr>`
                  ).join('')
            }
          </tbody>
        </table>
      </div>
      <div class="saved-ts">Values above are from process.env — what Kamailio is currently using.</div>
    </div>

    <div class="card">
      <h2>Edit Routing Config</h2>
      ${
        savedAt
          ? `<div class="saved-ts">Last saved: ${h(savedAt)}</div>`
          : '<div class="saved-ts">No saved config yet — form seeded from current env.</div>'
      }

      <form id="routingForm">

      <h3 style="font-size:.9rem;color:#94a3b8;margin:16px 0 8px">PBX Domain → Host Mappings</h3>
      <table id="pbxTable">
        <thead><tr><th style="width:40%">Domain</th><th style="width:40%">Host / IP</th><th style="width:14%">Label</th><th style="width:6%"></th></tr></thead>
        <tbody id="pbxBody"></tbody>
      </table>
      <button type="button" class="btn btn-add" style="margin-top:8px" onclick="addPbxRow()">+ Add mapping</button>

      <h3 style="font-size:.9rem;color:#94a3b8;margin:20px 0 8px">Trusted SIP IPs</h3>
      <table id="ipTable">
        <thead><tr><th style="width:40%">IPv4 Address</th><th style="width:52%">Label / Comment</th><th style="width:8%"></th></tr></thead>
        <tbody id="ipBody"></tbody>
      </table>
      <button type="button" class="btn btn-add" style="margin-top:8px" onclick="addIpRow()">+ Add IP</button>

      <h3 style="font-size:.9rem;color:#94a3b8;margin:20px 0 8px">Trusted SIP Domains</h3>
      <table id="domTable">
        <thead><tr><th style="width:46%">Domain</th><th style="width:46%">Label / Comment</th><th style="width:8%"></th></tr></thead>
        <tbody id="domBody"></tbody>
      </table>
      <button type="button" class="btn btn-add" style="margin-top:8px" onclick="addDomRow()">+ Add domain</button>

      <div style="margin-top:20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <button type="button" id="saveBtn" class="btn btn-save" onclick="saveConfig()">Save to routing-config.json</button>
        <div id="statusMsg" class="status"></div>
      </div>

      </form>

      <div class="apply-box" style="margin-top:20px">
        <h3>Applying Changes</h3>
        <p>Saving writes <strong>routing-config.json</strong> only. To activate changes in Kamailio:</p>
        <code>ssh your-server
cd /opt/webrtc-sbc
make routing-apply</code>
        <p><code style="display:inline;background:none;padding:0;color:#93c5fd">make routing-apply</code> reads routing-config.json, updates .env PBX_MAP_* and TRUSTED_SIP_* entries, runs <code style="display:inline;background:none;padding:0;color:#93c5fd">make render</code>, and prints restart instructions.</p>
        <code>docker compose restart kamailio</code>
        <p>Changes to trusted IPs and domain mappings take effect after Kamailio restart. No browser reload needed.</p>
      </div>
    </div>
  </div>
  `;

  const scripts = `<script>
// Seed data from server
const INIT_MAPPINGS = ${JSON.stringify(editMappings)};
const INIT_IPS = ${JSON.stringify(editIps)};
const INIT_DOMS = ${JSON.stringify(editDomains)};

function removeRow(btn) { btn.closest('tr').remove(); }

function addPbxRow(domain, host, label) {
  const d = domain || '', h2 = host || '', l = label || '';
  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td><input type="text" placeholder="pbx.example.com" value="' + esc(d) + '" class="pbx-domain"></td>' +
    '<td><input type="text" placeholder="pbx.example.com or 1.2.3.4" value="' + esc(h2) + '" class="pbx-host"></td>' +
    '<td><input type="text" placeholder="optional" value="' + esc(l) + '" class="pbx-label"></td>' +
    '<td><button type="button" class="btn btn-remove" onclick="removeRow(this)">✕</button></td>';
  document.getElementById('pbxBody').appendChild(tr);
}

function addIpRow(ip, label) {
  const i = ip || '', l = label || '';
  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td><input type="text" placeholder="1.2.3.4" value="' + esc(i) + '" class="ip-val"></td>' +
    '<td><input type="text" placeholder="optional" value="' + esc(l) + '" class="ip-label"></td>' +
    '<td><button type="button" class="btn btn-remove" onclick="removeRow(this)">✕</button></td>';
  document.getElementById('ipBody').appendChild(tr);
}

function addDomRow(domain, label) {
  const d = domain || '', l = label || '';
  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td><input type="text" placeholder="pbx.example.com" value="' + esc(d) + '" class="dom-val"></td>' +
    '<td><input type="text" placeholder="optional" value="' + esc(l) + '" class="dom-label"></td>' +
    '<td><button type="button" class="btn btn-remove" onclick="removeRow(this)">✕</button></td>';
  document.getElementById('domBody').appendChild(tr);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function collectConfig() {
  const pbxMappings = [];
  document.querySelectorAll('#pbxBody tr').forEach(tr => {
    const domain = tr.querySelector('.pbx-domain')?.value.trim();
    const host = tr.querySelector('.pbx-host')?.value.trim();
    const label = tr.querySelector('.pbx-label')?.value.trim();
    if (domain || host) pbxMappings.push({ domain: domain||'', host: host||'', label: label||'' });
  });
  const trustedIps = [];
  document.querySelectorAll('#ipBody tr').forEach(tr => {
    const ip = tr.querySelector('.ip-val')?.value.trim();
    const label = tr.querySelector('.ip-label')?.value.trim();
    if (ip) trustedIps.push({ ip, label: label||'' });
  });
  const trustedDomains = [];
  document.querySelectorAll('#domBody tr').forEach(tr => {
    const domain = tr.querySelector('.dom-val')?.value.trim();
    const label = tr.querySelector('.dom-label')?.value.trim();
    if (domain) trustedDomains.push({ domain, label: label||'' });
  });
  return { pbxMappings, trustedIps, trustedDomains };
}

async function saveConfig() {
  const btn = document.getElementById('saveBtn');
  const msg = document.getElementById('statusMsg');
  btn.disabled = true;
  msg.className = 'status';
  msg.textContent = 'Saving...';
  const body = collectConfig();
  try {
    const resp = await fetch('/admin/routing/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (data.ok) {
      msg.className = 'status ok';
      msg.textContent = 'Saved at ' + data.savedAt + ' — run make routing-apply to activate.';
    } else {
      msg.className = 'status err';
      msg.textContent = 'Error: ' + (data.errors || []).join('; ');
    }
  } catch(e) {
    msg.className = 'status err';
    msg.textContent = 'Request failed: ' + e.message;
  }
  btn.disabled = false;
}

// Seed rows on load
INIT_MAPPINGS.forEach(m => addPbxRow(m.domain, m.host, m.label));
INIT_IPS.forEach(t => addIpRow(t.ip, t.label));
INIT_DOMS.forEach(t => addDomRow(t.domain, t.label));
</script>`;

  const headExtra = `<style>
  .admin-shell .routing-page input[type=text]{background:rgba(15,23,42,.65);border:1px solid rgba(148,163,184,.25);border-radius:10px;color:rgba(226,232,240,.95);padding:8px 10px;font-size:.88rem;width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;}
  .admin-shell .routing-page input[type=text]:focus{outline:none;border-color:rgba(56,189,248,.55);box-shadow:0 0 0 3px rgba(56,189,248,.12);}
  .admin-shell .routing-page .btn{padding:7px 14px;border:none;border-radius:10px;cursor:pointer;font-size:.88rem;font-weight:700;}
  .admin-shell .routing-page .btn-add{background:rgba(37,99,235,.85);color:#fff;}
  .admin-shell .routing-page .btn-add:hover{background:rgba(29,78,216,.95);}
  .admin-shell .routing-page .btn-remove{background:rgba(127,29,29,.9);color:#fecaca;padding:6px 12px;}
  .admin-shell .routing-page .btn-remove:hover{background:rgba(153,27,27,.95);}
  .admin-shell .routing-page .btn-save{background:rgba(22,163,74,.9);color:#fff;font-size:.92rem;padding:9px 18px;}
  .admin-shell .routing-page .btn-save:hover{background:rgba(21,128,61,.95);}
  .admin-shell .routing-page .btn-save:disabled{background:rgba(148,163,184,.15);color:rgba(148,163,184,.8);cursor:not-allowed;}
  .admin-shell .routing-page .apply-box{background:rgba(23,37,84,.55);border:1px solid rgba(30,64,175,.35);border-radius:14px;padding:14px;}
  .admin-shell .routing-page .apply-box h3{color:#93c5fd;font-size:.9rem;margin-bottom:8px;}
  .admin-shell .routing-page .apply-box code{display:block;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;font-size:.86rem;background:rgba(15,23,42,.7);border-radius:12px;padding:10px 12px;color:#86efac;margin:6px 0;white-space:pre-wrap;border:1px solid rgba(148,163,184,.18);}
  .admin-shell .routing-page .apply-box p{font-size:.86rem;color:#94a3b8;margin-top:6px;}
  .admin-shell .routing-page .status{min-height:22px;font-size:.88rem;}
  .admin-shell .routing-page .status.ok{color:#4ade80;}
  .admin-shell .routing-page .status.err{color:#f87171;}
  .admin-shell .routing-page .saved-ts{font-size:.82rem;color:rgba(148,163,184,.85);margin-top:6px;}
  </style>`;

  return renderAdminLayout({
    active: 'routing',
    title: 'Routing Config',
    subtitle: 'PBX domain mappings and trusted SIP sources.',
    content,
    headExtra,
    scripts,
  });
}

module.exports = { renderRoutingPage };
