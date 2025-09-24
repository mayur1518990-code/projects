# Firebase Authentication Setup Guide

## Prerequisites
1. A Google account
2. Access to Google Cloud Console
3. A Firebase project

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name (e.g., "your-app-name")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Google" provider:
   - Click on "Google"
   - Toggle "Enable"
   - Add your project support email
   - Click "Save"

## Step 3: Configure Web App

1. In Firebase Console, click the web icon (`</>`) to add a web app
2. Enter app nickname (e.g., "user-app")
3. Check "Also set up Firebase Hosting" if needed
4. Click "Register app"
5. Copy the Firebase configuration object

## Step 4: Update Environment Variables

Update your `env.local` file with the Firebase configuration:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
```

## Step 5: Configure Authorized Domains

1. In Firebase Console, go to "Authentication" > "Settings"
2. Scroll down to "Authorized domains"
3. Add your domains:
   - `localhost` (for development)
   - Your production domain (e.g., `yourdomain.com`)

## Step 6: Set Up Firestore Database

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location for your database
5. Click "Done"

## Step 7: Configure Security Rules (Optional)

For Firestore, you can set up basic security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /user/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Troubleshooting Common Issues

### 1. "auth/user-disabled" Error
- Check if the user account is disabled in Firebase Console
- Go to "Authentication" > "Users" and check user status
- Re-enable the user if needed

### 2. "Cross-Origin-Opener-Policy" Error
- This is fixed by the Next.js configuration we added
- Restart your development server after updating `next.config.ts`

### 3. "auth/unauthorized-domain" Error
- Add your domain to authorized domains in Firebase Console
- Make sure `localhost` is included for development

### 4. "auth/operation-not-allowed" Error
- Ensure Google sign-in is enabled in Firebase Console
- Check that the Google provider is properly configured

## Testing the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the login page
3. Try signing in with Google
4. Check the browser console for any errors
5. Verify that user data is created in Firestore

## Production Considerations

1. Update environment variables with production Firebase config
2. Set up proper Firestore security rules
3. Configure Firebase Hosting if needed
4. Set up monitoring and analytics
5. Test thoroughly before deploying

## Additional Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Firebase Web SDK](https://firebase.google.com/docs/web/setup)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
