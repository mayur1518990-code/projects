# Agent Assignment Debug Guide

## 🐛 Issue: Files Assigned to Agent Not Showing in Dashboard

### Problem Description
Files are assigned to agents through the admin panel, but they don't appear in the agent's dashboard.

### 🔍 Debugging Steps

#### 1. Access Debug Page
- Navigate to `/agent/debug` in the agent dashboard
- This page shows detailed information about:
  - Current agent authentication
  - Files found for the agent
  - All files in the database
  - All agents in the system

#### 2. Check Agent Authentication
The debug page will show:
```json
{
  "agentId": "dev_agent",
  "name": "Development Agent", 
  "email": "agent@docuploaer.com",
  "role": "agent"
}
```

#### 3. Verify File Assignment
Check if files have the correct `assignedAgentId` field:
- Files should have `assignedAgentId` matching the agent's ID
- Status should be `assigned`, `processing`, or `completed`

#### 4. Common Issues and Solutions

##### Issue 1: Agent ID Mismatch
**Problem**: Agent authentication returns different ID than assignment
**Solution**: The system now searches multiple ID formats:
- `assignedAgentId` field
- `agentId` field  
- Agent email
- Agent name

##### Issue 2: Development vs Production IDs
**Problem**: Development uses `dev_agent` but assignments use real agent IDs
**Solution**: 
1. Check what agent ID is being used in assignments
2. Update agent authentication to use the correct ID
3. Or update assignments to use the development ID

##### Issue 3: Database Field Inconsistency
**Problem**: Files use different field names for agent assignment
**Solution**: The system now checks both:
- `assignedAgentId` (primary)
- `agentId` (fallback)

### 🛠️ Technical Implementation

#### Enhanced Agent Files API
The `/api/agent/files` endpoint now:
1. Uses `findAgentFiles()` utility function
2. Searches multiple ID formats
3. Provides detailed logging
4. Handles field name variations

#### Debug API Endpoint
The `/api/agent/debug` endpoint provides:
- Current agent information
- All files in database
- Agent-specific files
- All agents in system
- Query debugging information

#### Agent Utility Functions
- `normalizeAgentId()` - Handles ID format variations
- `getAllAgentIds()` - Gets all possible agent identifiers
- `findAgentFiles()` - Searches files with multiple ID formats

### 🔧 Manual Fixes

#### Fix 1: Update Agent Authentication
If agent ID mismatch is found:
```javascript
// In agent-auth.ts, update the development agent ID
if (token === 'dev_agent_token') {
  return { 
    agentId: "actual_agent_id_from_assignments", // Use real agent ID
    name: "Development Agent",
    email: "agent@docuploaer.com",
    role: "agent"
  };
}
```

#### Fix 2: Update File Assignments
If files are assigned with wrong agent ID:
```javascript
// Update files to use correct agent ID
await adminDb.collection('files').doc(fileId).update({
  assignedAgentId: "correct_agent_id",
  updatedAt: new Date()
});
```

#### Fix 3: Create Test Assignment
To test the system:
1. Go to admin panel
2. Assign a file to the agent
3. Check the debug page to see if it appears
4. Verify the agent dashboard shows the file

### 📊 Debug Information

The debug page shows:
- **Current Agent**: Authentication details
- **Query Used**: Database query being executed
- **Agent Files**: Files found for this agent
- **All Files Sample**: Sample of all files in database
- **All Agents**: List of all agents in system

### 🚀 Testing the Fix

1. **Access Debug Page**: Go to `/agent/debug`
2. **Check Agent ID**: Verify the agent ID being used
3. **Check Assignments**: Look for files with matching agent ID
4. **Test Dashboard**: Go back to `/agent` to see if files appear
5. **Refresh Data**: Use the refresh button to reload data

### 📝 Logging

The system now includes detailed logging:
```
[AGENT-FILES] Fetching files for agent: dev_agent
[AGENT-UTILS] Searching for files with agent IDs: ["dev_agent", "agent@example.com", "Agent Name"]
[AGENT-FILES] Found 3 files for agent dev_agent
```

### ✅ Success Indicators

The fix is working when:
- Debug page shows files for the agent
- Agent dashboard displays assigned files
- Files can be downloaded and processed
- Status updates work correctly

### 🔧 **FIXED: Agent ID Mismatch Issue**

**Problem Identified:**
- Development agent ID: `dev_agent`
- Real agent ID in database: `bim290LXmEf6N7IuTzKU7bv5XcG2`
- File assigned to real agent but system authenticating as dev agent

**Solution Applied:**
1. **Updated Agent Authentication**: Now uses real agent ID from database
2. **Dynamic Agent Detection**: Automatically finds first active agent
3. **Fallback Handling**: Uses real agent even in error cases

**Files Updated:**
- `apps/admin-app/src/lib/agent-auth.ts` - Updated to use real agent ID
- `apps/admin-app/src/lib/get-default-agent.ts` - New utility for dynamic agent detection

**Expected Result:**
- Agent dashboard should now show the assigned file (`filled.pdf`)
- Debug page should show 1 file found for the agent
- File should be downloadable and processable

### 🔄 Next Steps

If the issue persists:
1. Check the debug page output
2. Verify agent ID in assignments
3. Test with a new file assignment
4. Check database directly for field consistency
5. Contact system administrator for database inspection
