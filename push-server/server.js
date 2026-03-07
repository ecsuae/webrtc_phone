const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');

const {
  PORT,
  LISTEN_HOST,
  WG_CIDR_PREFIX,
  getVapidConfig,
  isVapidConfigured,
} = require('./src/config');
const { createAccessControl } = require('./src/middleware/accessControl');
const { dedupeMetadataStore } = require('./src/services/metadata/dedupe');
const { createSubscriptionStore } = require('./src/services/push/subscriptionStore');
const { createPushRoutes } = require('./src/routes/pushRoutes');
const { createLogRoutes } = require('./src/routes/logRoutes');
const { createSystemRoutes } = require('./src/routes/systemRoutes');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const vapid = getVapidConfig();
if (isVapidConfigured()) {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  console.log('✓ VAPID keys configured');
} else {
  console.warn('⚠ VAPID keys not configured! Run: npm run generate-keys');
  console.warn('⚠ Then update .env file with the generated keys');
}

const { requireWireGuardAccess } = createAccessControl({ wgCidrPrefix: WG_CIDR_PREFIX });
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

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
