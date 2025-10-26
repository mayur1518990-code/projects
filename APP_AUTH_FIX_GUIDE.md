# App Authentication Fix Guide

## Problem
When your website is converted to an app (like through Appilix), Google OAuth authentication doesn't work properly in the webview context. Instead of showing existing Gmail accounts, it shows the "create Gmail account or login to existing one" UI.

## Root Cause
- **Webview Context**: Apps run in webview environments which handle popups differently than regular browsers
- **Popup Authentication**: `signInWithPopup()` doesn't work reliably in webview contexts
- **Authentication Flow**: The first time shows "create account" flow, second time shows existing accounts due to cached state

## Solution Implemented

### 1. Changed from Popup to Redirect Authentication
- **Before**: Used `signInWithPopup()` which doesn't work in webview
- **After**: Used `signInWithRedirect()` which works better in app contexts

### 2. Added Redirect Result Handling
- Added `useEffect` hooks to handle authentication results after redirect
- Properly manages user data creation and storage
- Handles both new and existing users

### 3. Updated Error Handling
- Removed popup-specific error codes
- Added app-context appropriate error messages
- Better user experience for app environment

## Files Modified

### `apps/user-app/src/app/login/page.tsx`
- Added `signInWithRedirect` and `getRedirectResult` imports
- Added `useEffect` for handling redirect results
- Updated `handleGoogleSignIn` to use redirect instead of popup
- Improved error handling for app context

### `apps/user-app/src/app/signup/page.tsx`
- Added `signInWithRedirect` and `getRedirectResult` imports
- Added `useEffect` for handling redirect results
- Updated `handleGoogleSignUp` to use redirect instead of popup
- Improved error handling for app context

## Key Changes Made

### 1. Import Updates
```typescript
// Added these imports
import { signInWithRedirect, getRedirectResult } from "firebase/auth";
import { useEffect } from "react";
```

### 2. Redirect Result Handler
```typescript
useEffect(() => {
  const handleRedirectResult = async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        const user = result.user;
        // Handle user creation/login logic
        // Store user data and redirect to home
      }
    } catch (error) {
      console.error('Redirect result error:', error);
      setError('Authentication failed. Please try again.');
    }
  };
  
  handleRedirectResult();
}, []);
```

### 3. Updated Google Auth Function
```typescript
const handleGoogleSignIn = async () => {
  try {
    setIsLoading(true);
    setError("");
    
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    
    // App/webview compatibility parameters
    provider.setCustomParameters({
      prompt: 'select_account',
      include_granted_scopes: 'true'
    });
    
    // Use redirect instead of popup
    await signInWithRedirect(auth, provider);
  } catch (error) {
    // Handle errors appropriately
  }
};
```

## Additional Configuration Needed

### 1. Firebase Console Settings
Make sure your Firebase project has the correct authorized domains:
- Go to Firebase Console → Authentication → Settings
- Add your app domain to authorized domains
- Ensure Google provider is enabled

### 2. Google Cloud Console Settings
- Go to Google Cloud Console → APIs & Services → Credentials
- Update OAuth 2.0 Client ID settings
- Add your app domain to authorized redirect URIs:
  - `https://yourdomain.com/api/auth/callback/google`
  - `https://yourappdomain.com/api/auth/callback/google`

### 3. Environment Variables
Ensure your `.env.local` has proper Firebase configuration:
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_actual_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_actual_app_id
```

## How It Works Now

1. **User clicks Google Sign In**: Triggers redirect to Google OAuth
2. **Google OAuth Flow**: User sees account selection (existing accounts should now appear)
3. **Redirect Back**: User is redirected back to your app
4. **Result Handling**: `useEffect` catches the redirect result and processes authentication
5. **User Data**: Creates or retrieves user data from Firestore
6. **Redirect to Home**: User is redirected to the main app

## Testing

1. **In Browser**: Should work as before
2. **In App/Webview**: Should now show existing Gmail accounts on first attempt
3. **Error Handling**: Better error messages for app context

## Benefits

- ✅ Works in webview/app contexts
- ✅ Shows existing Gmail accounts on first attempt
- ✅ Better error handling
- ✅ Maintains existing functionality in browsers
- ✅ No breaking changes to existing code

## Troubleshooting

If you still have issues:

1. **Check Firebase Console**: Ensure authorized domains are correct
2. **Check Google Cloud Console**: Verify OAuth settings
3. **Clear App Cache**: Clear app data and try again
4. **Check Environment Variables**: Ensure all Firebase config is correct
5. **Test in Different Browsers**: Verify it works in regular browsers first

The authentication should now work properly in your app context and show existing Gmail accounts on the first attempt.
