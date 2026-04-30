'use strict';

const { buildExportBundle, renderEventsCsv } = require('../services/callLogExport');
const { renderCallPdfToStream } = require('../services/callLogPdf');

function normalizeStr(s) {
  return String(s || '').trim();
}

const EXPORT_DEBUG = String(process.env.CALLLOG_EXPORT_DEBUG || '') === '1';

function dbg(label, obj) {
  if (!EXPORT_DEBUG) return;
  try {
    // eslint-disable-next-line no-console
    console.log(`[calllog-export] ${label}`, obj);
  } catch {
    // ignore
  }
}

function normalizeIdentityToken(raw) {
  const s0 = normalizeStr(raw);
  if (!s0) return '';
  let s = s0;
  if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1);
  s = s.replace(/^"|"$/g, '');
  s = s.replace(/^sip:/i, '');
  s = s.replace(/^sips:/i, '');
  s = s.replace(/^tel:/i, '');
  s = s.split(';')[0] || s;
  s = s.split('?')[0] || s;
  s = s.trim();
  return s;
}

function extractUserKeysFromId(raw) {
  const s = normalizeIdentityToken(raw);
  if (!s) return [];
  const out = new Set();
  out.add(s);
  const beforeAt = s.split('@')[0] || '';
  if (beforeAt) out.add(beforeAt);
  const digits = s.match(/\d{3,}/g);
  if (digits) for (const d of digits) out.add(d);
  return [...out].filter(Boolean);
}

function corrKey(ev) {
  return (ev && (ev.corrId || ev.callId)) || '';
}

function summarizeIdentityPresence(events) {
  const dirs = new Set();
  const users = new Set();
  for (const ev of Array.isArray(events) ? events : []) {
    if (ev && ev.dir) dirs.add(ev.dir);
    for (const u of identityKeysFromEvent(ev)) {
      const ul = normalizeStr(u).toLowerCase();
      if (ul) users.add(ul);
    }
  }
  return { count: (events || []).length, dirs: [...dirs], users: [...users].slice(0, 20) };
}

function slimEventForDebug(ev) {
  if (!ev || typeof ev !== 'object') return null;
  return {
    ts: ev.ts || ev._serverTs,
    type: ev.type,
    dir: ev.dir,
    username: ev.username,
    aor: ev.aor,
    peer: ev.peer,
    peerAor: ev.peerAor,
    corrId: ev.corrId,
    callId: ev.callId,
    sessionId: ev.sessionId,
  };
}

function pickLatestCorrKeyForCaller(eventsNewestFirst, usernameRaw) {
  const u = normalizeStr(usernameRaw).toLowerCase();
  if (!u) return '';

  for (const ev of Array.isArray(eventsNewestFirst) ? eventsNewestFirst : []) {
    const evUser = normalizeStr(ev.username || (ev.aor ? String(ev.aor).split('@')[0] : '')).toLowerCase();
    if (!evUser) continue;
    if (!evUser.includes(u)) continue;
    const k = corrKey(ev);
    if (k) return k;
  }
  return '';
}

function localUserKeyFromEvent(ev) {
  const u = normalizeStr(ev && ev.username);
  if (u) return normalizeIdentityToken(u);
  const aor = normalizeStr(ev && ev.aor);
  if (!aor) return '';
  return normalizeIdentityToken(String(aor).split('@')[0] || '');
}

function peerUserKeyFromEvent(ev) {
  const p = normalizeStr(ev && ev.peer);
  if (p) return normalizeIdentityToken(String(p).split('@')[0] || '');
  const pa = normalizeStr(ev && ev.peerAor);
  if (!pa) return '';
  return normalizeIdentityToken(String(pa).split('@')[0] || '');
}

function identityKeysFromEvent(ev) {
  const out = [];
  const local = localUserKeyFromEvent(ev);
  const peer = peerUserKeyFromEvent(ev);
  for (const v of extractUserKeysFromId(local)) out.push(v);
  for (const v of extractUserKeysFromId(peer)) out.push(v);
  return out;
}

