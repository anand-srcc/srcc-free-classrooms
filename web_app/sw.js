const CACHE_NAME = 'srcc-classroom-v32';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js?v=32',
  './data.js?v=32',
  './cloud_config.js?v=32',
  './faculty_leaves.js?v=32',
  './teachers_data.js?v=32',
  './srcc_data.json',
  './favicon.png',
  './srcc_crest.png',
  './srcc_100years.png',
  './manifest.json'
];

const FIREBASE_LEAVES_URL = 'https://srcc-leaves-default-rtdb.firebaseio.com/leaves.json';
const LOCAL_LEAVES_URL = './faculty_leaves.json';
const LOCAL_DATA_URL = './srcc_data.json';

// --- Install Event ---
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(err => console.warn('[SW] Cache addAll note:', err))
  );
});

// --- Activate Event ---
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// --- Fetch Event ---
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
    }).catch(() => caches.match('./index.html'))
  );
});

// ============================================================================
// 🔔 BACKGROUND HOURLY CAMPUS NOTIFICATION DISPATCHER (Every 1 Hour)
// Dispatches absent faculty count + currently free rooms count!
// ============================================================================
async function checkLeavesAndNotifyInBackground(isForced = false) {
  try {
    const ONE_HOUR = 60 * 60 * 1000;
    const cache = await caches.open(CACHE_NAME);

    // 1. Enforce 1-hour interval unless explicitly broadcasted from Admin
    if (!isForced) {
      const lastHourlyResp = await cache.match('/__srcc_sw_last_hourly_time');
      if (lastHourlyResp) {
        const lastTime = parseInt(await lastHourlyResp.text(), 10);
        if (Date.now() - lastTime < ONE_HOUR) {
          return; // Skip if less than 1 hour has elapsed
        }
      }
    }

    // 2. Fetch leaves from Firebase RTDB (fallback to local JSON)
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

    // 3. Compute IST date & time
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
    const yyyy = istDate.getFullYear();
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getDate()).padStart(2, '0');
    const todayIso = `${yyyy}-${mm}-${dd}`;
    const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = dayNames[istDate.getDay()];

    const parseIso = (ds) => {
      if (!ds) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) return ds;
      const parts = ds.split(/[\/\-\.]/);
      if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return ds;
    };

    // Filter active leaves for today
    const activeLeaves = leaves.filter(l => {
      const s = parseIso(l.start_date) || '2000-01-01';
      const e = parseIso(l.end_date) || s;
      return s <= todayIso && todayIso <= e;
    });

    const dedupMap = new Map();
    activeLeaves.forEach(l => {
      const key = String(l.teacher_id || l.teacher_name || '').toLowerCase().trim();
      if (key && !dedupMap.has(key)) dedupMap.set(key, l);
    });
    const uniqueLeaves = Array.from(dedupMap.values());
    const count = uniqueLeaves.length;

    // 4. Calculate Number of Classrooms Free Right Now
    let freeRoomsCount = 0;
    let freeRoomsLine = '';

    if (currentDay === 'Sunday') {
      freeRoomsLine = '🕒 College Closed Today (Sunday)';
    } else if (currentMinutes >= 13 * 60 + 30 && currentMinutes < 14 * 60) {
      freeRoomsLine = '🥪 Lunch Recess: All 96 Classrooms Free Right Now!';
    } else {
      const periods = [
        { start: 8 * 60 + 30, end: 9 * 60 + 30, slot: '8:30 AM to 9:30 AM' },
        { start: 9 * 60 + 30, end: 10 * 60 + 30, slot: '9:30 AM to 10:30 AM' },
        { start: 10 * 60 + 30, end: 11 * 60 + 30, slot: '10:30 AM to 11:30 AM' },
        { start: 11 * 60 + 30, end: 12 * 60 + 30, slot: '11:30 AM to 12:30 PM' },
        { start: 12 * 60 + 30, end: 13 * 60 + 30, slot: '12:30 PM to 1:30 PM' },
        { start: 14 * 60, end: 15 * 60, slot: '2:00 PM to 3:00 PM' },
        { start: 15 * 60, end: 16 * 60, slot: '3:00 PM to 4:00 PM' },
        { start: 16 * 60, end: 17 * 60, slot: '4:00 PM to 5:00 PM' },
        { start: 17 * 60, end: 18 * 60, slot: '5:00 PM to 6:00 PM' }
      ];
      const matchedP = periods.find(p => currentMinutes >= p.start && currentMinutes < p.end);
      if (matchedP) {
        try {
          const dataResp = await caches.match(LOCAL_DATA_URL).then(r => r || fetch(LOCAL_DATA_URL));
          if (dataResp && dataResp.ok) {
            const dataJson = await dataResp.json();
            if (dataJson && Array.isArray(dataJson.rooms)) {
              freeRoomsCount = dataJson.rooms.filter(r => {
                const s = r.schedule && r.schedule[currentDay];
                return s && s.free_slots && s.free_slots.includes(matchedP.slot);
              }).length;
            }
          }
        } catch (e) {}
        freeRoomsLine = freeRoomsCount > 0
          ? `⚡ ${freeRoomsCount} Classrooms Free Right Now for GD & Study!`
          : `⚡ Check live vacant classrooms for study!`;
      } else {
        freeRoomsLine = '🕒 College Off-Hours.';
      }
    }

    // 5. Build Combined Body Text
    let bodyText = '';
    if (count === 1) {
      bodyText = `Prof. ${uniqueLeaves[0].teacher_name} is marked on leave today.\n${freeRoomsLine}`;
    } else if (count > 1) {
      const topNames = uniqueLeaves.slice(0, 3).map(l => l.teacher_name).join(', ');
      bodyText = `${count} professors on leave today (${topNames}${count > 3 ? '...' : ''}).\n${freeRoomsLine}`;
    } else {
      bodyText = `All professors present today.\n${freeRoomsLine}`;
    }

    // Record timestamp in cache to maintain 1-hour interval
    await cache.put('/__srcc_sw_last_hourly_time', new Response(String(Date.now())));

    // 6. Fire Notification on Screen / Lock Screen
    const baseOrigin = self.location.origin;
    const basePath = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);
    const iconUrl = new URL(basePath + 'srcc_crest.png', baseOrigin).href;
    const badgeUrl = new URL(basePath + 'favicon.png', baseOrigin).href;

    await self.registration.showNotification('SRCC Live Campus Update 🔔', {
      body: bodyText,
      icon: iconUrl,
      badge: badgeUrl,
      tag: 'srcc-campus-hourly-update',
      renotify: true,
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: false,
      data: {
        url: basePath + 'index.html?view=leaves'
      }
    });
  } catch (err) {
    console.warn('[SW Hourly Alert Note]', err);
  }
}

