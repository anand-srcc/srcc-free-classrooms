const CACHE_NAME = 'srcc-classroom-v30';
const ASSETS = [
  './',
  './index.html',
  './web_app/index.html',
  './web_app/style.css',
  './web_app/app.js?v=30',
  './web_app/data.js?v=30',
  './web_app/cloud_config.js?v=30',
  './web_app/faculty_leaves.js?v=30',
  './web_app/teachers_data.js?v=30',
  './web_app/favicon.png',
  './web_app/srcc_crest.png',
  './web_app/srcc_100years.png',
  './web_app/manifest.json'
];

const FIREBASE_LEAVES_URL = 'https://srcc-leaves-default-rtdb.firebaseio.com/leaves.json';
const LOCAL_LEAVES_URL = './web_app/faculty_leaves.json';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(err => console.warn('[SW Root] Cache note:', err))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const isLocal = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isLocal || e.request.url.includes('.json') || e.request.url.includes('firebaseio.com')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkResponse;
      });
    }).catch(() => caches.match('./web_app/index.html'))
  );
});

// Periodic background sync & push delegate to same leaves check
async function checkLeavesAndNotifyInBackground() {
  try {
    let leaves = [];
    try {
      const resp = await fetch(FIREBASE_LEAVES_URL, { cache: 'no-cache' });
      if (resp.ok) {
        const data = await resp.json();
        leaves = Array.isArray(data?.leaves) ? data.leaves : (Array.isArray(data) ? data : []);
      }
    } catch (err) {}

    if (!leaves || leaves.length === 0) {
      try {
        const resp2 = await fetch(LOCAL_LEAVES_URL, { cache: 'no-cache' });
        if (resp2.ok) {
          const data2 = await resp2.json();
          leaves = Array.isArray(data2?.leaves) ? data2.leaves : (Array.isArray(data2) ? data2 : []);
        }
      } catch (e) {}
    }

    if (!leaves || leaves.length === 0) return;

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
    const yyyy = istDate.getFullYear();
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getDate()).padStart(2, '0');
    const todayIso = `${yyyy}-${mm}-${dd}`;

    const parseIso = (ds) => {
      if (!ds) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) return ds;
      const parts = ds.split(/[\/\-\.]/);
      if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return ds;
    };

    const activeLeaves = leaves.filter(l => {
      const s = parseIso(l.start_date) || '2000-01-01';
      const e = parseIso(l.end_date) || s;
      return s <= todayIso && todayIso <= e;
    });

    if (activeLeaves.length === 0) return;

    const dedupMap = new Map();
    activeLeaves.forEach(l => {
      const key = String(l.teacher_id || l.teacher_name || '').toLowerCase().trim();
      if (key && !dedupMap.has(key)) dedupMap.set(key, l);
    });
    const uniqueLeaves = Array.from(dedupMap.values());
    if (uniqueLeaves.length === 0) return;

    const sig = todayIso + '__' + uniqueLeaves.map(l => (l.teacher_name || '') + '_' + (l.start_date || '')).sort().join('|');
    const cache = await caches.open(CACHE_NAME);
    const lastSigResp = await cache.match('/__srcc_sw_last_notified');
    if (lastSigResp) {
      const lastSig = await lastSigResp.text();
      if (lastSig === sig) return;
    }
    await cache.put('/__srcc_sw_last_notified', new Response(sig));

    const count = uniqueLeaves.length;
    let bodyText = '';
    if (count === 1) {
      bodyText = `Prof. ${uniqueLeaves[0].teacher_name} is marked on leave today. Check suspended classes & vacant rooms.`;
    } else {
      const topNames = uniqueLeaves.slice(0, 3).map(l => l.teacher_name).join(', ');
      bodyText = `${count} professors on leave today (${topNames}${count > 3 ? '...' : ''}). Classrooms updated!`;
    }

    const baseOrigin = self.location.origin;
    await self.registration.showNotification('SRCC Faculty Leave Alert 🏖️', {
      body: bodyText,
      icon: new URL('./web_app/srcc_crest.png', baseOrigin).href,
      badge: new URL('./web_app/favicon.png', baseOrigin).href,
      tag: 'srcc-leave-alert-' + todayIso,
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: './web_app/index.html?view=leaves' }
    });
  } catch (err) {}
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'srcc-check-leaves' || event.tag === 'check-faculty-leaves') {
    event.waitUntil(checkLeavesAndNotifyInBackground());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'srcc-check-leaves-sync' || event.tag === 'check-faculty-leaves') {
    event.waitUntil(checkLeavesAndNotifyInBackground());
  }
});

self.addEventListener('push', (event) => {
  event.waitUntil(checkLeavesAndNotifyInBackground());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './web_app/index.html?view=leaves';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
