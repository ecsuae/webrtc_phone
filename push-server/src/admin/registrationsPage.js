'use strict';

function h(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderStatusBadge(s) {
  const key = String(s || '');
  const cfg = {
    both: { bg: '#14532d', fg: '#bbf7d0', label: 'Both' },
    kamailio_only: { bg: '#1e3a8a', fg: '#bfdbfe', label: 'Kamailio only' },
    pbx_only: { bg: '#7c2d12', fg: '#fed7aa', label: 'PBX only' },
    none: { bg: '#334155', fg: '#cbd5e1', label: 'Missing' },
  };
  const c = cfg[key] || cfg.none;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${c.bg};color:${c.fg};font-size:.75rem;line-height:1.4">${h(c.label)}</span>`;
}

function renderHealthBox(title, src) {
  const ok = !!src?.ok;
  const latency = typeof src?.latencyMs === 'number' ? `${src.latencyMs}ms` : '';
  const msg = ok ? 'OK' : (src?.error || 'Unavailable');
  return `
  <div class="card">
    <h2>${h(title)} <span class="warn-badge">read-only</span></h2>
    <div class="ro-grid">
      <span class="lbl">Status</span><span class="val">${h(ok ? 'OK' : 'FAIL')} ${latency ? `(${h(latency)})` : ''}</span>
      <span class="lbl">Message</span><span class="val">${h(msg)}</span>
    </div>
  </div>`;
}

function extractSipHost(uri) {
  const s = String(uri || '').trim();
  const m = s.match(/^sips?:[^@]+@([^;>\s]+)/i);
  return m ? String(m[1] || '') : '';
}

function isIpv4Host(host) {
  const s = String(host || '').trim();
  if (!s) return false;
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  for (let i = 1; i <= 4; i += 1) {
    const n = Number(m[i]);
    if (!Number.isFinite(n) || n < 0 || n > 255) return false;
  }
  return true;
}

function normalizeHostCandidate(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  return s;
}

function isHostnameLike(host) {
  const s = String(host || '').trim();
  if (!s) return false;
  if (isIpv4Host(s)) return false;
  return s.includes('.');
}

function resolveRegistrationDomain(m) {
  const pbxDnsName = normalizeHostCandidate(m?.pbxDnsName);
  if (isHostnameLike(pbxDnsName)) return pbxDnsName;

  const pbxDomain = normalizeHostCandidate(m?.pbxDomain);
  if (isHostnameLike(pbxDomain)) return pbxDomain;

  const aor = String(m?.aor || m?.aorKey || '').trim();
  const aorHost = normalizeHostCandidate(extractSipHost(aor));
  if (isHostnameLike(aorHost)) return aorHost;

  const kamDomain = normalizeHostCandidate(m?.sourceDetails?.kamailio?.domain);
  if (isHostnameLike(kamDomain)) return kamDomain;

  const anyLiveDomain = normalizeHostCandidate(m?.domain);
  if (isHostnameLike(anyLiveDomain)) return anyLiveDomain;

  const ipCandidates = [pbxDnsName, pbxDomain, aorHost, kamDomain, anyLiveDomain].filter(Boolean);
  const ip0 = ipCandidates.find(isIpv4Host);
  if (ip0) return ip0;

  return 'Unknown';
}

function renderRegistrationsPage(snapshot) {
  const generatedAt = snapshot?.generatedAt || '';
  const merged = Array.isArray(snapshot?.merged) ? snapshot.merged : [];

  const kamCount = Array.isArray(snapshot?.kamailio?.registrations) ? snapshot.kamailio.registrations.length : 0;
  const pbxCount = Array.isArray(snapshot?.pbx?.registrations) ? snapshot.pbx.registrations.length : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Registrations — Admin</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:20px}
  .wrap{max-width:1100px;margin:0 auto}
  h1{font-size:1.4rem;font-weight:700;color:#f1f5f9;margin-bottom:4px}
  .subtitle{font-size:.85rem;color:#64748b;margin-bottom:20px}
  nav{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
  nav a{color:#38bdf8;font-size:.85rem;text-decoration:none}
  nav a:hover{text-decoration:underline}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:14px}
  .card h2{font-size:1rem;font-weight:600;color:#cbd5e1;margin-bottom:10px;border-bottom:1px solid #334155;padding-bottom:8px}
  .ro-grid{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;font-size:.85rem}
  .ro-grid .lbl{color:#64748b}
  .ro-grid .val{color:#e2e8f0;font-family:monospace}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th{text-align:left;color:#64748b;font-weight:600;padding:6px 8px;border-bottom:1px solid #334155}
  td{padding:6px 8px;border-bottom:1px solid #1e293b;vertical-align:top}
  .muted{color:#64748b}
  .warn-badge{display:inline-block;background:#713f12;color:#fde68a;border-radius:4px;padding:1px 7px;font-size:.75rem;margin-left:8px}
</style>
</head>
<body>
<div class="wrap">
  <h1>Live Registrations</h1>
  <div class="subtitle">WireGuard admin — compares Kamailio usrloc vs PBX registrations (read-only). Generated: <span style="font-family:monospace">${h(generatedAt)}</span></div>

  <nav>
    <a href="/dashboard">← Dashboard</a>
    <a href="/diagnostics/errors">Diagnostics</a>
    <a href="/admin/routing">Routing</a>
    <a href="/admin/calllogs">Call Logs</a>
    <a href="/admin/registrations">Registrations</a>
  </nav>

  <div class="grid2">
    ${renderHealthBox('Kamailio (usrloc)', snapshot?.kamailio)}
    ${renderHealthBox('PBX (registrations)', snapshot?.pbx)}
  </div>

  <div class="card">
    <h2>Merged Status <span class="warn-badge">read-only</span></h2>
    <div class="ro-grid" style="margin-bottom:10px">
      <span class="lbl">Kamailio count</span><span class="val">${kamCount}</span>
      <span class="lbl">PBX count</span><span class="val">${pbxCount}</span>
      <span class="lbl">Merged rows</span><span class="val">${merged.length}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Status</th>
          <th>Extension</th>
          <th>AOR</th>
          <th>Kamailio</th>
          <th>PBX</th>
          <th>PBX DNS</th>
          <th>Contact / Destination</th>
          <th>User-Agent</th>
          <th>Source(s)</th>
          <th>Expires</th>
          <th>Transport</th>
        </tr>
      </thead>
      <tbody>
        ${merged.length === 0 ? `<tr><td colspan="11" class="muted">No registrations found (or sources unavailable)</td></tr>` :
          merged.map((m) => {
            const ext = m.extension || '';
            const aor = m.aor || m.aorKey;
            const kam = m.kamailioRegistered ? 'present' : '<span class="muted">missing</span>';
            const pbx = m.pbxRegistered ? 'present' : '<span class="muted">missing</span>';
            const pbxDns = resolveRegistrationDomain(m);
            const contact = m.kamailioContact || m.pbxContact || '';
            const ua = m.userAgent || '';
            const sources = m.kamailioRegistered && m.pbxRegistered ? 'kamailio,pbx' : m.kamailioRegistered ? 'kamailio' : m.pbxRegistered ? 'pbx' : '';
            const expires = m.expiresAt ? m.expiresAt : (m.expiresIn != null ? `${m.expiresIn}s` : '');
            const transport = m.transport || '';
            return `<tr>
              <td>${renderStatusBadge(m.status)}</td>
              <td style="font-family:monospace">${h(ext)}</td>
              <td style="font-family:monospace">${h(aor)}</td>
              <td>${kam}</td>
              <td>${pbx}</td>
              <td style="font-family:monospace">${h(pbxDns)}</td>
              <td style="font-family:monospace">${h(contact)}</td>
              <td style="font-family:monospace">${h(ua)}</td>
              <td style="font-family:monospace">${h(sources)}</td>
              <td style="font-family:monospace">${h(expires)}</td>
              <td style="font-family:monospace">${h(transport)}</td>
            </tr>`;
          }).join('')}
      </tbody>
    </table>
  </div>
</div>
</body>
</html>`;
}

module.exports = { renderRegistrationsPage };