// --- Periodic Background Sync (Runs every 1 hour in background) ---
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'srcc-check-leaves' || event.tag === 'check-faculty-leaves') {
    event.waitUntil(checkLeavesAndNotifyInBackground(false));
  }
});

// --- Standard Background Sync ---
self.addEventListener('sync', (event) => {
  if (event.tag === 'srcc-check-leaves-sync' || event.tag === 'check-faculty-leaves') {
    event.waitUntil(checkLeavesAndNotifyInBackground(false));
  }
});

// --- Push Event ---
self.addEventListener('push', (event) => {
  event.waitUntil(checkLeavesAndNotifyInBackground(true));
});

// --- Notification Click ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html?view=leaves';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// --- Message Event (Handles broadcast from admin portal & test requests) ---
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data === 'BROADCAST_LEAVES_ALERT' || event.data.type === 'BROADCAST_LEAVES_ALERT' || event.data.type === 'CHECK_LEAVES') {
    event.waitUntil(checkLeavesAndNotifyInBackground(true));
  }

  if (event.data.type === 'TEST_NOTIFICATION') {
    const basePath = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);
    event.waitUntil(
      self.registration.showNotification('SRCC Live Campus Update 🔔 (Test)', {
        body: '✅ Live Alerts Active! You will receive hourly updates with absent faculty & free classrooms.',
        icon: new URL(basePath + 'srcc_crest.png', self.location.origin).href,
        badge: new URL(basePath + 'favicon.png', self.location.origin).href,
        tag: 'srcc-test-alert',
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
          url: basePath + 'index.html?view=leaves'
        }
      })
    );
  }
});
