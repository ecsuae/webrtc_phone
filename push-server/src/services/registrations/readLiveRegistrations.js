'use strict';

const http = require('http');
const https = require('https');

function normalizeAor(aor) {
  return String(aor || '').trim().toLowerCase();
}

function extractExtensionFromAor(aor) {
  const s = String(aor || '').trim();
  const m = s.match(/^sips?:([^@]+)@/i);
  return m ? m[1] : '';
}

function extractTransportFromUri(uri) {
  const s = String(uri || '');
  const m = s.match(/;transport=([^;>\s]+)/i);
  return m ? String(m[1] || '').toLowerCase() : '';
}

function toIsoOrEmpty(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return new Date(v * 1000).toISOString();
  return '';
}

function normalizeKamailioContact(c) {
  if (!c) return { contactUri: '', userAgent: '', expiresIn: null, expiresAt: '' };
  if (typeof c === 'string') return { contactUri: c, userAgent: '', expiresIn: null, expiresAt: '' };

  const obj = (c.Contact && typeof c.Contact === 'object') ? c.Contact : c;

  const contactUri = String(obj.Address || obj.address || obj.Contact || obj.contact || obj.Uri || obj.uri || obj.AOR || obj.aor || '');
  const userAgent = String(obj['User-Agent'] || obj.UserAgent || obj.user_agent || obj.userAgent || '');

  // Kamailio ul.dump formats vary; support common keys.
  const expiresInRaw = obj.Expires || obj.expires || obj.ExpiresIn || obj.expires_in || null;
  const expiresIn = typeof expiresInRaw === 'number' ? expiresInRaw : (expiresInRaw && !isNaN(Number(expiresInRaw)) ? Number(expiresInRaw) : null);
  const expiresAt = toIsoOrEmpty(obj.ExpiresAt || obj.expires_at || obj.expire || obj.Expire || '');

  return { contactUri, userAgent, expiresIn, expiresAt };
}

function parseKamailioUlDump(payload) {
  const out = [];
  const domains = payload?.result?.Domains || [];
  for (const d of domains) {
    const domainObj = d?.Domain || d?.domain || null;
    if (!domainObj) continue;
    const domainName = domainObj.Domain || domainObj.domain || '';
    const aors = domainObj.AoRs || domainObj.aors || [];
    for (const a of aors) {
      const info = a?.Info || a?.info || a;
      const contacts = info?.Contacts || info?.contacts || a?.Contacts || a?.contacts || [];
      const firstContact = Array.isArray(contacts) && contacts.length ? (contacts[0]?.Contact || contacts[0]) : null;
      const first = normalizeKamailioContact(firstContact);
      const received = String((firstContact && typeof firstContact === 'object') ? (firstContact.Received || firstContact.received || '') : '');
      const primaryDest = received || first.contactUri;
      const aorStr = first.contactUri ? String(first.contactUri) : '';
      const aorKey = normalizeAor(aorStr);
      const extension = extractExtensionFromAor(aorStr);
      out.push({
        source: 'kamailio',
        extension,
        aor: aorStr,
        aorKey,
        domain: String(domainName || ''),
        contacts,
        kamailioRegistered: true,
        pbxRegistered: false,
        kamailioContact: primaryDest,
        pbxContact: '',
        userAgent: first.userAgent,
        expiresIn: first.expiresIn,
        expiresAt: first.expiresAt,
        transport: extractTransportFromUri(primaryDest),
        sourceDetails: {
          domain: String(domainName || ''),
          contactCount: Array.isArray(contacts) ? contacts.length : 0,
          aorId: String(info?.AoR || info?.aor || ''),
          received,
        },
      });
    }
  }
  return out;
}

