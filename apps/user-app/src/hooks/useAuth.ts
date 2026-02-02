"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

interface User {
  userId: string;
  name: string;
  email: string;
  phone: string;
}

// Cache for user data to avoid repeated localStorage reads
let userCache: User | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        userCache = parsedUser;
        cacheTimestamp = Date.now();
        return parsedUser;
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const checkStorageIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const getUserFromStorage = useCallback(() => {
    const now = Date.now();
    if (userCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return userCache;
    }
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        userCache = parsedUser;
        cacheTimestamp = now;
        return parsedUser;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error parsing stored user data:', error);
      }
    }
    userCache = null;
    return null;
  }, []);

  const updateUserCache = useCallback((userData: User | null) => {
    userCache = userData;
    cacheTimestamp = userData ? Date.now() : 0;
  }, []);

  useEffect(() => {
    // Initial load from localStorage (name+phone auth)
    const storedUser = getUserFromStorage();
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
    setInitialized(true);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        const current = getUserFromStorage();
        if (current) {
          setUser(current);
          updateUserCache(current);
        } else {
          setUser(null);
          updateUserCache(null);
        }
      }
    };

    checkStorageIntervalRef.current = setInterval(() => {
      const current = getUserFromStorage();
      if (current) {
        setUser((prev) => (prev?.userId !== current.userId ? current : prev));
        updateUserCache(current);
      }
    }, 500);

    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (checkStorageIntervalRef.current) {
        clearInterval(checkStorageIntervalRef.current);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [getUserFromStorage, updateUserCache]);

  const signOut = useCallback(async () => {
    setUser(null);
    updateUserCache(null);
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      });
    } else {
      setTimeout(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }, 0);
    }
  }, [updateUserCache]);

  return useMemo(
    () => ({
      user,
      loading: loading || !initialized,
      signOut,
      initialized,
    }),
    [user, loading, initialized, signOut]
  );
}
