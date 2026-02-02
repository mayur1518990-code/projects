import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if config is valid
const isConfigValid = Object.values(firebaseConfig).every(value => value && value !== 'undefined');

if (!isConfigValid) {
  console.warn('Firebase configuration is incomplete. Some features may not work properly.');
}

// Initialize Firebase with error handling and performance optimizations
let app: FirebaseApp;
let db: Firestore;

try {
  // Use existing app if available to prevent multiple initializations
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    app = initializeApp(firebaseConfig);
  }

  db = getFirestore(app);

  // Connect to Firestore emulator in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Firestore emulator not available or already connected');
      }
    }
  }
} catch (error) {
  console.error('Firebase initialization failed:', error);
  throw error;
}

// Export services (Firestore only; auth is name+phone via API + localStorage)
export { db };
export default app;
