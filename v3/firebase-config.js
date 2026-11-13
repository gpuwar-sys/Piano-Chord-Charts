/*
 * Firebase settings for song sync (Chord Charts V3).
 * Paste the values from Firebase console → Project settings → Your apps → SDK setup and configuration → Config.
 * These values are not secret: Firebase security rules are what protect each person's songs.
 * Leave it as null to run without sync (the app then works exactly like V2).
 */
window.FIREBASE_CONFIG = null;
/* Example of what it looks like when filled in:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "chord-charts-xxxx.firebaseapp.com",
  projectId: "chord-charts-xxxx",
  storageBucket: "chord-charts-xxxx.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
*/
