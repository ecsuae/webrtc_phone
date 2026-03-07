function createAccessControl({ wgCidrPrefix }) {
  function normalizeIp(ip) {
    if (!ip) return '';
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
  }

  function getClientIp(req) {
    const xRealIp = req.headers['x-real-ip'];
    if (typeof xRealIp === 'string' && xRealIp.trim()) {
      return normalizeIp(xRealIp.trim());
    }
    return normalizeIp(req.ip || '');
  }

  function isWireGuardOrLocalIp(ip) {
    return ip === '127.0.0.1' || ip === '::1' || ip.startsWith(wgCidrPrefix);
  }

  function requireWireGuardAccess(req, res, next) {
    const ip = getClientIp(req);
    if (isWireGuardOrLocalIp(ip)) return next();
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This endpoint is only available via WireGuard.',
      ip,
    });
  }

  return {
    normalizeIp,
    getClientIp,
    isWireGuardOrLocalIp,
    requireWireGuardAccess,
  };
}

module.exports = { createAccessControl };
