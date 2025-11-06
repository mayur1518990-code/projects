/**
 * Simple in-memory LRU cache for API handlers
 * 
 * This is a fallback cache for serverless invocations.
 * For production, use Redis/Cloud Memorystore for persistence.
 * 
 * Usage:
 *   Set USER_APP_CACHE=true in environment variables to enable
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 500, defaultTTL: number = 300000) { // Increased cache size to 500, 5 minutes default TTL
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance (increased size for better performance)
const cache = new LRUCache<any>(500, 300000); // 500 items, 5 minutes TTL

// Cleanup expired entries every 15 minutes (less frequent for better performance)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 900000); // 15 minutes
}

export function getCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}

export function getCached<T>(key: string): T | null {
  // Caching enabled by default for better performance
  return cache.get(key);
}

export function setCached<T>(key: string, value: T, ttl?: number): void {
  // Caching enabled by default for better performance
  cache.set(key, value, ttl);
}

export function deleteCached(key: string): void {
  // Caching enabled by default for better performance
  cache.delete(key);
}

export function clearCache(): void {
  // Caching enabled by default for better performance
  cache.clear();
}

export function getCacheStats() {
  return {
    enabled: true, // Always enabled for performance
    size: cache.size(),
    maxSize: 500
  };
}

// Cache decorator for functions
export function cached<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  ttl?: number
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    const cached = getCached(key);
    
    if (cached !== null) {
      return cached;
    }
    
    const result = await fn(...args);
    setCached(key, result, ttl);
    
    return result;
  }) as T;
}

export default cache;
