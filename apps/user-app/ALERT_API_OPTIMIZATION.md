# Alert API Request Optimization - Cross-Tab Caching

## Date: November 7, 2025

## Problem Statement

The alert fetching system was making **excessive API requests**:

### Before Optimization:
- **Every page** made requests every 45 seconds
- **Every tab** made independent requests
- **No coordination** between tabs

### Example Scenario:
```
User has 3 tabs open (Home, Upload, Files):
- Tab 1: 80 requests/hour
- Tab 2: 80 requests/hour  
- Tab 3: 80 requests/hour
= 240 requests/hour total! 😱

Over 24 hours: 5,760 requests per user
```

Each request takes 700-1100ms, causing:
- ❌ High server load
- ❌ Increased Firestore reads
- ❌ Poor performance
- ❌ Unnecessary network traffic

---

## Solution: Cross-Tab Caching with localStorage

### New Architecture:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Tab 1     │     │   Tab 2     │     │   Tab 3     │
│  (Home)     │     │  (Upload)   │     │  (Files)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  Checks cache     │  Checks cache     │  Checks cache
       │  in localStorage  │  in localStorage  │  in localStorage
       │         ▼         │         ▼         │         ▼
       └─────────┴─────────┴─────────┴─────────┴─────────┘
                           │
                    localStorage
                  (Shared cache)
                           │
               Only ONE tab fetches
                           │
                     ┌─────▼─────┐
                     │   API     │
                     │ /alerts   │
                     └───────────┘
```

### Key Features:

#### 1. **Shared Cache via localStorage**
- All tabs share the same alert data
- Cache expires after 2 minutes
- Automatic synchronization across tabs

#### 2. **Fetch Lock Mechanism**
- Only ONE tab fetches at a time
- Other tabs wait for the result
- Prevents duplicate requests

#### 3. **Storage Events for Sync**
- When one tab updates cache, others get notified
- Instant sync without polling
- Zero redundant API calls

#### 4. **Longer Refresh Interval**
- Changed from 45 seconds → **2 minutes**
- Still catches admin changes quickly
- Much lower server load

---

## Implementation Details

### New File: `src/lib/alertCache.ts`

```typescript
// Main functions:
- getCachedAlerts()      // Read from localStorage
- setCachedAlerts()      // Write to localStorage
- acquireFetchLock()     // Coordinate fetch across tabs
- releaseFetchLock()     // Release coordination lock
- setupAlertSync()       // Listen for updates from other tabs
```

### Updated Pages:
1. `src/app/page.tsx` (Home)
2. `src/app/upload/page.tsx` (Upload)

Both now use the shared cache system.

---

## Performance Improvements

### Request Reduction:

| Scenario | Before | After | Reduction |
|----------|--------|-------|-----------|
| **1 tab open** | 80 req/hr | 30 req/hr | **62% fewer** |
| **3 tabs open** | 240 req/hr | 30 req/hr | **87% fewer** |
| **5 tabs open** | 400 req/hr | 30 req/hr | **92% fewer** |

### 24-Hour Comparison:

| Tabs | Before | After | Savings |
|------|--------|-------|---------|
| 1 tab | 1,920 requests | 720 requests | **1,200 saved** |
| 3 tabs | 5,760 requests | 720 requests | **5,040 saved** |
| 5 tabs | 9,600 requests | 720 requests | **8,880 saved** |

### Benefits:

✅ **87-92% fewer API requests** (multiple tabs)  
✅ **Instant alert sync across tabs** (storage events)  
✅ **Zero duplicate fetches** (fetch lock)  
✅ **Lower server load** (1 request instead of N)  
✅ **Reduced Firestore costs** (fewer reads)  
✅ **Better performance** (cached reads are instant)  

---

## How It Works

### Scenario: User Has 3 Tabs Open

#### Initial Page Load:
```
1. Tab 1 loads
   - Checks cache → empty
   - Acquires fetch lock
   - Fetches from API
   - Saves to localStorage
   - Shows alerts

2. Tab 2 loads (2 seconds later)
   - Checks cache → found!
   - Uses cached data
   - No API call needed ✅

