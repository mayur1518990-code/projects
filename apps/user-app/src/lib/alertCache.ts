// Shared alert cache with cross-tab synchronization
// This ensures only ONE tab fetches alerts, and all tabs share the data

interface CachedAlerts {
  alerts: any[];
  timestamp: number;
  tabId: string;
  checksum?: string; // Store checksum to detect changes
}

const CACHE_KEY = 'app_alerts_cache';
const VERSION_KEY = 'app_alerts_version';
const LOCK_KEY = 'app_alerts_fetch_lock';
const POLLING_STATE_KEY = 'app_alerts_polling_state';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (only clears on page reload)
const FETCH_COOLDOWN = 500; // 500ms cooldown between fetches

// Adaptive polling intervals
// Target: 160 requests per 24 hours = 1 request every 9 minutes (540 seconds)
const INITIAL_INTERVAL = 540000; // 9 minutes = 540 seconds (base interval for 160 requests/day)
const FAST_INTERVAL = 30000; // 30 seconds fast polling when changes detected (quick detection)
const MAX_INTERVAL = 540000; // Max 9 minutes (same as initial - maintain 160/day limit)
const STABILITY_PERIOD = 120000; // After 2 minutes of no changes in fast mode, slow down
const CONSECUTIVE_NO_CHANGE_THRESHOLD = 4; // After 4 consecutive no-changes in fast mode (2 minutes), return to base

// Generate unique tab ID
let tabId: string | null = null;
if (typeof window !== 'undefined') {
  tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get cached alerts from localStorage
 * Returns null if cache is expired or invalid
 */
export function getCachedAlerts(): any[] | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedAlerts = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid (within 24 hours)
    if (now - data.timestamp < CACHE_DURATION) {
      return data.alerts;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Get cached checksum from localStorage
 */
export function getCachedChecksum(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedAlerts = JSON.parse(cached);
    return data.checksum || null;
  } catch {
    return null;
  }
}

/**
 * Set alerts in cache with timestamp and checksum
 */
export function setCachedAlerts(alerts: any[], checksum?: string): void {
  if (typeof window === 'undefined' || !tabId) return;
  
  try {
    const data: CachedAlerts = {
      alerts,
      timestamp: Date.now(),
      tabId,
      checksum
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    
    // Also store checksum separately for quick access
    if (checksum) {
      localStorage.setItem(VERSION_KEY, checksum);
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Try to acquire fetch lock
 * Only one tab should fetch at a time
 */
export function acquireFetchLock(): boolean {
  if (typeof window === 'undefined' || !tabId) return false;
  
  try {
    const lock = localStorage.getItem(LOCK_KEY);
    if (!lock) {
      // No lock exists, acquire it
      localStorage.setItem(LOCK_KEY, JSON.stringify({
        tabId,
        timestamp: Date.now()
      }));
      return true;
    }
    
    const lockData = JSON.parse(lock);
    const now = Date.now();
    
    // If lock is older than cooldown period, it's stale - acquire it
    if (now - lockData.timestamp > FETCH_COOLDOWN) {
      localStorage.setItem(LOCK_KEY, JSON.stringify({
        tabId,
        timestamp: now
      }));
      return true;
    }
    
    // Lock held by another tab
    return false;
  } catch {
    return false;
  }
}

/**
 * Release fetch lock
 */
export function releaseFetchLock(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Reset polling state (useful when cache is cleared)
 */
function resetPollingState(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(POLLING_STATE_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Clear all alert caches (useful when admin makes changes)
 */
export function clearAlertCache(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(VERSION_KEY);
    localStorage.removeItem(LOCK_KEY);
    resetPollingState(); // Reset polling state when cache is cleared
  } catch {
    // Ignore errors
  }
}

/**
 * Check if checksum has changed (lightweight version check)
 * Returns true if checksum is different or not cached
 */
export function hasChecksumChanged(newChecksum: string): boolean {
  if (typeof window === 'undefined') return true;
  
  try {
    const cachedChecksum = getCachedChecksum();
    return !cachedChecksum || cachedChecksum !== newChecksum;
  } catch {
    return true;
  }
}

/**
 * Setup storage event listener to sync alerts across tabs
 */
export function setupAlertSync(callback: (alerts: any[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handleStorage = (e: StorageEvent) => {
    if (e.key === CACHE_KEY && e.newValue) {
      try {
        const data: CachedAlerts = JSON.parse(e.newValue);
        // Only update if data is from another tab
        if (data.tabId !== tabId) {
          callback(data.alerts);
        }
      } catch {
        // Ignore parse errors
      }
    }
  };
  
  window.addEventListener('storage', handleStorage);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * Adaptive polling state management
 */
interface PollingState {
  currentInterval: number;
  lastChangeTime: number;
  consecutiveNoChanges: number;
  isFastMode: boolean;
}

/**
 * Get initial polling state
 */
function getInitialPollingState(): PollingState {
  return {
    currentInterval: INITIAL_INTERVAL,
    lastChangeTime: 0,
    consecutiveNoChanges: 0,
    isFastMode: false
  };
}

/**
 * Get current polling state from localStorage
 */
function getPollingState(): PollingState {
  if (typeof window === 'undefined') return getInitialPollingState();
  
  try {
    const stored = localStorage.getItem(POLLING_STATE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore errors
  }
  
  return getInitialPollingState();
}

/**
 * Save polling state to localStorage
 */
function savePollingState(state: PollingState): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(POLLING_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore errors
  }
}

/**
 * Get adaptive polling interval based on change detection
 * Returns the next interval to use
 */
export function getAdaptivePollingInterval(hasChange: boolean): number {
  const state = getPollingState();
  const now = Date.now();
  let newState: PollingState;
  
  if (hasChange) {
    // Change detected - switch to fast mode (1 minute)
    newState = {
      currentInterval: FAST_INTERVAL,
      lastChangeTime: now,
      consecutiveNoChanges: 0,
      isFastMode: true
    };
  } else {
    // No change detected
    const newConsecutiveNoChanges = state.consecutiveNoChanges + 1;
    const timeSinceLastChange = now - state.lastChangeTime;
    
    if (state.isFastMode) {
      // In fast mode - check if we should slow down
      if (timeSinceLastChange > STABILITY_PERIOD || newConsecutiveNoChanges >= CONSECUTIVE_NO_CHANGE_THRESHOLD) {
        // Been stable for 2 minutes or 2 consecutive checks with no change - return to base interval
        newState = {
          currentInterval: INITIAL_INTERVAL, // Return to 9 minutes
          lastChangeTime: state.lastChangeTime,
          consecutiveNoChanges: 0,
          isFastMode: false
        };
      } else {
        // Still in fast mode, keep checking every minute
        newState = {
          ...state,
          consecutiveNoChanges: newConsecutiveNoChanges
        };
      }
    } else {
      // Already in slow mode - maintain 9 minute interval
      newState = {
        ...state,
        consecutiveNoChanges: newConsecutiveNoChanges
      };
    }
  }
  
  savePollingState(newState);
  return newState.currentInterval;
}

/**
 * Get current polling interval (without checking for changes)
 */
export function getCurrentPollingInterval(): number {
  const state = getPollingState();
  return state.currentInterval;
}

