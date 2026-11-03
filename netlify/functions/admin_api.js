const { getFirebaseAdmin } = require('./init_firebase_admin');

/**
 * Netlify Function: Admin Protected Operations Gateway
 * 
 * Enforces zero-trust server-side authentication for all administrative mutations.
 * Requires Firebase ID Token with verified { admin: true } custom claim.
 */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Verify Admin Authorization
  const authHeader = event.headers['authorization'] || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!idToken) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized: Missing Firebase ID token.' })
    };
  }

  const admin = getFirebaseAdmin();
  let decodedToken = null;

  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (authErr) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized: Invalid or expired Firebase ID token. ' + authErr.message })
    };
  }

  if (!decodedToken || decodedToken.admin !== true) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Forbidden: User does not possess administrator custom claim.' })
    };
  }

  const db = admin.database();

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const action = body.action || event.queryStringParameters?.action || '';

    switch (action) {
      case 'verify_session': {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            user: {
              uid: decodedToken.uid,
              email: decodedToken.email,
              admin: true
            }
          })
        };
      }

      case 'update_leaves': {
        const leavesData = body.data;
        if (!leavesData || !Array.isArray(leavesData.leaves)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid leaves payload' }) };
        }
        await db.ref('leaves').set({
          last_updated: leavesData.last_updated || new Date().toISOString(),
          total_on_leave: leavesData.leaves.length,
          source: 'SRCC Admin Portal (Protected)',
          leaves: leavesData.leaves
        });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, count: leavesData.leaves.length }) };
      }

      case 'update_locks': {
        const locks = body.locks;
        if (!Array.isArray(locks)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid locks payload' }) };
        }
        await db.ref('room_locks').set(locks);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, count: locks.length }) };
      }

      case 'update_notices': {
        const notices = body.notices;
        if (!Array.isArray(notices)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid notices payload' }) };
        }
        await db.ref('campus_notices').set(notices);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, count: notices.length }) };
      }

      case 'update_maintenance': {
        const isEnabled = Boolean(body.enabled);
        const title = (body.title || 'Website Under Maintenance').trim();
        const message = (body.message || '').trim();

        await db.ref('maintenance').set({
          enabled: isEnabled,
          title,
          message,
          updatedAt: new Date().toISOString(),
          updatedBy: decodedToken.email || decodedToken.uid
        });

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, enabled: isEnabled }) };
      }

      case 'get_issues': {
        const snapshot = await db.ref('issues').once('value');
        const raw = snapshot.val() || {};
        const list = Object.entries(raw).map(([id, val]) => ({ id, ...val }));
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, issues: list }) };
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown administrative action: "${action}"` })
        };
    }
  } catch (opErr) {
    console.error('[Admin API Operation Error]', opErr);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Administrative operation failed: ' + opErr.message })
    };
  }
};
