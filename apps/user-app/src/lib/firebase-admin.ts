import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || '';
// Handle common env formatting issues: quotes around key and escaped newlines
const privateKey = rawPrivateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
};

// Initialize Firebase Admin
const adminApp = getApps().length === 0 ? initializeApp(firebaseAdminConfig) : getApps()[0];

// Initialize Firebase Admin services
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

export default adminApp;
