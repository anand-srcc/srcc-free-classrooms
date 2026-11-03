const { getFirebaseAdmin } = require('./init_firebase_admin');

/**
 * Netlify Function: Manage Admin Custom Claims
 * 
 * Securely assigns or checks { admin: true } custom claim on a Firebase User.
 * 
 * Authorization:
 * - Bootstrapping: Requires Header 'x-setup-secret' matching process.env.SETUP_ADMIN_SECRET
 * - Runtime Admin: Requires Header 'Authorization: Bearer <ID_TOKEN>' where caller already has admin: true
 */
exports.handler = async (event) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-setup-secret',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const admin = getFirebaseAdmin();

  try {
    let authorized = false;
    let authMethod = '';

    // Check 1: One-time bootstrap secret from Netlify Environment Variable
    const setupSecret = process.env.SETUP_ADMIN_SECRET;
    const providedSecret = event.headers['x-setup-secret'] || '';
    if (setupSecret && providedSecret && setupSecret === providedSecret) {
      authorized = true;
      authMethod = 'bootstrap_secret';
    }

    // Check 2: Existing verified admin ID token
    if (!authorized) {
      const authHeader = event.headers['authorization'] || '';
      const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (idToken) {
        try {
          const decoded = await admin.auth().verifyIdToken(idToken);
          if (decoded && decoded.admin === true) {
            authorized = true;
            authMethod = 'existing_admin';
          }
        } catch (authErr) {
          console.warn('[Claim Auth Token Error]', authErr.message);
        }
      }
    }

    if (!authorized) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'Unauthorized: Valid admin token or SETUP_ADMIN_SECRET required to assign custom claims.'
        })
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const targetEmail = (body.email || '').trim().toLowerCase();
    const targetUid = (body.uid || '').trim();

    if (!targetEmail && !targetUid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing target email or uid.' })
      };
    }

    let userRecord = null;
    if (targetUid) {
      userRecord = await admin.auth().getUser(targetUid);
    } else {
      userRecord = await admin.auth().getUserByEmail(targetEmail);
    }

    if (!userRecord) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `User with specified credentials not found in Firebase Authentication.` })
      };
    }

    // Assign { admin: true } Custom Claim
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      admin: true,
      role: 'administrator',
      assignedAt: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Admin claim successfully assigned to ${userRecord.email} (UID: ${userRecord.uid})`,
        authMethod
      })
    };
  } catch (err) {
    console.error('[Admin Claim Error]', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error processing admin claim: ' + err.message })
    };
  }
};

