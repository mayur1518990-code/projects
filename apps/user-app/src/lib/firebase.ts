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

// Check if config is valid - all values must be present and not 'undefined'
const isConfigValid = Object.values(firebaseConfig).every(
  value => value && typeof value === 'string' && value.trim() !== '' && value !== 'undefined'
);

// Initialize Firebase with error handling and performance optimizations
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isConfigValid) {
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
        if (auth) {
          setPersistence(auth, browserLocalPersistence).catch(error => {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Failed to set auth persistence:', error);
            }
          });
        }
      });
      
      // Connect to emulators in development (simplified)
      if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
        try {
          if (auth && db) {
            connectAuthEmulator(auth, 'http://localhost:9099');
            connectFirestoreEmulator(db, 'localhost', 8080);
          }
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
    // Don't throw - allow app to continue without Firebase
    // Components should check if auth/db are null before using them
  }
} else {
  // Configuration is invalid - log warning but don't crash
  if (process.env.NODE_ENV === 'development') {
    console.warn('Firebase configuration is incomplete. Please set the following environment variables:');
    console.warn('- NEXT_PUBLIC_FIREBASE_API_KEY');
    console.warn('- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
    console.warn('- NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    console.warn('- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
    console.warn('- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
    console.warn('- NEXT_PUBLIC_FIREBASE_APP_ID');
  }
}

// Export services (may be null if config is invalid)
export { auth, db };
export default app;
