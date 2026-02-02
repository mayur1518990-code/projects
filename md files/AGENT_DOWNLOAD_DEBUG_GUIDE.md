# Agent Download Debug Guide

## 🎯 Problem
The download button on the agent side is not working. This guide helps identify and fix the issue.

## 🔍 Debugging Steps

### Step 1: Check File Assignment
1. **Go to Agent Dashboard**: Navigate to `/agent` in the admin app
2. **Look for Assigned Files**: Check if files are showing with "assigned" status
3. **Click "Debug" Button**: Click the purple "Debug" button next to any file
4. **Check Debug Information**: Look for:
   - **Is Assigned**: Should be "Yes"
   - **File Content Exists**: Should be "Yes"
   - **Content Length**: Should be greater than 0

### Step 2: Test Download with Console Logs
1. **Open Browser Console**: Press F12 and go to Console tab
2. **Click Download Button**: Click the blue "Download" button
3. **Check Console Logs**: Look for these logs:
   ```
   [AGENT-DOWNLOAD] Attempting to download file {fileId} with name {filename}
   [AGENT-DOWNLOAD] Response status: {status}
   [AGENT-DOWNLOAD] Blob size: {size} bytes
   [AGENT-DOWNLOAD] Download completed successfully
   ```

### Step 3: Check Server Logs
1. **Check Terminal/Console**: Look for server-side logs:
   ```
   [AGENT-DOWNLOAD-API] File {fileId} - fileContent exists: true
   [AGENT-DOWNLOAD-API] File {fileId} - fileContent length: {length}
   ```

## 🐛 Common Issues & Solutions

### Issue 1: "File content not found in database"
**Symptoms**: 
- Debug shows "File Content Exists: No"
- Console shows "File content not found in database"

**Cause**: The file was uploaded but the `fileContent` field is missing from the database.

**Solution**: 
1. Check if the file upload process is properly storing `fileContent`
2. Verify the file was uploaded through the user app (not manually added)
3. Re-upload the file through the user app

### Issue 2: "File not assigned to you"
**Symptoms**:
- Debug shows "Is Assigned: No"
- Console shows "File not assigned to you"

**Cause**: The file is not properly assigned to the current agent.

**Solution**:
1. Check agent authentication
2. Verify the file assignment in admin panel
3. Ensure the agent ID matches between authentication and assignment

### Issue 3: "Unauthorized"
**Symptoms**:
- Console shows "Unauthorized" error
- Download button doesn't work

**Cause**: Agent authentication is failing.

**Solution**:
1. Check if agent is properly logged in
2. Verify agent token cookie exists
3. Re-login if necessary

### Issue 4: Download Starts But File is Corrupted
**Symptoms**:
- Download starts but file is empty or corrupted
- Console shows successful download but file size is 0

**Cause**: The `fileContent` field exists but is empty or invalid.

**Solution**:
1. Check if `fileContent` is properly base64 encoded
2. Verify the original file upload process
3. Re-upload the file through the user app

## 🔧 Manual Testing

### Test Download API Directly
```bash
# Test the download endpoint directly
curl -X GET "http://localhost:3000/api/agent/files/{fileId}/download" \
  -H "Cookie: agent-token=your_agent_token"
```

### Test Debug API
```bash
# Test the debug endpoint
curl -X GET "http://localhost:3000/api/agent/files/{fileId}/debug" \
  -H "Cookie: agent-token=your_agent_token"
```

## 📊 Expected Debug Output

### Successful File Debug
```json
{
  "fileId": "file_123",
  "agentId": "agent_456",
  "assignedAgentId": "agent_456",
  "isAssigned": true,
  "fileData": {
    "originalName": "document.pdf",
    "size": 1024000,
    "mimeType": "application/pdf",
    "status": "assigned"
  },
  "fileContentInfo": {
    "exists": true,
    "length": 1365333,
    "type": "string"
  }
}
```

### Failed File Debug
```json
{
  "fileId": "file_123",
  "agentId": "agent_456",
  "assignedAgentId": "agent_456",
  "isAssigned": true,
  "fileData": {
    "originalName": "document.pdf",
    "size": 1024000,
    "mimeType": "application/pdf",
    "status": "assigned"
  },
  "fileContentInfo": {
    "exists": false,
    "length": 0,
    "type": "undefined"
  }
}
```

## 🚀 Quick Fixes

### Fix 1: Re-upload File
If `fileContent` is missing:
1. Go to user app
2. Delete the problematic file
3. Re-upload the file
4. Make payment
5. Assign to agent
6. Test download

### Fix 2: Check Agent Authentication
If authentication is failing:
1. Logout from agent dashboard
2. Login again
3. Check if files are visible
4. Test download

### Fix 3: Verify File Assignment
If assignment is wrong:
1. Go to admin panel
2. Check file assignment
3. Re-assign to correct agent
4. Test download

## 📝 Database Verification

### Check File Document
```javascript
// In Firestore console
db.collection('files').doc('file_id').get()
// Should show: fileContent: 'base64_string', assignedAgentId: 'agent_id'
```

### Check Agent Document
```javascript
// In Firestore console
db.collection('agents').doc('agent_id').get()
// Should show: isActive: true, name: 'Agent Name'
```

## ✅ Success Indicators

The download functionality is working when:

1. **Debug Shows**: "File Content Exists: Yes" and "Is Assigned: Yes"
2. **Console Logs**: Show successful download with blob size > 0
3. **File Download**: Actually downloads the file to your computer
4. **File Integrity**: Downloaded file opens correctly and matches original

## 🔄 Testing Workflow

1. **Upload File**: User uploads file and makes payment
2. **Assign File**: Admin assigns file to agent
3. **Debug File**: Agent clicks "Debug" button to check file status
4. **Test Download**: Agent clicks "Download" button
5. **Verify Download**: Check if file downloads correctly
6. **Check Console**: Look for any error messages

## 🆘 If Still Not Working

If the download still doesn't work after following this guide:

1. **Check Browser Console**: Look for any JavaScript errors
2. **Check Network Tab**: See if the API request is being made
3. **Check Server Logs**: Look for server-side errors
4. **Test with Different File**: Try with a different file
5. **Test with Different Agent**: Try with a different agent account

The debug tools should help identify exactly where the issue is occurring!
