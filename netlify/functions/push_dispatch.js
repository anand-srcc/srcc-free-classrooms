const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BJfmbvYuaQnKot04ZeKfaQrZBHgQVMubvYF02BZwLbT2TWqVEbRIJ8_A_vFsuGMNMMDQWYoObRw1gNfhA4_P-3w';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'qrlpGNpCe_mRfk7xlfB3IlUSVUSFdP9Kasqpp0L_uZM';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:anand.kumar.student@srcc.du.ac.in';

if (VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const FIREBASE_BASE = 'https://srcc-leaves-default-rtdb.firebaseio.com';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Security: Enforce admin secret authorization if ADMIN_DISPATCH_SECRET is set
  const expectedSecret = process.env.ADMIN_DISPATCH_SECRET || process.env.VAPID_PRIVATE_KEY;
  if (expectedSecret) {
    const authHeader = event.headers['authorization'] || event.headers['x-dispatch-secret'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token || token !== expectedSecret) {
      return {
        statusCode: 401,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Unauthorized: Valid dispatch secret required' })
      };
    }
  }

  try {
    let payload = {
      title: 'SRCC Live Campus Update 🔔',
      body: 'Check live free classrooms and faculty leaves.',
      url: './'
    };

    if (event.body) {
      try {
        const parsed = JSON.parse(event.body);
        if (parsed.title && typeof parsed.title === 'string') {
          payload.title = parsed.title.slice(0, 120);
        }
        if (parsed.body && typeof parsed.body === 'string') {
          payload.body = parsed.body.slice(0, 300);
        }
        if (parsed.url && typeof parsed.url === 'string') {
          // Strictly validate URL to relative path or official SRCC domain to prevent open-redirect phishing
          const targetUrl = parsed.url.trim();
          if (targetUrl.startsWith('./') || targetUrl.startsWith('/') || /^https:\/\/([a-zA-Z0-9-]+\.)*srcc\.du\.ac\.in(\/|$)/i.test(targetUrl)) {
            payload.url = targetUrl;
          }
        }
      } catch (e) {}
    }

    // 1. Also update broadcast_triggers/latest.json in Firebase
    try {
      await fetch(`${FIREBASE_BASE}/broadcast_triggers/latest.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: payload.title,
          body: payload.body,
          timestamp: Date.now()
        })
      });
    } catch (e) {}

    // 2. Fetch subscriptions from Firebase
    const res = await fetch(`${FIREBASE_BASE}/push_subscriptions.json`);
    const subsData = await res.json();
    if (!subsData) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, count: 0, message: 'No subscriptions found in database' })
      };
    }

    const subsList = Object.entries(subsData);
    let successCount = 0;
    const stringPayload = JSON.stringify(payload);

    await Promise.all(subsList.map(async ([subId, subRecord]) => {
      if (!subRecord || !subRecord.endpoint) return;
      const pushSubscription = {
        endpoint: subRecord.endpoint,
        keys: subRecord.keys
      };

      try {
        await webpush.sendNotification(pushSubscription, stringPayload);
        successCount++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          fetch(`${FIREBASE_BASE}/push_subscriptions/${subId}.json`, { method: 'DELETE' }).catch(() => {});
        }
      }
    }));

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, count: successCount, total: subsList.length })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
