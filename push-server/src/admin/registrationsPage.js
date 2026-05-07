'use strict';

const { renderAdminLayout } = require('./adminLayout');

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

  const content = `
    <div class="grid2" style="margin-bottom:14px">
      ${renderHealthBox('Kamailio (usrloc)', snapshot?.kamailio)}
      ${renderHealthBox('PBX (registrations)', snapshot?.pbx)}
    </div>

    <div class="card">
      <h2>Merged Status <span class="badge warn">read-only</span></h2>
      <div class="ro-grid" style="margin-bottom:10px">
        <span class="lbl">Kamailio count</span><span class="val mono">${kamCount}</span>
        <span class="lbl">PBX count</span><span class="val mono">${pbxCount}</span>
        <span class="lbl">Merged rows</span><span class="val mono">${merged.length}</span>
        <span class="lbl">Generated</span><span class="val mono">${h(generatedAt)}</span>
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
          ${
            merged.length === 0
              ? `<tr><td colspan="11" class="mono" style="color:var(--muted)">No registrations found (or sources unavailable)</td></tr>`
              : merged
                  .map((m) => {
                    const ext = m.extension || '';
                    const aor = m.aor || m.aorKey;
                    const kam = m.kamailioRegistered ? 'present' : '<span style="color:var(--muted)">missing</span>';
                    const pbx = m.pbxRegistered ? 'present' : '<span style="color:var(--muted)">missing</span>';
                    const pbxDns = resolveRegistrationDomain(m);
                    const contact = m.kamailioContact || m.pbxContact || '';
                    const ua = m.userAgent || '';
                    const sources =
                      m.kamailioRegistered && m.pbxRegistered
                        ? 'kamailio,pbx'
                        : m.kamailioRegistered
                          ? 'kamailio'
                          : m.pbxRegistered
                            ? 'pbx'
                            : '';
                    const expires = m.expiresAt ? m.expiresAt : (m.expiresIn != null ? `${m.expiresIn}s` : '');
                    const transport = m.transport || '';
                    return `<tr>
                      <td>${renderStatusBadge(m.status)}</td>
                      <td class="mono">${h(ext)}</td>
                      <td class="mono">${h(aor)}</td>
                      <td>${kam}</td>
                      <td>${pbx}</td>
                      <td class="mono">${h(pbxDns)}</td>
                      <td class="mono">${h(contact)}</td>
                      <td class="mono">${h(ua)}</td>
                      <td class="mono">${h(sources)}</td>
                      <td class="mono">${h(expires)}</td>
                      <td class="mono">${h(transport)}</td>
                    </tr>`;
                  })
                  .join('')
          }
        </tbody>
      </table>
    </div>
  `;

  return renderAdminLayout({
    active: 'registrations',
    title: 'Registrations',
    subtitle: 'Compares Kamailio usrloc vs PBX registrations (read-only).',
    content,
    headExtra: '',
    scripts: '',
  });
}

module.exports = { renderRegistrationsPage };