function seedEventsFromSeed(allEvents, seedEv) {
  const all = Array.isArray(allEvents) ? allEvents : [];
  if (!seedEv || typeof seedEv !== 'object') return [];
  const callId = seedEv.callId;
  const corrId = seedEv.corrId;
  const sessionId = seedEv.sessionId;

  // Start wide enough to catch the missing-corrId/missing-callId asymmetry across legs.
  const seeded = all.filter((e) => {
    if (!e || typeof e !== 'object') return false;
    if (corrId && e.corrId === corrId) return true;
    if (callId && e.callId === callId) return true;
    if (sessionId && e.sessionId === sessionId) return true;
    return false;
  });

  dbg('seed.fromMatchedEvent', { seed: slimEventForDebug(seedEv), summary: summarizeIdentityPresence(seeded) });
  return seeded;
}

function resolveCorrIdForSelection(allEvents, selectedKey, selectedEvents) {
  const evs = Array.isArray(selectedEvents) ? selectedEvents : [];
  const all = Array.isArray(allEvents) ? allEvents : [];

  if (selectedKey && all.some((e) => e && e.corrId === selectedKey)) return selectedKey;
  const direct = evs.find((e) => e && e.corrId)?.corrId;
  if (direct) return direct;

  if (selectedKey) {
    const byCallId = all.find((e) => e && e.callId === selectedKey && e.corrId);
    if (byCallId && byCallId.corrId) return byCallId.corrId;
  }

  const sessionIds = [...new Set(evs.map((e) => e && e.sessionId).filter(Boolean))];
  for (const sid of sessionIds) {
    const bySid = all.find((e) => e && e.sessionId === sid && e.corrId);
    if (bySid && bySid.corrId) return bySid.corrId;
  }

  return '';
}

function expandSelectedEvents(allEvents, selectedKey, selectedEvents) {
  const all = Array.isArray(allEvents) ? allEvents : [];
  const corrId = resolveCorrIdForSelection(allEvents, selectedKey, selectedEvents);
  if (corrId) {
    const out = all.filter((e) => e && e.corrId === corrId);
    dbg('expand.byCorrId', { selectedKey, corrId, summary: summarizeIdentityPresence(out) });
    return out;
  }

  const key = normalizeStr(selectedKey);
  if (!key) return Array.isArray(selectedEvents) ? selectedEvents : [];
  const out = all.filter((e) => e && e.callId === key);
  dbg('expand.byCallId', { selectedKey: key, summary: summarizeIdentityPresence(out) });
  return out;
}

function parseEventTsMs(ev) {
  const t = Date.parse(String((ev && (ev.ts || ev._serverTs)) || ''));
  return Number.isFinite(t) ? t : null;
}

function pickLatestCorrKeyForIdentity(eventsNewestFirst, identityRaw) {
  const identity = normalizeStr(identityRaw).toLowerCase();
  if (!identity) return '';

  for (const ev of Array.isArray(eventsNewestFirst) ? eventsNewestFirst : []) {
    const keys = identityKeysFromEvent(ev).map((s) => normalizeStr(s).toLowerCase()).filter(Boolean);
    if (!keys.length) continue;
    if (!keys.some((k) => k.includes(identity))) continue;
    const k = corrKey(ev);
    dbg('match.identity', { identity, matchedEvent: slimEventForDebug(ev), corrKey: k, keys });
    if (k) return k;
  }
  return '';
}

function pickLatestSeedEventForIdentity(eventsNewestFirst, identityRaw) {
  const identity = normalizeStr(identityRaw).toLowerCase();
  if (!identity) return null;

  for (const ev of Array.isArray(eventsNewestFirst) ? eventsNewestFirst : []) {
    const keys = identityKeysFromEvent(ev).map((s) => normalizeStr(s).toLowerCase()).filter(Boolean);
    if (!keys.length) continue;
    if (!keys.some((k) => k.includes(identity))) continue;
    dbg('match.identity.seed', { identity, matchedEvent: slimEventForDebug(ev), keys });
    return ev;
  }
  return null;
}