function kamailioJsonRpc({ method, params }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 8443,
        path: '/RPC',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 3000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return resolve({ ok: false, status: res.statusCode, error: `HTTP ${res.statusCode}`, raw: data });
          }
          try {
            const parsed = JSON.parse(data);
            resolve({ ok: true, status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ ok: false, status: res.statusCode, error: 'invalid-json', raw: data });
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('kamailio jsonrpc timeout'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function readKamailioRegistrations() {
  const startedAt = Date.now();
  try {
    const r = await kamailioJsonRpc({ method: 'ul.dump', params: ['location'] });
    if (!r.ok) {
      return {
        ok: false,
        source: 'kamailio',
        latencyMs: Date.now() - startedAt,
        error: r.error || 'kamailio-jsonrpc-failed',
        status: r.status,
        registrations: [],
      };
    }
    const regs = parseKamailioUlDump(r.data);
    return {
      ok: true,
      source: 'kamailio',
      latencyMs: Date.now() - startedAt,
      registrations: regs,
    };
  } catch (e) {
    return {
      ok: false,
      source: 'kamailio',
      latencyMs: Date.now() - startedAt,
      error: e?.message || String(e),
      registrations: [],
    };
  }
}

async function readPbxRegistrations() {
  // Intentionally read-only.
  // PBX live registration access is environment-specific (FusionPBX/FreeSWITCH).
  // This implementation supports an operator-provided read-only HTTP endpoint.
  // If not configured, we return a non-fatal health error and still render Kamailio.

  const urlRaw = (process.env.PBX_REG_HTTP_URL || '').trim();
  if (!urlRaw) {
    return {
      ok: false,
      source: 'pbx',
      error: 'pbx-live-registrations-not-configured',
      registrations: [],
    };
  }

  const startedAt = Date.now();
  let url;
  try {
    url = new URL(urlRaw);
  } catch {
    return {
      ok: false,
      source: 'pbx',
      latencyMs: Date.now() - startedAt,
      error: 'pbx-reg-url-invalid',
      registrations: [],
    };
  }

  const pbxDnsName = String(url.hostname || '');

  const client = url.protocol === 'https:' ? https : http;

  const body = await new Promise((resolve, reject) => {
    const req = client.request(
      {
        protocol: url.protocol,
        host: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + (url.search || ''),
        method: 'GET',
        timeout: 4000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode || 0, data }));
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('pbx-reg-http-timeout'));
    });
    req.on('error', reject);
    req.end();
  });

  if (body.status !== 200) {
    return {
      ok: false,
      source: 'pbx',
      latencyMs: Date.now() - startedAt,
      error: `pbx-reg-http-${body.status}`,
      registrations: [],
    };
  }

  // Expected content is operator-defined; we use a tolerant SIP URI scrape.
  // Parse any sip:user@domain occurrences as an AOR.
  const regs = [];
  try {
    const re = /sip:([^@;>\s]+)@([^;>\s]+)/gi;
    const seen = new Set();
    let m;
    while ((m = re.exec(body.data)) !== null) {
      const user = m[1];
      const host = m[2];
      const aor = `sip:${user}@${host}`;
      const key = normalizeAor(aor);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      regs.push({
        source: 'pbx',
        extension: String(user || ''),
        aor,
        aorKey: key,
        domain: String(host || ''),
        pbxDnsName,
        pbxDomain: String(host || ''),
        contacts: [],
        kamailioRegistered: false,
        pbxRegistered: true,
        kamailioContact: '',
        pbxContact: '',
        userAgent: '',
        expiresIn: null,
        expiresAt: '',
        transport: '',
        sourceDetails: { scrapedFrom: urlRaw },
      });
    }
  } catch {}

  return {
    ok: true,
    source: 'pbx',
    latencyMs: Date.now() - startedAt,
    registrations: regs,
  };
}

function mergeByAor(kamRegs, pbxRegs) {
  const byKey = new Map();
  for (const r of kamRegs || []) {
    if (!r?.aorKey) continue;
    if (!byKey.has(r.aorKey)) {
      byKey.set(r.aorKey, {
        aorKey: r.aorKey,
        extension: r.extension || '',
        aor: r.aor,
        kamailio: null,
        pbx: null,
      });
    }
    const row = byKey.get(r.aorKey);
    row.kamailio = r;
    if (!row.extension && r.extension) row.extension = r.extension;
    if (!row.aor && r.aor) row.aor = r.aor;
  }
  for (const r of pbxRegs || []) {
    if (!r?.aorKey) continue;
    if (!byKey.has(r.aorKey)) {
      byKey.set(r.aorKey, {
        aorKey: r.aorKey,
        extension: r.extension || '',
        aor: r.aor,
        kamailio: null,
        pbx: null,
      });
    }
    const row = byKey.get(r.aorKey);
    row.pbx = r;
    if (!row.extension && r.extension) row.extension = r.extension;
    if (!row.aor && r.aor) row.aor = r.aor;
  }
  const merged = Array.from(byKey.values());
  merged.sort((a, b) => (a.aorKey || '').localeCompare(b.aorKey || ''));
  for (const m of merged) {
    const k = !!m.kamailio;
    const p = !!m.pbx;
    m.status = k && p ? 'both' : k ? 'kamailio_only' : p ? 'pbx_only' : 'none';

    // Normalized row fields for rendering.
    const kRow = m.kamailio || null;
    const pRow = m.pbx || null;
    m.kamailioRegistered = !!kRow;
    m.pbxRegistered = !!pRow;
    m.kamailioContact = kRow?.kamailioContact || '';
    m.pbxContact = pRow?.pbxContact || '';
    m.userAgent = kRow?.userAgent || pRow?.userAgent || '';

    m.pbxDnsName = pRow?.pbxDnsName || '';
    m.pbxDomain = pRow?.pbxDomain || '';
    m.expiresIn = kRow?.expiresIn ?? pRow?.expiresIn ?? null;
    m.expiresAt = kRow?.expiresAt || pRow?.expiresAt || '';
    m.transport = kRow?.transport || pRow?.transport || '';
    m.sourceDetails = { kamailio: kRow?.sourceDetails || null, pbx: pRow?.sourceDetails || null };
  }
  return merged;
}

async function readLiveRegistrations() {
  const t0 = Date.now();
  const [kam, pbx] = await Promise.all([readKamailioRegistrations(), readPbxRegistrations()]);
  return {
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - t0,
    kamailio: kam,
    pbx,
    merged: mergeByAor(kam.registrations, pbx.registrations),
  };
}

module.exports = { readLiveRegistrations };
