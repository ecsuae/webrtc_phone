const { hashPin } = require('./pinHash');
const { createPinMapStore } = require('./pinMapStore');
const { createJoinToken, verifyJoinToken } = require('./token');

function sanitizePin(pin) {
  if (typeof pin !== 'string') return '';
  return pin.replace(/\s+/g, '').trim();
}

function createConferenceService({ mapPath, pinPepper, tokenSecret, tokenTtlSec, guestSip }) {
  const store = createPinMapStore({ mapPath });

  function lookupPin({ pin }) {
    const cleanPin = sanitizePin(pin);
    if (!cleanPin) {
      return { ok: false, status: 400, error: 'BadRequest', message: 'Missing conference PIN' };
    }

    if (!pinPepper) {
      return { ok: false, status: 500, error: 'ServerMisconfigured', message: 'CONFERENCE_PIN_PEPPER not configured' };
    }
    if (!tokenSecret) {
      return { ok: false, status: 500, error: 'ServerMisconfigured', message: 'CONFERENCE_JOIN_TOKEN_SECRET not configured' };
    }

    const pinHash = hashPin(cleanPin, pinPepper);
    const entry = store.findByPinHash(pinHash);
    if (!entry) {
      return { ok: false, status: 404, error: 'InvalidPin', message: 'Unknown conference PIN' };
    }

    const ttlMs = Math.max(5_000, Number(tokenTtlSec || 60) * 1000);
    const payload = {
      roomName: entry.roomName,
      role: entry.role,
      conferenceExtension: entry.conferenceExtension,
      expMs: Date.now() + ttlMs,
    };

    const joinToken = createJoinToken(payload, tokenSecret);

    return {
      ok: true,
      status: 200,
      result: {
        roomName: entry.roomName,
        role: entry.role,
        conferenceExtension: entry.conferenceExtension,
        joinToken,
        expiresInSec: Math.floor(ttlMs / 1000),
      },
    };
  }

  function joinDetails({ joinToken }) {
    if (typeof joinToken !== 'string' || !joinToken.trim()) {
      return { ok: false, status: 400, error: 'BadRequest', message: 'Missing joinToken' };
    }

    if (!tokenSecret) {
      return { ok: false, status: 500, error: 'ServerMisconfigured', message: 'CONFERENCE_JOIN_TOKEN_SECRET not configured' };
    }

    const v = verifyJoinToken(joinToken.trim(), tokenSecret);
    if (!v.ok) {
      return {
        ok: false,
        status: v.error === 'TokenExpired' ? 401 : 403,
        error: v.error,
        message: v.error === 'TokenExpired' ? 'Join token expired' : 'Invalid join token',
      };
    }

    if (!guestSip?.username || !guestSip?.password) {
      return { ok: false, status: 500, error: 'ServerMisconfigured', message: 'Guest SIP account not configured' };
    }

    const payload = v.payload || {};

    return {
      ok: true,
      status: 200,
      result: {
        roomName: String(payload.roomName || '').trim(),
        role: String(payload.role || 'participant'),
        conferenceExtension: String(payload.conferenceExtension || '').trim(),
        guestSip: {
          username: guestSip.username,
          password: guestSip.password,
        },
      },
    };
  }

  return {
    store,
    lookupPin,
    joinDetails,
  };
}

module.exports = { createConferenceService };