function pickLatestCorrKeyForCallerReceiver(eventsNewestFirst, callerRaw, receiverRaw) {
  const caller = normalizeStr(callerRaw).toLowerCase();
  const receiver = normalizeStr(receiverRaw).toLowerCase();
  if (!caller || !receiver) return '';

  const byKey = new Map();
  for (const ev of Array.isArray(eventsNewestFirst) ? eventsNewestFirst : []) {
    const k = corrKey(ev);
    if (!k) continue;
    let g = byKey.get(k);
    if (!g) {
      g = { users: new Set(), latestMs: null };
      byKey.set(k, g);
    }
    for (const u of identityKeysFromEvent(ev)) {
      const ul = normalizeStr(u).toLowerCase();
      if (ul) g.users.add(ul);
    }
    const t = parseEventTsMs(ev);
    if (t !== null) g.latestMs = (g.latestMs === null) ? t : Math.max(g.latestMs, t);
  }

  let bestKey = '';
  let bestMs = null;
  for (const [k, g] of byKey.entries()) {
    const hasCaller = Array.from(g.users).some((u) => u.includes(caller));
    const hasReceiver = Array.from(g.users).some((u) => u.includes(receiver));
    if (!hasCaller || !hasReceiver) continue;
    if (g.latestMs === null) continue;
    if (bestMs === null || g.latestMs > bestMs) {
      bestMs = g.latestMs;
      bestKey = k;
    }
  }
  dbg('match.pair', { caller, receiver, chosenKey: bestKey, chosenLatestMs: bestMs });
  return bestKey;
}

