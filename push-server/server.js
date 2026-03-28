const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const {
  PORT,
  LISTEN_HOST,
  WG_CIDR_PREFIX,
  ADMIN_BIND_HOST,
  ADMIN_BIND_PORT,
  getVapidConfig,
  isVapidConfigured,
} = require('./src/config');
const { createAccessControl } = require('./src/middleware/accessControl');
const { dedupeMetadataStore } = require('./src/services/metadata/dedupe');
const { createSubscriptionStore } = require('./src/services/push/subscriptionStore');
const { createPushRoutes } = require('./src/routes/pushRoutes');
const { createLogRoutes } = require('./src/routes/logRoutes');
const { createConferenceRoutes } = require('./src/routes/conferenceRoutes');
const { createSystemRoutes } = require('./src/routes/systemRoutes');
const { createDiagRoutes } = require('./src/routes/diagRoutes');
const { createAdminRoutes } = require('./src/routes/adminRoutes');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static dashboard assets
app.use('/src/dashboard', express.static(path.join(process.cwd(), 'src/dashboard')));

const vapid = getVapidConfig();
if (isVapidConfigured()) {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  console.log('✓ VAPID keys configured');
} else {
  console.warn('⚠ VAPID keys not configured! Run: npm run generate-keys');
  console.warn('⚠ Then update .env file with the generated keys');
}

const { getClientIp, requireWireGuardAccess } = createAccessControl({ wgCidrPrefix: WG_CIDR_PREFIX });
const subscriptionStore = createSubscriptionStore();

app.use(
  '/api/push',
  createPushRoutes({
    webpush,
    vapidPublicKey: vapid.publicKey,
    subscriptions: subscriptionStore.subscriptions,
    listSummary: subscriptionStore.listSummary,
    clearAll: subscriptionStore.clearAll,
  })
);

app.use('/api/logs', createLogRoutes({ requireWireGuardAccess }));

app.use(
  '/api/conference',
  createConferenceRoutes({
    getClientIp,
    mapPath: process.env.CONFERENCE_PIN_MAP_PATH || './conferencePins.json',
    pinPepper: process.env.CONFERENCE_PIN_PEPPER || '',
    tokenSecret: process.env.CONFERENCE_JOIN_TOKEN_SECRET || '',
    tokenTtlSec: Number(process.env.CONFERENCE_JOIN_TOKEN_TTL_SEC || 90),
    guestSip: {
      username: process.env.CONFERENCE_GUEST_SIP_USER || '',
      password: process.env.CONFERENCE_GUEST_SIP_PASS || '',
    },
  })
);

app.use(
  '/diagnostics',
  createDiagRoutes({ requireWireGuardAccess })
);

app.use(
  '/admin',
  createAdminRoutes({ requireWireGuardAccess })
);

app.use(
  '/',
  createSystemRoutes({
    isVapidConfigured,
    requireWireGuardAccess,
    getSubscriptionsCount: () => subscriptionStore.subscriptions.size,
  })
);

const dedupeResult = dedupeMetadataStore();
if (dedupeResult.mergedGroups > 0) {
  console.log(`✓ Metadata dedupe complete: ${dedupeResult.mergedGroups} groups merged, ${dedupeResult.removedRecords} duplicate records archived`);
} else {
  console.log('✓ Metadata dedupe complete: no duplicate groups found');
}

app.listen(PORT, LISTEN_HOST, () => {
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  WebRTC Push Notification Server');
  console.log('════════════════════════════════════════');
  console.log(`  Host: ${LISTEN_HOST}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  VAPID: ${isVapidConfigured() ? '✓ Configured' : '✗ Not configured'}`);
  console.log('════════════════════════════════════════');
  console.log('');
});

// Admin listener — WireGuard interface only.
// Binds the same Express app on ADMIN_BIND_HOST:ADMIN_BIND_PORT so that
// /dashboard and /diagnostics/errors are reachable via WireGuard VPN.
// Admin routes are already guarded by requireWireGuardAccess middleware;
// this second bind adds a network-layer separation from the public Nginx path.
app.listen(ADMIN_BIND_PORT, ADMIN_BIND_HOST, () => {
  console.log('════════════════════════════════════════');
  console.log('  Admin listener (WireGuard only)');
  console.log('════════════════════════════════════════');
  console.log(`  Dashboard:    http://${ADMIN_BIND_HOST}:${ADMIN_BIND_PORT}/dashboard`);
  console.log(`  Diagnostics:  http://${ADMIN_BIND_HOST}:${ADMIN_BIND_PORT}/diagnostics/errors`);
  console.log(`  Routing cfg:  http://${ADMIN_BIND_HOST}:${ADMIN_BIND_PORT}/admin/routing`);
  console.log(`  Call logs:    http://${ADMIN_BIND_HOST}:${ADMIN_BIND_PORT}/admin/calllogs`);
  console.log('════════════════════════════════════════');
  console.log('');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
