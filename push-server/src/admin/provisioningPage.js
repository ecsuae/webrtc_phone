'use strict';

const {
  renderProvisioningAccountRows,
  renderProvisionedDeviceRows,
  CLIENT_SCRIPT,
} = require('./provisioningPageParts');

function renderProvisioningPage({ accounts, devices }) {
  const rows = Array.isArray(accounts) ? accounts : [];
  const devRows = Array.isArray(devices) ? devices : [];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Provisioning — Admin</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:20px}
  .wrap{max-width:1100px;margin:0 auto}
  h1{font-size:1.4rem;font-weight:700;color:#f1f5f9;margin-bottom:4px}
  .subtitle{font-size:.85rem;color:#64748b;margin-bottom:20px}
  nav{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
  nav a{color:#38bdf8;font-size:.85rem;text-decoration:none}
  nav a:hover{text-decoration:underline}
  .card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th{text-align:left;color:#64748b;font-weight:600;padding:6px 8px;border-bottom:1px solid #334155}
  td{padding:6px 8px;border-bottom:1px solid #1e293b;vertical-align:top}
  .muted{color:#64748b}
  .warn-badge{display:inline-block;background:#713f12;color:#fde68a;border-radius:4px;padding:1px 7px;font-size:.75rem;margin-left:8px}
  input[type=number]{background:#0f172a;border:1px solid #475569;border-radius:4px;color:#e2e8f0;padding:4px 8px;font-size:.84rem;width:88px;font-family:monospace}
  input[type=text],input[type=password]{background:#0f172a;border:1px solid #475569;border-radius:4px;color:#e2e8f0;padding:4px 8px;font-size:.84rem;width:100%;font-family:monospace}
  input[type=checkbox]{transform:scale(1.05)}
  .btn{padding:4px 10px;border:none;border-radius:5px;cursor:pointer;font-size:.82rem;font-weight:600;background:#1d4ed8;color:#fff}
  .btn:disabled{background:#334155;color:#64748b;cursor:not-allowed}
  .btn-secondary{background:#334155;color:#e2e8f0}
  .btn-danger{background:#b91c1c;color:#fff}
  .row-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .row-msg{min-height:18px;font-size:.8rem}
  .row-msg.ok{color:#4ade80}
  .row-msg.err{color:#f87171}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .field label{display:block;font-size:.78rem;color:#94a3b8;margin:0 0 4px 0}
  .field{display:block}
</style>
</head>
<body>
<div class="wrap">
  <h1>Provisioning Accounts</h1>
  <div class="subtitle">WireGuard admin — provisioning accounts and provisioned devices</div>

  <nav>
    <a href="/dashboard">← Dashboard</a>
    <a href="/diagnostics/errors">Diagnostics</a>
    <a href="/admin/routing">Routing</a>
    <a href="/admin/calllogs">Call Logs</a>
    <a href="/admin/registrations">Registrations</a>
    <a href="/admin/provisioning">Provisioning</a>
  </nav>

  <div class="card">
    <h2 style="font-size:1rem;font-weight:600;color:#cbd5e1;margin-bottom:10px;border-bottom:1px solid #334155;padding-bottom:8px">Create account</h2>
    <div class="grid" style="margin-bottom:10px">
      <div class="field">
        <label>Provisioning ID (8 digits)</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="create_prov_id" type="text" inputmode="numeric" autocomplete="off" />
          <button class="btn btn-secondary" type="button" onclick="genProvId()">Generate</button>
        </div>
      </div>
      <div class="field">
        <label>PIN (4 digits)</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="create_pin" type="password" inputmode="numeric" autocomplete="off" />
          <button class="btn btn-secondary" type="button" onclick="genPin()">Generate</button>
          <button class="btn btn-secondary" type="button" id="create_pin_toggle" onclick="toggleCreatePin()">👁 Show</button>
        </div>
      </div>
      <div class="field">
        <label>Label</label>
        <input id="create_label" type="text" autocomplete="off" />
      </div>
      <div class="field">
        <label>Internal label</label>
        <input id="create_internal_label" type="text" autocomplete="off" />
      </div>
      <div class="field">
        <label>SIP username</label>
        <input id="create_sip_username" type="text" autocomplete="off" />
      </div>
      <div class="field">
        <label>SIP password (min 6)</label>
        <input id="create_sip_pass" type="password" autocomplete="off" />
      </div>
      <div class="field">
        <label>SIP domain</label>
        <input id="create_sip_domain" type="text" autocomplete="off" />
      </div>
      <div class="field">
        <label>WebSocket URL</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="create_websocket_url" type="text" autocomplete="off" />
          <button class="btn btn-secondary" type="button" onclick="autoFillWebsocketUrlFromDomain()">Auto-fill</button>
        </div>
      </div>
      <div class="field">
        <label>Max devices</label>
        <input id="create_max_devices" type="number" value="1" min="1" step="1" />
      </div>
      <div class="field" style="display:flex;align-items:end;gap:12px">
        <label style="font-family:monospace;display:flex;align-items:center;gap:6px;margin:0">
          <input type="checkbox" id="create_enabled" checked>
          enabled
        </label>
        <label style="font-family:monospace;display:flex;align-items:center;gap:6px;margin:0">
          <input type="checkbox" id="create_auto" checked>
          auto
        </label>
      </div>
    </div>
    <div class="row-actions">
      <button class="btn" type="button" id="create_btn" onclick="createProvAccount()">Create</button>
      <div class="row-msg" id="create_msg"></div>
    </div>
  </div>

  <div class="card">
    <h2 style="font-size:1rem;font-weight:600;color:#cbd5e1;margin-bottom:10px;border-bottom:1px solid #334155;padding-bottom:8px">Accounts <span class="warn-badge">manual Phase A</span></h2>
    <table>
      <thead>
        <tr>
          <th>Provisioning ID</th>
          <th>PIN</th>
          <th>Label</th>
          <th>Internal</th>
          <th>Enabled</th>
          <th>Auto</th>
          <th>Max devices</th>
          <th>SIP user</th>
          <th>SIP domain</th>
          <th>WebSocket URL</th>
          <th>Devices</th>
          <th>Account revoked</th>
          <th>Update</th>
        </tr>
      </thead>
      <tbody>
        ${renderProvisioningAccountRows({ rows, devices })}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2 style="font-size:1rem;font-weight:600;color:#cbd5e1;margin-bottom:10px;border-bottom:1px solid #334155;padding-bottom:8px">Devices</h2>
    <table>
      <thead>
        <tr>
          <th>Provisioning ID</th>
          <th>SIP user</th>
          <th>Device ID</th>
          <th>Name</th>
          <th>Platform</th>
          <th>App</th>
          <th>Active</th>
          <th>First</th>
          <th>Last</th>
          <th>Login</th>
          <th>Logout</th>
          <th>Revoked</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${renderProvisionedDeviceRows(devRows, rows)}
      </tbody>
    </table>
  </div>
</div>
${CLIENT_SCRIPT}
</body>
</html>`;
}

module.exports = { renderProvisioningPage };
