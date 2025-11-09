# WebView Download Fix

## Problem
When the website was converted to an Android app using WebView (via median.co platform), clicking download buttons would:
- Open Chrome browser instead of downloading in-app
- Show "Open in Chrome" popup
- Display XML error pages for B2 pre-signed URLs

## Solution
Modified the download functionality to detect WebView environments and use direct file streaming with blob downloads instead of redirecting to pre-signed URLs.

## Changes Made

### 1. Created Download Utility (`apps/user-app/src/lib/downloadUtils.ts`)
- **`isWebView()`**: Detects if the app is running in a WebView (Android/iOS)
- **`downloadFileWithProgress()`**: Downloads files using fetch API and creates blob URLs for WebView compatibility
- **`downloadFileAsBlob()`**: Alternative blob download method

### 2. Updated Files Page (`apps/user-app/src/app/files/page.tsx`)
- Modified `downloadCompletedFile()` function to:
  - Detect WebView environment
  - Use direct download endpoint (`/api/files/completed/[id]/download?direct=true`) for WebView
  - Use pre-signed URLs for regular browsers (faster, no server load)

### 3. Updated View Page (`apps/user-app/src/app/files/view/[id]/page.tsx`)
- Added `handleDownload()` function for WebView-compatible downloads
- Replaced all `<a>` download links with buttons that use the handler
- Handles both completed files and original file downloads

### 4. Updated AgentResponse Component (`apps/user-app/src/components/AgentResponse.tsx`)
- Added WebView detection and blob download handling
- Downloads agent response files directly in WebView instead of opening in browser

## How It Works

### For WebView (Android App):
1. Detects WebView using user agent patterns
2. Uses direct download endpoint that streams file through server
3. Creates blob from response
4. Triggers download using temporary anchor element
5. File downloads directly to device Downloads folder

### For Regular Browsers:
1. Uses pre-signed B2 URLs (faster, no server load)
2. Redirects to URL using `window.location.href`
3. Browser handles download natively

## Technical Details

### WebView Detection
The app detects WebView using these patterns:
- `/wv/i` - Android WebView
- `/WebView/i` - Generic WebView
- `/; wv\)/i` - Android WebView pattern

### Direct Download Endpoint
When `direct=true` parameter is used:
- Server streams file directly from B2 storage
- Returns file with `Content-Disposition: attachment` header
- Uses `application/octet-stream` MIME type to force download
- Properly encodes filename using RFC 5987

### Blob Download Process
1. Fetch file from direct download endpoint
2. Read response as blob
3. Create blob URL using `URL.createObjectURL()`
4. Create temporary `<a>` element with `download` attribute
5. Programmatically click the link
6. Clean up blob URL after download

## Testing

### Test in WebView:
1. Build Android app using median.co
2. Click any "Download Completed" button
3. File should download directly without opening Chrome
4. Check Downloads folder on device

### Test in Browser:
1. Open website in Chrome/Firefox
2. Click download button
3. Should use pre-signed URL (faster method)
4. File downloads normally

## Benefits

1. **No External Browser**: Downloads stay within the app
2. **Better UX**: No "Open in Chrome" popups
3. **Reliable**: Works with all file types (PDF, images, DOC, etc.)
4. **Backward Compatible**: Regular browsers still use optimized pre-signed URLs
5. **Error Handling**: Proper error messages if download fails

## Notes

- The direct download method uses more server resources (streams through server)
- This is acceptable for WebView apps as they have fewer concurrent users
- Regular browsers continue to use the optimized pre-signed URL method
- All file types are supported (PDF, images, documents, etc.)

## Future Improvements

- Add download progress indicator for large files
- Add download notification when complete
- Cache downloaded files locally in app storage
- Add retry mechanism for failed downloads

