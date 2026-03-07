const express = require('express');

function createPushRoutes({ webpush, vapidPublicKey, subscriptions, listSummary, clearAll }) {
  const router = express.Router();

  router.get('/vapid-public-key', (req, res) => {
    if (!vapidPublicKey) return res.status(500).json({ error: 'VAPID keys not configured' });
    return res.json({ publicKey: vapidPublicKey });
  });

  router.post('/subscribe', (req, res) => {
    const { extension, subscription } = req.body;
    if (!extension || !subscription) return res.status(400).json({ error: 'Missing extension or subscription' });
    if (!subscription.endpoint || !subscription.keys) return res.status(400).json({ error: 'Invalid subscription format' });

    if (!subscriptions.has(extension)) subscriptions.set(extension, []);
    const subs = subscriptions.get(extension);
    const existingIndex = subs.findIndex((s) => s.subscription.endpoint === subscription.endpoint);

    if (existingIndex >= 0) {
      subs[existingIndex] = { subscription, timestamp: Date.now() };
      console.log(`✓ Updated push subscription for extension ${extension}`);
    } else {
      subs.push({ subscription, timestamp: Date.now() });
      console.log(`✓ New push subscription for extension ${extension} (total: ${subs.length})`);
    }

    return res.json({ success: true, message: 'Subscription saved', extension, totalSubscriptions: subs.length });
  });

  router.post('/unsubscribe', (req, res) => {
    const { extension, endpoint } = req.body;
    if (!extension || !endpoint) return res.status(400).json({ error: 'Missing extension or endpoint' });
    if (!subscriptions.has(extension)) return res.status(404).json({ error: 'Extension not found' });

    const filtered = subscriptions.get(extension).filter((s) => s.subscription.endpoint !== endpoint);
    if (filtered.length === 0) {
      subscriptions.delete(extension);
      console.log(`✓ Removed last subscription for extension ${extension}`);
    } else {
      subscriptions.set(extension, filtered);
      console.log(`✓ Removed subscription for extension ${extension} (remaining: ${filtered.length})`);
    }
    return res.json({ success: true, message: 'Subscription removed' });
  });

  router.post('/notify', async (req, res) => {
    const { extension, from, callId, title, body } = req.body;
    if (!extension) return res.status(400).json({ error: 'Missing extension' });
    if (!subscriptions.has(extension)) return res.status(404).json({ error: 'No subscriptions found', extension });

    const subs = subscriptions.get(extension);
    const payload = JSON.stringify({
      title: title || 'Incoming Call',
      body: body || `From: ${from || 'Unknown Caller'}`,
      from,
      callId,
      url: '/',
      timestamp: Date.now(),
    });

    const results = [];
    const failedSubs = [];
    for (let i = 0; i < subs.length; i += 1) {
      const { subscription } = subs[i];
      try {
        const result = await webpush.sendNotification(subscription, payload);
        results.push({ success: true, statusCode: result.statusCode, endpoint: `${subscription.endpoint.substring(0, 50)}...` });
      } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) failedSubs.push(i);
        results.push({ success: false, error: error.message, statusCode: error.statusCode, endpoint: `${subscription.endpoint.substring(0, 50)}...` });
      }
    }

    if (failedSubs.length > 0) {
      const updated = subs.filter((_, idx) => !failedSubs.includes(idx));
      if (updated.length === 0) subscriptions.delete(extension);
      else subscriptions.set(extension, updated);
    }

    const successCount = results.filter((r) => r.success).length;
    return res.json({ success: successCount > 0, message: `Sent to ${successCount}/${subs.length} device(s)`, extension, results });
  });

  router.get('/subscriptions', (req, res) => res.json({ total: subscriptions.size, subscriptions: listSummary() }));

  router.post('/clear-all', (req, res) => {
    const count = clearAll();
    console.log(`✓ Cleared all ${count} subscriptions`);
    return res.json({ success: true, message: `Cleared ${count} subscriptions` });
  });

  return router;
}

module.exports = { createPushRoutes };
