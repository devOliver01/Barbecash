// firebase-messaging-sw.js
// Coloque este arquivo na RAIZ do seu projeto (mesma pasta do index.html)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyDsx8SKvD4DzyLZdvC3me5iBx0s6_qhJc8",
  authDomain:        "barbercash-f6891.firebaseapp.com",
  projectId:         "barbercash-f6891",
  storageBucket:     "barbercash-f6891.firebasestorage.app",
  messagingSenderId: "222760224701",
  appId:             "1:222760224701:web:afa93064a97b10c28c34d4"
});

const messaging = firebase.messaging();

// ── Notificações em background (app fechado ou minimizado) ──────────────────
messaging.onBackgroundMessage(payload => {
  console.log('[SW] Background message:', payload);
  const n = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(n.title || 'BarberCash', {
    body:  n.body  || '',
    icon:  n.icon  || '/favicon.ico',
    badge: '/favicon.ico',
    tag:   data.tag || 'barbercash',
    data:  data,
    actions: data.actions ? JSON.parse(data.actions) : [],
    vibrate: [200, 100, 200]
  });
});

// ── Clique na notificação — abre/foca o app ─────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(url) || c.url.includes('index.html'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
