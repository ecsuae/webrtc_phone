// Push Notification Server
// Handles WebRTC incoming call notifications

const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory storage for subscriptions
// Format: { extension: [{ subscription, timestamp }] }
const subscriptions = new Map();

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('✓ VAPID keys configured');
} else {
  console.warn('⚠ VAPID keys not configured! Run: npm run generate-keys');
  console.warn('⚠ Then update .env file with the generated keys');
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    subscriptions: subscriptions.size,
    vapidConfigured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
  });
});

// Get VAPID public key
app.get('/api/push/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications
app.post('/api/push/subscribe', (req, res) => {
  const { extension, subscription } = req.body;

  if (!extension || !subscription) {
    return res.status(400).json({ error: 'Missing extension or subscription' });
  }

  if (!subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Invalid subscription format' });
  }

  // Store subscription for this extension
  if (!subscriptions.has(extension)) {
    subscriptions.set(extension, []);
  }

  const subs = subscriptions.get(extension);
  
  // Check if subscription already exists
  const existingIndex = subs.findIndex(s => s.subscription.endpoint === subscription.endpoint);
  if (existingIndex >= 0) {
    // Update existing subscription
    subs[existingIndex] = {
      subscription,
      timestamp: Date.now()
    };
    console.log(`✓ Updated push subscription for extension ${extension}`);
  } else {
    // Add new subscription
    subs.push({
      subscription,
      timestamp: Date.now()
    });
    console.log(`✓ New push subscription for extension ${extension} (total: ${subs.length})`);
  }

  res.json({
    success: true,
    message: 'Subscription saved',
    extension,
    totalSubscriptions: subs.length
  });
});

// Unsubscribe from push notifications
app.post('/api/push/unsubscribe', (req, res) => {
  const { extension, endpoint } = req.body;

  if (!extension || !endpoint) {
    return res.status(400).json({ error: 'Missing extension or endpoint' });
  }

  if (!subscriptions.has(extension)) {
    return res.status(404).json({ error: 'Extension not found' });
  }

  const subs = subscriptions.get(extension);
  const filteredSubs = subs.filter(s => s.subscription.endpoint !== endpoint);

  if (filteredSubs.length === 0) {
    subscriptions.delete(extension);
    console.log(`✓ Removed last subscription for extension ${extension}`);
  } else {
    subscriptions.set(extension, filteredSubs);
    console.log(`✓ Removed subscription for extension ${extension} (remaining: ${filteredSubs.length})`);
  }

  res.json({
    success: true,
    message: 'Subscription removed'
  });
});

// Send push notification (triggered by incoming call)
app.post('/api/push/notify', async (req, res) => {
  const { extension, from, callId, title, body } = req.body;

  if (!extension) {
    return res.status(400).json({ error: 'Missing extension' });
  }

  if (!subscriptions.has(extension)) {
    console.log(`⚠ No subscriptions found for extension ${extension}`);
    return res.status(404).json({
      error: 'No subscriptions found',
      extension
    });
  }

  const subs = subscriptions.get(extension);
  console.log(`→ Sending push notification to ${subs.length} device(s) for extension ${extension}`);
  console.log(`  From: ${from || 'Unknown'}, Call ID: ${callId || 'N/A'}`);

  const payload = JSON.stringify({
    title: title || 'Incoming Call',
    body: body || `From: ${from || 'Unknown Caller'}`,
    from: from,
    callId: callId,
    url: '/',
    timestamp: Date.now()
  });

  const results = [];
  const failedSubs = [];

  // Send notification to all subscriptions for this extension
  for (let i = 0; i < subs.length; i++) {
    const { subscription } = subs[i];
    
    try {
      const result = await webpush.sendNotification(subscription, payload);
      results.push({
        success: true,
        statusCode: result.statusCode,
        endpoint: subscription.endpoint.substring(0, 50) + '...'
      });
      console.log(`  ✓ Sent to device ${i + 1}: ${result.statusCode}`);
    } catch (error) {
      console.error(`  ✗ Failed to send to device ${i + 1}:`, error.message);
      
      // If subscription is invalid (410 Gone), mark for removal
      if (error.statusCode === 410 || error.statusCode === 404) {
        failedSubs.push(i);
      }
      
      results.push({
        success: false,
        error: error.message,
        statusCode: error.statusCode,
        endpoint: subscription.endpoint.substring(0, 50) + '...'
      });
    }
  }

  // Remove failed subscriptions
  if (failedSubs.length > 0) {
    const updatedSubs = subs.filter((_, index) => !failedSubs.includes(index));
    if (updatedSubs.length === 0) {
      subscriptions.delete(extension);
      console.log(`  Removed all invalid subscriptions for extension ${extension}`);
    } else {
      subscriptions.set(extension, updatedSubs);
      console.log(`  Removed ${failedSubs.length} invalid subscription(s)`);
    }
  }

  const successCount = results.filter(r => r.success).length;
  
  res.json({
    success: successCount > 0,
    message: `Sent to ${successCount}/${subs.length} device(s)`,
    extension,
    results
  });
});

// List all subscriptions (for debugging)
app.get('/api/push/subscriptions', (req, res) => {
  const list = [];
  subscriptions.forEach((subs, extension) => {
    list.push({
      extension,
      devices: subs.length,
      lastUpdate: Math.max(...subs.map(s => s.timestamp))
    });
  });
  
  res.json({
    total: subscriptions.size,
    subscriptions: list
  });
});

// Clear all subscriptions (for testing)
app.post('/api/push/clear-all', (req, res) => {
  const count = subscriptions.size;
  subscriptions.clear();
  console.log(`✓ Cleared all ${count} subscriptions`);
  res.json({
    success: true,
    message: `Cleared ${count} subscriptions`
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  WebRTC Push Notification Server');
  console.log('════════════════════════════════════════');
  console.log(`  Port: ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  VAPID: ${process.env.VAPID_PUBLIC_KEY ? '✓ Configured' : '✗ Not configured'}`);
  console.log('════════════════════════════════════════');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
