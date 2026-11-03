/**
 * SRCC Room Finder - Firebase Client Configuration
 * Safe public configuration for Firebase Authentication & Realtime Database client SDK.
 */
window.SRCC_FIREBASE_CONFIG = {
  apiKey: window.__FIREBASE_API_KEY || "", // Can also be injected via Netlify snippet or config
  authDomain: "srcc-leaves-default-rtdb.firebaseapp.com",
  databaseURL: "https://srcc-leaves-default-rtdb.firebaseio.com",
  projectId: "srcc-leaves-default-rtdb",
  storageBucket: "srcc-leaves-default-rtdb.appspot.com",
  messagingSenderId: "",
  appId: ""
};
