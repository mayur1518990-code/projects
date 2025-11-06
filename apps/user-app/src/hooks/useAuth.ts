"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface User {
  userId: string;
  name: string;
  email: string;
  phone: string;
}

// Cache for user data to avoid repeated localStorage reads
let userCache: User | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute (reduced for better responsiveness)

export function useAuth() {
  // Initialize with localStorage data to prevent login flash
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
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);

  // Optimized function to get user data from localStorage with caching
  const getUserFromStorage = useCallback(() => {
    const now = Date.now();
    
    // Return cached data if still valid
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

  // Optimized function to create user object from Firebase user
  const createUserFromFirebase = useCallback((firebaseUser: any): User => ({
    userId: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    email: firebaseUser.email || '',
    phone: firebaseUser.phoneNumber || '',
  }), []);

  // Optimized function to update user cache
  const updateUserCache = useCallback((userData: User | null) => {
    userCache = userData;
    cacheTimestamp = userData ? Date.now() : 0;
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Fast timeout for better UX - only for fallback if Firebase fails
        timeoutRef.current = setTimeout(() => {
          // If we already have user from localStorage, keep them logged in
          if (user) {
            setLoading(false);
            setInitialized(true);
          } else {
            // If no user data anywhere, show login
            setLoading(false);
            setInitialized(true);
          }
        }, 1000); // 1s timeout for faster response

        // Initialize auth listener immediately - don't wait for localStorage
        unsubscribeRef.current = onAuthStateChanged(auth, (firebaseUser) => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          
          if (firebaseUser) {
            // Create user data from Firebase
            const userData = createUserFromFirebase(firebaseUser);
            setUser(userData);
            updateUserCache(userData);
            
            // Save to localStorage for persistence
            try {
              localStorage.setItem('user', JSON.stringify(userData));
            } catch {}
          } else {
            // Only clear user if we're sure they're logged out
            setUser(null);
            updateUserCache(null);
            
            // Clear localStorage asynchronously to avoid blocking
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
          }
          
          setLoading(false);
          setInitialized(true);
        });
      } catch (error) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        setLoading(false);
        setInitialized(true);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [createUserFromFirebase, updateUserCache]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      updateUserCache(null);
      
      // Clear localStorage asynchronously to avoid blocking
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
    } catch (error) {
      // Silent fail in production
    }
  }, [updateUserCache]);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(() => ({
    user,
    loading: loading || !initialized,
    signOut,
    initialized
  }), [user, loading, initialized, signOut]);
}
