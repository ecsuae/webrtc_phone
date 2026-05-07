'use strict';
/**
 * routingPage.js — Admin page for PBX routing config and trusted SIP sources.
 *
 * Accessible at http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/admin/routing (WireGuard-only).
 * Shows currently loaded env values and allows editing the routing-config.json.
 * Saving does NOT auto-apply — operator must run `make routing-apply` on host.
 */

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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Routing Config — Admin</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:20px}
  .wrap{max-width:960px;margin:0 auto}
  h1{font-size:1.4rem;font-weight:700;color:#f1f5f9;margin-bottom:4px}
  .subtitle{font-size:.85rem;color:#64748b;margin-bottom:20px}
  nav{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
  nav a{color:#38bdf8;font-size:.85rem;text-decoration:none}
  nav a:hover{text-decoration:underline}
  .card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:20px;margin-bottom:20px}
  .card h2{font-size:1rem;font-weight:600;color:#cbd5e1;margin-bottom:14px;border-bottom:1px solid #334155;padding-bottom:8px}
  .ro-grid{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;font-size:.85rem}
  .ro-grid .lbl{color:#64748b}
  .ro-grid .val{color:#e2e8f0;font-family:monospace}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th{text-align:left;color:#64748b;font-weight:600;padding:6px 8px;border-bottom:1px solid #334155}
  td{padding:5px 8px;border-bottom:1px solid #1e293b;vertical-align:middle}
  input[type=text]{background:#0f172a;border:1px solid #475569;border-radius:4px;color:#e2e8f0;
    padding:4px 8px;font-size:.84rem;width:100%;font-family:monospace}
  input[type=text]:focus{outline:none;border-color:#38bdf8}
  .btn{padding:6px 14px;border:none;border-radius:5px;cursor:pointer;font-size:.85rem;font-weight:600}
  .btn-add{background:#1d4ed8;color:#fff}
  .btn-add:hover{background:#2563eb}
  .btn-remove{background:#7f1d1d;color:#fca5a5;padding:4px 10px}
  .btn-remove:hover{background:#991b1b}
  .btn-save{background:#15803d;color:#fff;font-size:.95rem;padding:8px 24px}
  .btn-save:hover{background:#16a34a}
  .btn-save:disabled{background:#334155;color:#64748b;cursor:not-allowed}
  .apply-box{background:#172554;border:1px solid #1e40af;border-radius:6px;padding:14px;margin-top:16px}
  .apply-box h3{color:#93c5fd;font-size:.9rem;margin-bottom:8px}
  .apply-box code{display:block;font-family:monospace;font-size:.84rem;background:#0f172a;
    border-radius:4px;padding:10px 12px;color:#86efac;margin:6px 0;white-space:pre-wrap}
  .apply-box p{font-size:.82rem;color:#94a3b8;margin-top:6px}
  .status{margin-top:10px;min-height:22px;font-size:.85rem}
  .status.ok{color:#4ade80}
  .status.err{color:#f87171}
  .saved-ts{font-size:.78rem;color:#475569;margin-top:4px}
  .warn-badge{display:inline-block;background:#713f12;color:#fde68a;border-radius:4px;
    padding:1px 7px;font-size:.75rem;margin-left:8px}
</style>
</head>
<body>
<div class="wrap">
  <h1>Routing Configuration</h1>
  <div class="subtitle">WireGuard admin — PBX domain mappings and trusted SIP sources</div>

  <nav>
    <a href="/dashboard">← Dashboard</a>
    <a href="/diagnostics/errors">Diagnostics</a>
    <a href="/admin/routing">Routing</a>
    <a href="/admin/calllogs">Call Logs</a>
    <a href="/admin/registrations">Registrations</a>
    <a href="/admin/routing/config">Config JSON</a>
  </nav>

  <!-- Read-only context -->
  <div class="card">
    <h2>Current Loaded Config <span class="warn-badge">read-only</span></h2>
    <div class="ro-grid">
      <span class="lbl">Primary PBX</span><span class="val">${h(primaryPbxIp)}:${h(primaryPbxPort)}</span>
      <span class="lbl">Public IP</span><span class="val">${h(publicIp)}</span>
      <span class="lbl">Domain</span><span class="val">${h(domain)}</span>
    </div>
    <div style="margin-top:14px">
      <table>
        <thead><tr><th>PBX Domain (active)</th><th>Host (active)</th></tr></thead>
        <tbody>
          ${envMappings.length === 0 ? '<tr><td colspan="2" style="color:#475569">None loaded</td></tr>' :
            envMappings.map(m => `<tr><td style="font-family:monospace">${h(m.domain)}</td><td style="font-family:monospace">${h(m.host)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:10px">
      <table>
        <thead><tr><th>Trusted IP (active)</th><th>Trusted Domain (active)</th></tr></thead>
        <tbody>
          ${Math.max(envIps.length, envDomains.length, 1) === 1 && envIps.length === 0 && envDomains.length === 0
            ? '<tr><td colspan="2" style="color:#475569">None loaded</td></tr>'
            : Array.from({ length: Math.max(envIps.length, envDomains.length) }, (_, i) =>
                `<tr><td style="font-family:monospace">${envIps[i] ? h(envIps[i].ip) : ''}</td><td style="font-family:monospace">${envDomains[i] ? h(envDomains[i].domain) : ''}</td></tr>`
              ).join('')}
        </tbody>
      </table>
    </div>
    <div class="saved-ts">Values above are from process.env — what Kamailio is currently using.</div>
  </div>

  <!-- Editable config -->
  <div class="card">
    <h2>Edit Routing Config</h2>
    ${savedAt ? `<div class="saved-ts">Last saved: ${h(savedAt)}</div>` : '<div class="saved-ts">No saved config yet — form seeded from current env.</div>'}

    <form id="routingForm">

    <!-- PBX Mappings -->
    <h3 style="font-size:.9rem;color:#94a3b8;margin:16px 0 8px">PBX Domain → Host Mappings</h3>
    <table id="pbxTable">
      <thead><tr><th style="width:40%">Domain</th><th style="width:40%">Host / IP</th><th style="width:14%">Label</th><th style="width:6%"></th></tr></thead>
      <tbody id="pbxBody">
      </tbody>
    </table>
    <button type="button" class="btn btn-add" style="margin-top:8px" onclick="addPbxRow()">+ Add mapping</button>

    <!-- Trusted IPs -->
    <h3 style="font-size:.9rem;color:#94a3b8;margin:20px 0 8px">Trusted SIP IPs</h3>
    <table id="ipTable">
      <thead><tr><th style="width:40%">IPv4 Address</th><th style="width:52%">Label / Comment</th><th style="width:8%"></th></tr></thead>
      <tbody id="ipBody">
      </tbody>
    </table>
    <button type="button" class="btn btn-add" style="margin-top:8px" onclick="addIpRow()">+ Add IP</button>

    <!-- Trusted Domains -->
    <h3 style="font-size:.9rem;color:#94a3b8;margin:20px 0 8px">Trusted SIP Domains</h3>
    <table id="domTable">
      <thead><tr><th style="width:46%">Domain</th><th style="width:46%">Label / Comment</th><th style="width:8%"></th></tr></thead>
      <tbody id="domBody">
      </tbody>
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

<script>
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
</script>
</body>
</html>`;
}

module.exports = { renderRoutingPage };