function attachLatestCallerExportRoutes(router, { queryEvents, requireWireGuardAccess }) {
  router.get('/calllogs/latest-caller/export.json', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const caller = normalizeStr(req.query.caller);
    if (!caller) return res.status(400).json({ ok: false, error: 'Missing caller' });

    const allEvents = queryEvents({ limit: 5000 });
    const seed = pickLatestSeedEventForIdentity(allEvents, caller);
    if (!seed) return res.status(404).json({ ok: false, error: 'No correlated call found for caller', caller });

    const key = corrKey(seed);
    const callEvents0 = seedEventsFromSeed(allEvents, seed);
    const callEvents = expandSelectedEvents(allEvents, key, callEvents0);
    dbg('result.latest-caller', { caller, key, seed: slimEventForDebug(seed), summary: summarizeIdentityPresence(callEvents) });
    const bundle = buildExportBundle({ events: callEvents, filters: { latestForCaller: caller, corrKey: key }, viewMode: 'raw' });
    const filename = `calltrace-latest-caller-${caller}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(JSON.stringify(bundle, null, 2));
  });

  router.get('/calllogs/latest-caller/export.pdf', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const caller = normalizeStr(req.query.caller);
    if (!caller) return res.status(400).send('Missing caller');

    const allEvents = queryEvents({ limit: 5000 });
    const seed = pickLatestSeedEventForIdentity(allEvents, caller);
    if (!seed) return res.status(404).send('No correlated call found for caller');

    const key = corrKey(seed);
    const callEvents0 = seedEventsFromSeed(allEvents, seed);
    const callEvents = expandSelectedEvents(allEvents, key, callEvents0);
    dbg('result.latest-caller.pdf', { caller, key, seed: slimEventForDebug(seed), summary: summarizeIdentityPresence(callEvents) });
    const filename = `calltrace-latest-caller-${caller}-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    renderCallPdfToStream({
      title: `Latest call for caller ${caller}`,
      events: callEvents,
      filters: { latestForCaller: caller, corrKey: key },
      stream: res,
    });
  });

  router.get('/calllogs/latest-caller/export.csv', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const caller = normalizeStr(req.query.caller);
    if (!caller) return res.status(400).send('Missing caller');

    const allEvents = queryEvents({ limit: 5000 });
    const seed = pickLatestSeedEventForIdentity(allEvents, caller);
    if (!seed) return res.status(404).send('No correlated call found for caller');

    const key = corrKey(seed);
    const callEvents0 = seedEventsFromSeed(allEvents, seed);
    const callEvents = expandSelectedEvents(allEvents, key, callEvents0);
    dbg('result.latest-caller.csv', { caller, key, seed: slimEventForDebug(seed), summary: summarizeIdentityPresence(callEvents) });
    const csv = renderEventsCsv(callEvents);
    const filename = `calltrace-latest-caller-${caller}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(csv);
  });

  router.get('/calllogs/latest-receiver/export.json', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const receiver = normalizeStr(req.query.receiver);
    if (!receiver) return res.status(400).json({ ok: false, error: 'Missing receiver' });

    const allEvents = queryEvents({ limit: 5000 });
    const seed = pickLatestSeedEventForIdentity(allEvents, receiver);
    if (!seed) return res.status(404).json({ ok: false, error: 'No correlated call found for receiver', receiver });

    const key = corrKey(seed);
    const callEvents0 = seedEventsFromSeed(allEvents, seed);
    const callEvents = expandSelectedEvents(allEvents, key, callEvents0);
    dbg('result.latest-receiver', { receiver, key, seed: slimEventForDebug(seed), summary: summarizeIdentityPresence(callEvents) });
    const bundle = buildExportBundle({ events: callEvents, filters: { latestForReceiver: receiver, corrKey: key }, viewMode: 'raw' });
    const filename = `calltrace-latest-receiver-${receiver}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(JSON.stringify(bundle, null, 2));
  });

  router.get('/calllogs/latest-receiver/export.pdf', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const receiver = normalizeStr(req.query.receiver);
    if (!receiver) return res.status(400).send('Missing receiver');

    const allEvents = queryEvents({ limit: 5000 });
    const seed = pickLatestSeedEventForIdentity(allEvents, receiver);
    if (!seed) return res.status(404).send('No correlated call found for receiver');

    const key = corrKey(seed);
    const callEvents0 = seedEventsFromSeed(allEvents, seed);
    const callEvents = expandSelectedEvents(allEvents, key, callEvents0);
    dbg('result.latest-receiver.pdf', { receiver, key, seed: slimEventForDebug(seed), summary: summarizeIdentityPresence(callEvents) });
    const filename = `calltrace-latest-receiver-${receiver}-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    renderCallPdfToStream({
      title: `Latest call for receiver ${receiver}`,
      events: callEvents,
      filters: { latestForReceiver: receiver, corrKey: key },
      stream: res,
    });
  });

  router.get('/calllogs/latest-receiver/export.csv', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const receiver = normalizeStr(req.query.receiver);
    if (!receiver) return res.status(400).send('Missing receiver');

    const allEvents = queryEvents({ limit: 5000 });
    const seed = pickLatestSeedEventForIdentity(allEvents, receiver);
    if (!seed) return res.status(404).send('No correlated call found for receiver');

    const key = corrKey(seed);
    const callEvents0 = seedEventsFromSeed(allEvents, seed);
    const callEvents = expandSelectedEvents(allEvents, key, callEvents0);
    dbg('result.latest-receiver.csv', { receiver, key, seed: slimEventForDebug(seed), summary: summarizeIdentityPresence(callEvents) });
    const csv = renderEventsCsv(callEvents);
    const filename = `calltrace-latest-receiver-${receiver}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(csv);
  });

  router.get('/calllogs/latest/export.json', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const username = normalizeStr(req.query.username);
    if (!username) return res.status(400).json({ ok: false, error: 'Missing username' });

    const allEvents = queryEvents({ limit: 1000 });
    const key = pickLatestCorrKeyForCaller(allEvents, username);
    if (!key) return res.status(404).json({ ok: false, error: 'No correlated call found for caller', username });

    const callEvents = allEvents.filter((ev) => corrKey(ev) === key);
    const bundle = buildExportBundle({
      events: callEvents,
      filters: { latestForCaller: username, corrKey: key },
      viewMode: 'raw',
    });

    const filename = `calltrace-latest-${username}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(JSON.stringify(bundle, null, 2));
  });

  router.get('/calllogs/latest/export.csv', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const username = normalizeStr(req.query.username);
    if (!username) return res.status(400).send('Missing username');

    const allEvents = queryEvents({ limit: 1000 });
    const key = pickLatestCorrKeyForCaller(allEvents, username);
    if (!key) return res.status(404).send('No correlated call found for caller');

    const callEvents = allEvents.filter((ev) => corrKey(ev) === key);
    const csv = renderEventsCsv(callEvents);
    const filename = `calltrace-latest-${username}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(csv);
  });
}

