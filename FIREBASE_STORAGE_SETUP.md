# Firebase Storage Setup Guide

## 🔧 Environment Variables Required

### Required Environment Variables

Add these to your `.env.local` files:

#### For Admin App (`apps/admin-app/.env.local`)
```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="your-private-key"

# Firebase Storage (Optional - will use default if not set)
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

#### For User App (`apps/user-app/.env.local`)
```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="your-private-key"

# Firebase Storage (Optional - will use default if not set)
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

## 🚀 How It Works

### Automatic Bucket Detection
The system now automatically detects the Firebase Storage bucket:

1. **Primary**: Uses `FIREBASE_STORAGE_BUCKET` environment variable if set
2. **Fallback**: Uses `${FIREBASE_PROJECT_ID}.appspot.com` as default bucket name
3. **Error Handling**: Provides clear error messages if bucket is not accessible

### Bucket Name Format
- **Default Format**: `{project-id}.appspot.com`
- **Custom Format**: Any valid Google Cloud Storage bucket name
- **Example**: `my-project-123.appspot.com`

## 🔍 Testing Storage Configuration

### Using Debug Page
1. Go to `/agent/debug`
2. Click "Test Storage Configuration"
3. Check the results for bucket accessibility

### Expected Results
```json
{
  "success": true,
  "storage": {
    "bucketName": "your-project-id.appspot.com",
    "accessible": true,
    "filesCount": 0,
    "message": "Storage is properly configured"
  }
}
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. "Bucket name not specified or invalid"
**Solution**: 
- Set `FIREBASE_STORAGE_BUCKET` environment variable
- Or ensure `FIREBASE_PROJECT_ID` is correctly set

#### 2. "Storage bucket not found"
**Solution**:
- Verify the bucket exists in Firebase Console
- Check that the service account has Storage Admin permissions
- Ensure the project ID is correct

#### 3. "Permission denied"
**Solution**:
- Verify service account has proper IAM roles:
  - `Storage Admin` or `Storage Object Admin`
  - `Firebase Admin SDK Administrator Service Agent`

### Firebase Console Setup
1. Go to Firebase Console → Storage
2. Enable Cloud Storage if not already enabled
3. Note the bucket name (usually `{project-id}.appspot.com`)
4. Set this as `FIREBASE_STORAGE_BUCKET` in your environment variables

## 📝 Service Account Permissions

Your Firebase service account needs these roles:
- `Firebase Admin SDK Administrator Service Agent`
- `Storage Admin` (or `Storage Object Admin`)
- `Firebase Authentication Admin`

## ✅ Verification Steps

1. **Check Environment Variables**:
   ```bash
   echo $FIREBASE_PROJECT_ID
   echo $FIREBASE_STORAGE_BUCKET
   ```

2. **Test Storage Access**:
   - Go to `/agent/debug`
   - Click "Test Storage Configuration"
   - Should show success with bucket name

3. **Test File Operations**:
   - Try downloading a file in agent dashboard
   - Try uploading a completed file
   - Both should work without errors

## 🔄 Next Steps

After setting up the environment variables:
1. Restart your development server
2. Test the storage configuration
3. Try downloading and uploading files
4. Check the debug page for any remaining issues

The system will now automatically use the correct Firebase Storage bucket for all file operations!

