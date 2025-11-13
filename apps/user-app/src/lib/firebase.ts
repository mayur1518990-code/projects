import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
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
let auth: Auth;
let db: Firestore;

try {
  // Use existing app if available to prevent multiple initializations
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    app = initializeApp(firebaseConfig);
  }
  
  // Initialize services with performance optimizations
  auth = getAuth(app);
  db = getFirestore(app);
  
  // Configure Firebase for better performance
  if (typeof window !== 'undefined') {
    // Enable persistence for better offline experience
    import('firebase/auth').then(({ setPersistence, browserLocalPersistence }) => {
      setPersistence(auth, browserLocalPersistence).catch(error => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to set auth persistence:', error);
        }
      });
    });
    
    // Connect to emulators in development (simplified)
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
      try {
        connectAuthEmulator(auth, 'http://localhost:9099');
        connectFirestoreEmulator(db, 'localhost', 8080);
      } catch (error) {
        // Emulators already connected or not available
        if (process.env.NODE_ENV === 'development') {
          console.warn('Firebase emulators not available or already connected');
        }
      }
    }
  }
} catch (error) {
  console.error('Firebase initialization failed:', error);
  throw error;
}

// Export services
export { auth, db };
export default app;
