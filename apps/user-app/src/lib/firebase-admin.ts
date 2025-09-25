import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Normalize and parse the private key from env (handle escaped newlines from Vercel)
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY ?? '';
const normalizedPrivateKey = rawPrivateKey
  .replace(/^"|"$/g, '')
  .replace(/\\n/g, '\n');

const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizedPrivateKey,
  }),
};

// Initialize Firebase Admin
const adminApp = getApps().length === 0 ? initializeApp(firebaseAdminConfig) : getApps()[0];

// Initialize Firebase Admin services
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

export default adminApp;
