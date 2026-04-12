// Service Worker for Web Push Notifications — Rich Payloads v2

const EVENT_ICONS = {
  payment_approved: '/pwa-192x192.png',
  payment_rejected: '/pwa-192x192.png',
  pix_generated: '/pwa-192x192.png',
  boleto_generated: '/pwa-192x192.png',
  new_order: '/pwa-192x192.png',
  new_customer: '/pwa-192x192.png',
  plan_activated: '/pwa-192x192.png',
  admin_message: '/pwa-192x192.png',
  tenant_status: '/pwa-192x192.png',
  low_stock: '/pwa-192x192.png',
  out_of_stock: '/pwa-192x192.png',
  default: '/pwa-192x192.png',
};

self.addEventListener('push', function(event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Nova notificação', body: event.data.text() };
  }

  const eventType = data.type || data.data?.type || 'default';
  const icon = data.icon || EVENT_ICONS[eventType] || EVENT_ICONS.default;

  const options = {
    body: data.body || '',
    icon: icon,
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || data.data?.url || '/',
      type: eventType,
      tenantId: data.data?.tenantId || null,
      orderId: data.data?.orderId || null,
      paymentId: data.data?.paymentId || null,
    },
    actions: data.actions || [],
    tag: data.tag || eventType || 'default',
    renotify: true,
    requireInteraction: eventType === 'payment_approved' || eventType === 'new_order',
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Notificação', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const action = event.action;

  let targetUrl = url;
  if (action === 'view_order' && event.notification.data?.orderId) {
    targetUrl = '/admin/pedidos';
  } else if (action === 'view_payment') {
    targetUrl = '/admin/pagamentos';
  }

  // Build absolute URL relative to the SW origin
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Try to find an existing window that can navigate
      for (const client of clientList) {
        if ('focus' in client) {
          // If already on the target, just focus
          if (client.url === absoluteUrl) {
            return client.focus();
          }
        }
      }
      // Try to reuse the first available window
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(absoluteUrl).then(function(c) { return c.focus(); });
        }
      }
      return clients.openWindow(absoluteUrl);
    })
  );
});

// Handle push subscription change (browser may rotate keys)
self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(function(subscription) {
        // The frontend will re-sync on next visit
        console.log('Push subscription renewed');
      })
  );
});
