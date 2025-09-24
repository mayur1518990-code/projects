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

  constructor(maxSize: number = 100, defaultTTL: number = 300000) { // 5 minutes default TTL
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

// Global cache instance
const cache = new LRUCache<any>(100, 300000); // 100 items, 5 minutes TTL

// Cleanup expired entries every 5 minutes
setInterval(() => {
  cache.cleanup();
}, 300000);

export function getCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}

export function getCached<T>(key: string): T | null {
  if (process.env.USER_APP_CACHE !== 'true') {
    return null;
  }
  
  return cache.get(key);
}

export function setCached<T>(key: string, value: T, ttl?: number): void {
  if (process.env.USER_APP_CACHE !== 'true') {
    return;
  }
  
  cache.set(key, value, ttl);
}

export function deleteCached(key: string): void {
  if (process.env.USER_APP_CACHE !== 'true') {
    return;
  }
  
  cache.delete(key);
}

export function clearCache(): void {
  if (process.env.USER_APP_CACHE !== 'true') {
    return;
  }
  
  cache.clear();
}

export function getCacheStats() {
  return {
    enabled: process.env.USER_APP_CACHE === 'true',
    size: cache.size(),
    maxSize: 100
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
