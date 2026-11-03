const admin = require('firebase-admin');

let isInitialized = false;

function getFirebaseAdmin() {
  if (isInitialized || admin.apps.length > 0) {
    return admin;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'srcc-leaves-default-rtdb';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://srcc-leaves-default-rtdb.firebaseio.com';

  if (privateKey) {
    // Correctly replace escaped newlines from Netlify environment variables
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      }),
      databaseURL
    });
    isInitialized = true;
  } else {
    // Fallback to default application credentials if running in local emulator or GCP environment
    admin.initializeApp({
      projectId,
      databaseURL
    });
    isInitialized = true;
  }

  return admin;
}

module.exports = { getFirebaseAdmin };
