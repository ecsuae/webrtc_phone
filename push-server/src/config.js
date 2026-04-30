require('dotenv').config();

const PORT = Number(process.env.PORT || 3001);
const LISTEN_HOST = process.env.PUSH_LISTEN_HOST || '127.0.0.1';
const WG_CIDR_PREFIX = process.env.WG_CIDR_PREFIX || '10.252.253.';

// Admin listener — WireGuard interface only.
// Serves /dashboard and /diagnostics/* on a dedicated port so they are
// reachable from the WireGuard VPN without being exposed via Nginx on port 443.
const ADMIN_BIND_HOST = process.env.ADMIN_BIND_HOST || '10.252.253.15';
const ADMIN_BIND_PORT = Number(process.env.ADMIN_BIND_PORT || 8081);

function getVapidConfig() {
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  };
}

function isVapidConfigured() {
  const cfg = getVapidConfig();
  return Boolean(cfg.publicKey && cfg.privateKey);
}

module.exports = {
  PORT,
  LISTEN_HOST,
  WG_CIDR_PREFIX,
  ADMIN_BIND_HOST,
  ADMIN_BIND_PORT,
  getVapidConfig,
  isVapidConfigured,
};