function attachLatestCallerReceiverExportRoutes(router, { queryEvents, requireWireGuardAccess }) {
  router.get('/calllogs/latest-pair/export.json', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const caller = normalizeStr(req.query.caller);
    const receiver = normalizeStr(req.query.receiver);
    if (!caller || !receiver) {
      return res.status(400).json({ ok: false, error: 'Missing caller or receiver' });
    }

    const allEvents = queryEvents({ limit: 5000 });
    const key = pickLatestCorrKeyForCallerReceiver(allEvents, caller, receiver);
    if (!key) {
      return res.status(404).json({ ok: false, error: 'No correlated call found for caller+receiver', caller, receiver });
    }

    const callEvents0 = allEvents.filter((ev) => corrKey(ev) === key);
    const callEvents = expandSelectedEvents(allEvents, key, callEvents0);
    dbg('result.latest-pair', { caller, receiver, key, summary: summarizeIdentityPresence(callEvents) });
    const bundle = buildExportBundle({
      events: callEvents,
      filters: { latestForCaller: caller, latestForReceiver: receiver, corrKey: key },
      viewMode: 'raw',
    });

    const filename = `calltrace-latest-${caller}-${receiver}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(JSON.stringify(bundle, null, 2));
  });

  router.get('/calllogs/latest-pair/export.pdf', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const caller = normalizeStr(req.query.caller);
    const receiver = normalizeStr(req.query.receiver);
    if (!caller || !receiver) return res.status(400).send('Missing caller or receiver');

    const allEvents = queryEvents({ limit: 5000 });
    const key = pickLatestCorrKeyForCallerReceiver(allEvents, caller, receiver);
    if (!key) return res.status(404).send('No correlated call found for caller+receiver');

    const callEvents0 = allEvents.filter((ev) => corrKey(ev) === key);
    const callEvents = expandSelectedEvents(allEvents, key, callEvents0);
    dbg('result.latest-pair.pdf', { caller, receiver, key, summary: summarizeIdentityPresence(callEvents) });
    const filename = `calltrace-latest-${caller}-${receiver}-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    renderCallPdfToStream({
      title: `Latest call for ${caller} + ${receiver}`,
      events: callEvents,
      filters: { latestForCaller: caller, latestForReceiver: receiver, corrKey: key },
      stream: res,
    });
  });

  router.get('/calllogs/latest-pair/export.csv', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const caller = normalizeStr(req.query.caller);
    const receiver = normalizeStr(req.query.receiver);
    if (!caller || !receiver) return res.status(400).send('Missing caller or receiver');

    const allEvents = queryEvents({ limit: 5000 });
    const key = pickLatestCorrKeyForCallerReceiver(allEvents, caller, receiver);
    if (!key) return res.status(404).send('No correlated call found for caller+receiver');

    const callEvents0 = allEvents.filter((ev) => corrKey(ev) === key);
    const callEvents = expandSelectedEvents(allEvents, key, callEvents0);
    dbg('result.latest-pair.csv', { caller, receiver, key, summary: summarizeIdentityPresence(callEvents) });
    const csv = renderEventsCsv(callEvents);
    const filename = `calltrace-latest-${caller}-${receiver}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(csv);
  });
}

module.exports = { attachLatestCallerExportRoutes, attachLatestCallerReceiverExportRoutes };
