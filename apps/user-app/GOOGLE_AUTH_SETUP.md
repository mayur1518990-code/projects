# Google OAuth Setup Instructions (Firebase Auth)

## Environment Variables Required

Create a `.env.local` file in the `apps/user-app` directory with the following variables:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google OAuth Configuration (for Firebase Auth)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Razorpay Configuration (already provided)
RAZORPAY_KEY_ID=rzp_test_RJTmoYCxPGvgYd
RAZORPAY_KEY_SECRET=o2nkihTLoehKOtBHNkq94LF4
```

## Firebase + Google OAuth Setup Steps

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Create a new project** or select an existing one
3. **Enable Authentication**:
   - Go to "Authentication" > "Sign-in method"
   - Enable "Google" provider
   - Add your domain to authorized domains
4. **Get Firebase Config**:
   - Go to "Project Settings" > "General"
   - Scroll down to "Your apps" section
   - Add a web app if not already added
   - Copy the Firebase config values
5. **Google Cloud Console Setup**:
   - Go to https://console.cloud.google.com/
   - Select your Firebase project
   - Go to "APIs & Services" > "Credentials"
   - Create OAuth 2.0 Client ID for web application
   - Add authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
6. **Copy the Client ID and Client Secret** to your `.env.local` file

## Installation

```bash
cd apps/user-app
npm install
```

## Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`