3. Tab 3 loads (5 seconds later)
   - Checks cache → found!
   - Uses cached data
   - No API call needed ✅
```

#### Every 2 Minutes:
```
1. All tabs check if cache expired
2. One tab acquires lock → fetches
3. Other tabs wait
4. Lock holder saves to cache
5. Storage event fires → all tabs update ✅
```

#### Admin Deletes Alert:
```
1. Server cache expires (30 seconds)
2. Next fetch gets fresh data
3. One tab fetches (within 2 minutes)
4. Updates localStorage cache
5. Storage event → all tabs sync instantly ✅
```

---

## Technical Details

### Cache Structure:
```typescript
{
  alerts: [
    { id: "...", message: "...", type: "info", createdAt: "..." },
    // ...
  ],
  timestamp: 1762495343174,  // When cached
  tabId: "tab_1762495343_abc123"  // Which tab cached it
}
```

### Fetch Lock Structure:
```typescript
{
  tabId: "tab_1762495343_abc123",
  timestamp: 1762495343174
}
```

### Storage Event Flow:
```
Tab 1 updates cache
    ↓
localStorage.setItem('app_alerts_cache', data)
    ↓
storage event fires
    ↓
Tab 2 receives event
    ↓
Tab 2 updates state
    ↓
All tabs show same data ✅
```

---

## Configuration

### Timing Constants:
```javascript
CACHE_DURATION = 2 * 60 * 1000      // 2 minutes
REFRESH_INTERVAL = 2 * 60 * 1000    // 2 minutes
FETCH_COOLDOWN = 1000               // 1 second
```

### Server Cache:
```javascript
API Cache = 30 seconds
HTTP Cache-Control = 30 seconds
```

---

## Testing

### Test Scenarios:

1. **Single Tab**
   - ✅ Fetches on load
   - ✅ Refreshes every 2 minutes
   - ✅ Uses cache between refreshes

2. **Multiple Tabs**
   - ✅ First tab fetches
   - ✅ Other tabs use cache
   - ✅ All tabs sync instantly
   - ✅ Only one refresh per 2 minutes

3. **Admin Deletes Alert**
   - ✅ Server cache expires (30s)
   - ✅ Next fetch gets fresh data
   - ✅ All tabs update within 2 minutes

4. **Network Offline**
   - ✅ Uses cached data
   - ✅ Fails gracefully
   - ✅ Retries on next interval

---

## Browser Compatibility

✅ **localStorage** - All modern browsers  
✅ **storage events** - All modern browsers  
✅ **async/await** - All modern browsers  
✅ **Dynamic imports** - All modern browsers  

Graceful degradation for older browsers.

---

## Monitoring

### What to Watch:
1. **API Request Count** - Should drop by 85%+
2. **Response Times** - Should be faster (less load)
3. **User Experience** - Alerts still update quickly
4. **Cache Hit Rate** - Should be 85%+ across tabs

### Expected Metrics:
```
Before: 80-240 requests/hour (per user)
After:  30 requests/hour (per user)
Improvement: 62-92% reduction ✅
```

---

## Troubleshooting

### If alerts don't update:
- Check localStorage quota (shouldn't be an issue)
- Check browser storage events (should work in all modern browsers)
- Check network tab for fetch errors

### If too many requests:
- Verify cache is being used (check localStorage)
- Verify fetch lock is working (only one tab fetches)
- Check console for errors

---

## Future Improvements

### Potential Enhancements:
1. **Service Worker** - Even better caching
2. **WebSocket** - Real-time updates (if needed)
3. **IndexedDB** - For larger datasets
4. **Push Notifications** - For critical alerts

Currently not needed - the localStorage solution works perfectly!

---

## Summary

### Results:
- 🎯 **87% fewer API requests** (multiple tabs)
- 🎯 **Instant cross-tab sync**
- 🎯 **Zero duplicate fetches**
- 🎯 **2-minute update latency** (acceptable)
- 🎯 **No breaking changes**

### Impact:
- ✅ Lower server costs
- ✅ Better performance
- ✅ Reduced Firestore reads
- ✅ Improved user experience

**From 240 requests/hour to 30 requests/hour - mission accomplished!** 🚀

