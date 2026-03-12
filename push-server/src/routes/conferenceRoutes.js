const express = require('express');

const { createConferenceService } = require('../conference/service');
const { createInMemoryRateLimiter } = require('../conference/rateLimit');

function createConferenceRoutes({ getClientIp, mapPath, pinPepper, tokenSecret, tokenTtlSec, guestSip }) {
  const router = express.Router();
  const service = createConferenceService({
    mapPath,
    pinPepper,
    tokenSecret,
    tokenTtlSec,
    guestSip,
  });

  const limiter = createInMemoryRateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
    keyFn: (req) => (getClientIp ? getClientIp(req) : String(req.ip || 'unknown')),
  });

  router.post('/lookup-pin', limiter.middleware, (req, res) => {
    const clientIp = getClientIp ? getClientIp(req) : String(req.ip || '');

    console.log(`[conf] lookup-pin requested ip=${clientIp}`);

    const result = service.lookupPin({ pin: req.body?.pin });
    if (!result.ok) {
      console.log(`[conf] lookup-pin failed ip=${clientIp} err=${result.error}`);
      return res.status(result.status).json({ error: result.error, message: result.message });
    }

    console.log(`[conf] lookup-pin ok ip=${clientIp} room=${result.result.roomName || '-'} role=${result.result.role} ext=${result.result.conferenceExtension}`);
    return res.json(result.result);
  });

  router.post('/join-details', limiter.middleware, (req, res) => {
    const clientIp = getClientIp ? getClientIp(req) : String(req.ip || '');
    console.log(`[conf] join-details requested ip=${clientIp}`);

    const result = service.joinDetails({ joinToken: req.body?.joinToken });
    if (!result.ok) {
      console.log(`[conf] join-details failed ip=${clientIp} err=${result.error}`);
      return res.status(result.status).json({ error: result.error, message: result.message });
    }

    console.log(`[conf] join-details ok ip=${clientIp} room=${result.result.roomName || '-'} role=${result.result.role} ext=${result.result.conferenceExtension}`);
    return res.json(result.result);
  });

  return router;
}

module.exports = { createConferenceRoutes };
