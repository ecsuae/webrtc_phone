// Service Worker for Push Notifications
// Handles incoming call notifications when page is closed

const SW_VERSION = '1.0.1';
const CACHE_NAME = `webphone-cache-${SW_VERSION}`;

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker version', SW_VERSION);
  self.skipWaiting(); // Activate immediately
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    // Clean up old caches
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Push notification received
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  let data = {
    title: 'Incoming Call',
    body: 'Unknown Caller',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'incoming-call',
    requireInteraction: true,
    actions: [
      { action: 'answer', title: 'Answer', icon: '/icon-answer.png' },
      { action: 'reject', title: 'Reject', icon: '/icon-reject.png' }
    ],
    data: {
      url: '/',
      callId: null,
      from: null
    }
  };

  // Parse push payload
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Push payload:', payload);
      
      if (payload.title) data.title = payload.title;
      if (payload.body) data.body = payload.body;
      if (payload.from) {
        data.body = `From: ${payload.from}`;
        data.data.from = payload.from;
      }
      if (payload.callId) data.data.callId = payload.callId;
      if (payload.url) data.data.url = payload.url;
    } catch (err) {
      console.error('[SW] Error parsing push payload:', err);
    }
  }

  // For iOS: ensure notification wakes the app
  event.waitUntil(
    self.registration.showNotification(data.title, {
      ...data,
      // iOS-specific: higher requireInteraction to ensure wakeup
      requireInteraction: true,
    }).catch(err => {
      console.error('[SW] Failed to show notification:', err);
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};
  const url = notificationData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            // Send message to existing window
            client.postMessage({
              type: 'incoming-call-action',
              action: action,
              callId: notificationData.callId,
              from: notificationData.from,
              wakeup: true  // Signal that app should check registration
            });
            return client.focus();
          }
        }
        
        // Open new window if none found
        if (clients.openWindow) {
          return clients.openWindow(url).then((client) => {
            // Send message after short delay to ensure page loads
            setTimeout(() => {
              if (client) {
                client.postMessage({
                  type: 'incoming-call-action',
                  action: action,
                  callId: notificationData.callId,
                  from: notificationData.from,
                  wakeup: true
                });
              }
            }, 1500);  // Increased from 1000ms to 1500ms for better reliability
          });
        }
      })
  );
});

// Notification close handler - prevent false triggers
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed by user');
  // Don't trigger any actions when user dismisses notification
});

// Message handler (for communication with main app)
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event (basic caching strategy)
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  const reqUrl = event.request.url;

  // Never cache JS app bundles or vendor libs; always fetch latest.
  if (reqUrl.includes('/app/') || reqUrl.includes('/vendor/') || reqUrl.endsWith('/index.html')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  
  // Skip caching for API calls and WebSocket
  if (reqUrl.includes('/api/') || 
      reqUrl.includes('wss://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
