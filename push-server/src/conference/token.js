const crypto = require('crypto');

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecodeToString(str) {
  const padded = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const s = padded + '='.repeat(padLen);
  return Buffer.from(s, 'base64').toString('utf8');
}

function sign(data, secret) {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(data, 'utf8').digest());
}

function createJoinToken(payload, secret) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

function verifyJoinToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return { ok: false, error: 'InvalidToken' };
  const [body, sig] = token.split('.', 2);
  if (!body || !sig) return { ok: false, error: 'InvalidToken' };

  const expected = sign(body, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'InvalidToken' };
  }

  const json = base64UrlDecodeToString(body);
  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    return { ok: false, error: 'InvalidToken' };
  }

  const expMs = Number(payload?.expMs || 0);
  if (!expMs || Date.now() > expMs) {
    return { ok: false, error: 'TokenExpired' };
  }

  return { ok: true, payload };
}

module.exports = { createJoinToken, verifyJoinToken };
