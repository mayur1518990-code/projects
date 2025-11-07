// Shared alert cache with cross-tab synchronization
// This ensures only ONE tab fetches alerts, and all tabs share the data

interface CachedAlerts {
  alerts: any[];
  timestamp: number;
  tabId: string;
}

const CACHE_KEY = 'app_alerts_cache';
const LOCK_KEY = 'app_alerts_fetch_lock';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (only clears on page reload)
const FETCH_COOLDOWN = 1000; // 1 second cooldown between fetches

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
    
    // Check if cache is still valid (within 2 minutes)
    if (now - data.timestamp < CACHE_DURATION) {
      return data.alerts;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Set alerts in cache with timestamp
 */
export function setCachedAlerts(alerts: any[]): void {
  if (typeof window === 'undefined' || !tabId) return;
  
  try {
    const data: CachedAlerts = {
      alerts,
      timestamp: Date.now(),
      tabId
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
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
 * Clear all alert caches (useful when admin makes changes)
 */
export function clearAlertCache(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(LOCK_KEY);
  } catch {
    // Ignore errors
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

