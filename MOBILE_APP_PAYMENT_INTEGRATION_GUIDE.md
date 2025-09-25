# Mobile App Payment Integration Guide

## Overview
This guide explains how to integrate Razorpay payments in your webapp that's being converted to an Android app using platforms like appxyz.

## Problem Solved
The "invalid callback URL" error occurs when converting webapps to mobile apps because:
1. Mobile apps use different URL schemes
2. WebView environments handle redirects differently
3. Callback URLs need to be configured for both web and mobile environments

## Changes Made

### 1. Enhanced Platform Detection
The PaymentButton component now detects:
- Android WebView environments
- appxyz platform usage
- Regular web browsers

```typescript
const isAndroid = /Android/i.test(ua);
const isWebView = /(wv|WebView|; wv\))/i.test(ua);
const isAppxyz = /appxyz/i.test(ua) || window.location?.hostname?.includes('appxyz');
```

### 2. Dynamic Callback URL Configuration
- **Web App**: Uses current origin for callbacks
- **Mobile App**: Uses the original webapp URL (`NEXT_PUBLIC_BASE_URL`)
- **WebView**: Uses redirect flow instead of popup

### 3. Mobile-Friendly Payment Verification
The `/api/payment/verify` endpoint now:
- Returns HTML pages instead of JSON for mobile apps
- Includes JavaScript to communicate with parent windows
- Auto-closes payment windows after success/failure
- Provides user-friendly error messages

### 4. Message Handling
Added message listeners to handle communication between:
- Payment verification pages and parent windows
- Mobile app WebView and main app

## Environment Variables Required

```env
# Base URL for your webapp (used for mobile app callbacks)
NEXT_PUBLIC_BASE_URL=https://projects-user-app.vercel.app
NEXT_PUBLIC_SITE_URL=https://projects-user-app.vercel.app

# Razorpay Configuration
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_RJTmoYCxPGvgYd
RAZORPAY_KEY_ID=rzp_test_RJTmoYCxPGvgYd
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

## How It Works

### Web App Flow
1. User clicks "Pay" button
2. Razorpay popup opens
3. Payment completed → handler function called
4. Payment verified and file status updated

### Mobile App Flow (appxyz)
1. User clicks "Pay" button
2. Platform detection identifies mobile environment
3. Redirect flow used instead of popup
4. User redirected to Razorpay payment page
5. After payment → redirected to verification page
6. Verification page shows success/error message
7. JavaScript communicates result back to app
8. Payment window closes automatically

## Testing

### Web App Testing
1. Open your webapp in a browser
2. Try making a payment
3. Verify popup works correctly
4. Check payment verification

### Mobile App Testing
1. Convert your webapp using appxyz platform
2. Install the generated Android app
3. Try making a payment
4. Verify redirect flow works
5. Check that payment windows close properly

## Troubleshooting

### Common Issues

1. **"Invalid callback URL" Error**
   - Ensure `NEXT_PUBLIC_BASE_URL` is set correctly
   - Check that the URL is accessible from mobile devices
   - Verify Razorpay dashboard has the correct callback URLs

2. **Payment Window Doesn't Close**
   - Check browser console for JavaScript errors
   - Ensure message handling is working
   - Verify the verification page loads correctly

3. **Payment Not Verified**
   - Check Razorpay webhook configuration
   - Verify signature validation
   - Check server logs for errors

### Debug Mode
Set `NODE_ENV=development` to see detailed console logs for debugging.

## Razorpay Dashboard Configuration

In your Razorpay dashboard, ensure these URLs are whitelisted:
- `https://projects-user-app.vercel.app/api/payment/verify`
- Any other callback URLs your app uses

## Security Considerations

1. **Signature Verification**: Always verify Razorpay signatures
2. **HTTPS**: Use HTTPS for all callback URLs
3. **Environment Variables**: Keep sensitive keys secure
4. **Webhook Security**: Use webhook secrets for additional security

## Additional Features

### Auto-Close Payment Windows
Payment verification pages automatically close after 3 seconds on success.

### Error Handling
Comprehensive error handling for:
- Network issues
- Payment failures
- Verification errors
- Missing data

### User Experience
- Mobile-friendly error pages
- Clear success/failure messages
- Automatic window management

## Support

If you encounter issues:
1. Check the browser/app console for errors
2. Verify environment variables are set correctly
3. Test with Razorpay test mode first
4. Check Razorpay dashboard for callback URL configuration

## Future Enhancements

Consider implementing:
1. Webhook-based payment verification for better reliability
2. Payment retry mechanisms
3. Offline payment status checking
4. Enhanced mobile app integration features
