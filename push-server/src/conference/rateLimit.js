function createInMemoryRateLimiter({ windowMs, maxRequests, keyFn }) {
  const buckets = new Map();

  function prune(now) {
    for (const [key, bucket] of buckets.entries()) {
      if (!bucket || now - bucket.start >= windowMs) {
        buckets.delete(key);
      }
    }
  }

  function middleware(req, res, next) {
    const key = (keyFn ? keyFn(req) : null) || String(req.ip || 'unknown');
    const now = Date.now();
    prune(now);

    const bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      buckets.set(key, { start: now, count: 1 });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > maxRequests) {
      return res.status(429).json({
        error: 'TooManyRequests',
        message: 'Too many attempts. Please try again later.',
      });
    }

    return next();
  }

  return { middleware };
}

module.exports = { createInMemoryRateLimiter };
