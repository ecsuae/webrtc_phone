'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const DEFAULT_ACCOUNTS_PATH = '/opt/webrtc-sbc/data/push-server/provisioning/accounts.json';
const DEFAULT_DEVICES_PATH = '/opt/webrtc-sbc/data/push-server/provisioning/devices.json';

const GRACE_MINUTES_DEFAULT = 15;

function nowIso() {
  return new Date().toISOString();
}

function getKamailioContainerAgeMinutes() {
  const startedAtRaw = String(
    execSync('docker inspect -f {{.State.StartedAt}} kamailio', { encoding: 'utf8' })
  ).trim();
  const startedMs = Date.parse(startedAtRaw);
  if (!Number.isFinite(startedMs)) {
    throw new Error(`unable to parse kamailio StartedAt: ${startedAtRaw}`);
  }
  return Math.floor((Date.now() - startedMs) / 60000);
}

function parseArgs(argv) {
  const out = {
    apply: false,
    dryRun: true,
    graceMinutes: GRACE_MINUTES_DEFAULT,
    accountsPath: DEFAULT_ACCOUNTS_PATH,
    devicesPath: DEFAULT_DEVICES_PATH,
    kamailioHost: '127.0.0.1',
    kamailioPort: 8443,
    kamailioPath: '/RPC',
    timeoutMs: 3000,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = String(argv[i] || '');
    if (a === '--apply') {
      out.apply = true;
      out.dryRun = false;
      continue;
    }
    if (a === '--dry-run') {
      out.apply = false;
      out.dryRun = true;
      continue;
    }
    if (a.startsWith('--grace-minutes=')) {
      const v = Number(a.split('=')[1]);
      if (Number.isFinite(v) && v >= 0) out.graceMinutes = v;
      continue;
    }
    if (a.startsWith('--accounts=')) {
      out.accountsPath = a.split('=')[1] || out.accountsPath;
      continue;
    }
    if (a.startsWith('--devices=')) {
      out.devicesPath = a.split('=')[1] || out.devicesPath;
      continue;
    }
    if (a.startsWith('--kamailio-host=')) {
      out.kamailioHost = a.split('=')[1] || out.kamailioHost;
      continue;
    }
    if (a.startsWith('--kamailio-port=')) {
      const v = Number(a.split('=')[1]);
      if (Number.isFinite(v) && v > 0) out.kamailioPort = v;
      continue;
    }
    if (a.startsWith('--kamailio-path=')) {
      out.kamailioPath = a.split('=')[1] || out.kamailioPath;
      continue;
    }
    if (a.startsWith('--timeout-ms=')) {
      const v = Number(a.split('=')[1]);
      if (Number.isFinite(v) && v > 0) out.timeoutMs = v;
      continue;
    }
  }
  return out;
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function normalizeAccounts(parsed) {
  if (Array.isArray(parsed)) return parsed.filter((x) => x && typeof x === 'object');
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.accounts)) return parsed.accounts.filter((x) => x && typeof x === 'object');
    return Object.values(parsed).filter((x) => x && typeof x === 'object');
  }
  return [];
}

function normalizeDevices(parsed) {
  if (Array.isArray(parsed)) return parsed.filter((x) => x && typeof x === 'object');
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.devices)) return parsed.devices.filter((x) => x && typeof x === 'object');
    return Object.values(parsed).filter((x) => x && typeof x === 'object');
  }
  return [];
}

function normalizeAor(aor) {
  return String(aor || '').trim().toLowerCase();
}

function extractExtensionFromAor(aor) {
  const s = String(aor || '').trim();
  const m = s.match(/^sips?:([^@]+)@/i);
  return m ? m[1] : '';
}

function normalizeKamailioContact(c) {
  if (!c) return { contactUri: '' };
  if (typeof c === 'string') return { contactUri: c };
  const obj = (c.Contact && typeof c.Contact === 'object') ? c.Contact : c;
  const contactUri = String(
    obj.Address || obj.address || obj.Contact || obj.contact || obj.Uri || obj.uri || obj.AOR || obj.aor || ''
  );
  return { contactUri };
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
        extension,
        aor: aorStr,
        aorKey,
        domain: String(domainName || ''),
        primaryDest,
      });
    }
  }
  return out;
}

