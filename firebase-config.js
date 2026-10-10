/**
 * Firebase Configuration for Kompetenzen Mobile Phone OTP Authentication (SMS)
 */
const firebaseConfig = {
  apiKey: "AIzaSyD4oDxauCdymJ9iSYlFqSuQayyLubG4BRU",
  authDomain: "kompetenzen-9712d.firebaseapp.com",
  projectId: "kompetenzen-9712d",
  storageBucket: "kompetenzen-9712d.firebasestorage.app",
  messagingSenderId: "188973466421",
  appId: "1:188973466421:web:e29a2c71b77f7734d4027c",
  measurementId: "G-WCN31H3XVY"
};

// Initialize Firebase if the compat SDK is already on the page
if (typeof firebase !== 'undefined' && (!firebase.apps || !firebase.apps.length)) {
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (err) {
    console.warn('Firebase init warning:', err);
  }
}