function kamailioJsonRpc({ host, port, rpcPath, method, params, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
    const req = http.request(
      {
        host,
        port,
        path: rpcPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return resolve({ ok: false, status: res.statusCode, error: `HTTP ${res.statusCode}` });
          }
          try {
            const parsed = JSON.parse(data);
            return resolve({ ok: true, status: res.statusCode, data: parsed });
          } catch {
            return resolve({ ok: false, status: res.statusCode, error: 'invalid-json' });
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

function latestActivityTimestampIso(d) {
  return String(d?.last_seen || d?.last_login_at || d?.active_since || '').trim();
}

function parseIsoMs(iso) {
  const ms = Date.parse(String(iso || '').trim());
  return Number.isFinite(ms) ? ms : null;
}

function summarizeDeviceId(did) {
  const s = String(did || '');
  const prefix = s.startsWith('desktop_') ? 'desktop_' : s.startsWith('device_') ? 'device_' : s.startsWith('desk') ? 'desk' : s ? 'other' : 'empty';
  return { prefix, length: s.length };
}

function atomicWriteJson(filePath, jsonObj) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.tmp.${path.basename(filePath)}.${process.pid}.${Date.now()}`);
  fs.writeFileSync(tmp, JSON.stringify(jsonObj, null, 2));
  fs.renameSync(tmp, filePath);
}

async function main() {
  const cfg = parseArgs(process.argv);

  const restartCooldownMinutes = 15;
  let kamailioContainerAgeMinutes = null;
  try {
    kamailioContainerAgeMinutes = getKamailioContainerAgeMinutes();
  } catch (e) {
    console.log(`[${nowIso()}] kamailio_container_age_minutes=unknown error=${String(e?.message || e)}`);
    console.log(`[${nowIso()}] restart_cooldown_minutes=${restartCooldownMinutes}`);
    console.log(`[${nowIso()}] safety: refusing to release anything because kamailio container age is unknown`);
    process.exitCode = 2;
    return;
  }

  console.log(`[${nowIso()}] kamailio_container_age_minutes=${kamailioContainerAgeMinutes}`);
  console.log(`[${nowIso()}] restart_cooldown_minutes=${restartCooldownMinutes}`);
  if (kamailioContainerAgeMinutes < restartCooldownMinutes) {
    console.log(
      `[${nowIso()}] safety: refusing to release because kamailio_container_age_minutes=${kamailioContainerAgeMinutes} less_than_restart_cooldown_minutes=${restartCooldownMinutes}`
    );
    return;
  }

  console.log(`[${nowIso()}] provisioning-cleanup start mode=${cfg.apply ? 'apply' : 'dry-run'} grace_minutes=${cfg.graceMinutes}`);
  console.log(`[${nowIso()}] paths accounts=${cfg.accountsPath} devices=${cfg.devicesPath}`);

  const accountsParsed = readJsonFile(cfg.accountsPath);
  const devicesParsed = readJsonFile(cfg.devicesPath);

  const accounts = normalizeAccounts(accountsParsed);
  const devices = normalizeDevices(devicesParsed);

  const accountsByPid = new Map();
  for (const a of accounts) {
    const pid = String(a?.provisioning_id || '').trim();
    if (!pid) continue;
    accountsByPid.set(pid, a);
  }

  // Query Kamailio using the same JSON-RPC interface as admin registrations.
  let kam;
  try {
    kam = await kamailioJsonRpc({
      host: cfg.kamailioHost,
      port: cfg.kamailioPort,
      rpcPath: cfg.kamailioPath,
      method: 'ul.dump',
      params: ['location'],
      timeoutMs: cfg.timeoutMs,
    });
  } catch (e) {
    console.log(`[${nowIso()}] kamailio_jsonrpc ok=false error=${String(e?.message || e)}`);
    console.log(`[${nowIso()}] safety: refusing to release anything because JSON-RPC threw`);
    process.exitCode = 2;
    return;
  }

  if (!kam?.ok) {
    console.log(`[${nowIso()}] kamailio_jsonrpc ok=false status=${kam?.status || 0} error=${kam?.error || 'unknown'}`);
    console.log(`[${nowIso()}] safety: refusing to release anything because JSON-RPC returned !ok`);
    process.exitCode = 2;
    return;
  }

  const regs = parseKamailioUlDump(kam.data);
  const liveExtensions = new Set();
  for (const r of regs) {
    const ext = String(r?.extension || '').trim();
    if (ext) liveExtensions.add(ext);
  }

  console.log(`[${nowIso()}] kamailio_registrations parsed=${regs.length} unique_extensions=${liveExtensions.size}`);
  console.log(`[${nowIso()}] registered_extension_count=${liveExtensions.size}`);
  if (liveExtensions.size > 0) {
    const list = Array.from(liveExtensions);
    const shown = list.slice(0, 50);
    console.log(`[${nowIso()}] registered_extensions=${shown.join(',')}${list.length > shown.length ? ',...truncated' : ''}`);
  }

  const graceMs = cfg.graceMinutes * 60 * 1000;
  const nowMs = Date.now();

  const activeDevices = devices.filter((d) => d && typeof d === 'object' && d.revoked !== true && d.active === true);
  console.log(`[${nowIso()}] provisioning_active_slots_before=${activeDevices.length}`);

  const candidates = [];
  const skips = [];

  for (const d of activeDevices) {
    const pid = String(d?.provisioning_id || '').trim();
    const acc = accountsByPid.get(pid) || null;
    const sipUser = String(acc?.sip_username || '').trim();

    if (!acc) {
      skips.push({ pid, device: d, reason: 'no_account_for_provisioning_id' });
      continue;
    }
    if (!sipUser) {
      skips.push({ pid, device: d, reason: 'account_missing_sip_username' });
      continue;
    }

    if (liveExtensions.has(sipUser)) {
      skips.push({ pid, device: d, reason: 'sip_user_is_registered_in_kamailio' });
      continue;
    }

    const tsIso = latestActivityTimestampIso(d);
    const tsMs = parseIsoMs(tsIso);
    if (!tsMs) {
      skips.push({ pid, device: d, reason: 'device_missing_parseable_timestamp' });
      continue;
    }

    const ageMs = nowMs - tsMs;
    if (ageMs < graceMs) {
      skips.push({ pid, device: d, reason: `within_grace_period age_minutes=${Math.floor(ageMs / 60000)}` });
      continue;
    }

    candidates.push({ pid, sipUser, device: d, ageMs, tsIso });
  }

  // Dry-run output: exactly what would be released and why.
  console.log(`[${nowIso()}] release_candidates=${candidates.length}`);
  for (const c of candidates) {
    const did = summarizeDeviceId(c.device?.device_id);
    console.log(
      `[${nowIso()}] candidate action=release_active pid=${c.pid} sip_username=${c.sipUser} device_id_prefix=${did.prefix} device_id_len=${did.length} age_minutes=${Math.floor(c.ageMs / 60000)} reason=not_registered_in_kamailio_and_older_than_grace`
    );
  }

  console.log(`[${nowIso()}] skip_count=${skips.length}`);
  for (const s of skips) {
    const sipUser = String(accountsByPid.get(String(s.pid || '').trim())?.sip_username || '').trim();
    const did = summarizeDeviceId(s.device?.device_id);
    console.log(
      `[${nowIso()}] skip pid=${String(s.pid || '')} sip_username=${sipUser || 'unknown'} device_id_prefix=${did.prefix} device_id_len=${did.length} reason=${s.reason}`
    );
  }

  if (!cfg.apply) {
    console.log(`[${nowIso()}] dry_run_complete no_writes_performed=true`);
    return;
  }

  // Apply mode: backup + release active slots using same semantics as releaseProvisionedDevice.
  const backupDir = '/opt/webrtc-sbc/backups/provisioning-cleanup';
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `devices.json.${Date.now()}.bak`);
  fs.copyFileSync(cfg.devicesPath, backupPath);

  const releaseNow = nowIso();
  const didKeySet = new Set(candidates.map((c) => `${String(c.pid)}|||${String(c.device?.device_id || '')}`));

  const nextDevices = devices.map((row) => {
    const pid = String(row?.provisioning_id || '').trim();
    const did = String(row?.device_id || '').trim();
    const key = `${pid}|||${did}`;
    if (!didKeySet.has(key)) return row;

    return {
      ...row,
      active: false,
      active_since: '',
      last_logout_at: String(row?.last_logout_at || '').trim() || releaseNow,
      stale_released_at: releaseNow,
      last_seen: releaseNow,
    };
  });

  // Preserve original top-level structure if it was {devices:[], savedAt:...}
  let outObj;
  if (devicesParsed && typeof devicesParsed === 'object' && !Array.isArray(devicesParsed) && Array.isArray(devicesParsed.devices)) {
    outObj = { ...devicesParsed, devices: nextDevices, savedAt: releaseNow };
  } else if (Array.isArray(devicesParsed)) {
    outObj = nextDevices;
  } else {
    outObj = { devices: nextDevices, savedAt: releaseNow };
  }

  atomicWriteJson(cfg.devicesPath, outObj);

  const afterActive = nextDevices.filter((d) => d && typeof d === 'object' && d.revoked !== true && d.active === true).length;
  console.log(`[${nowIso()}] apply_complete backup=${backupPath} released=${candidates.length} provisioning_active_slots_after=${afterActive}`);
}

main().catch((e) => {
  console.log(`[${nowIso()}] fatal error=${String(e?.message || e)}`);
  process.exitCode = 1;
});
