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
    let checkStorageInterval: NodeJS.Timeout | undefined;
    
    // Listen for storage changes (when login stores user in localStorage)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        const storedUser = getUserFromStorage();
        if (storedUser) {
          setUser(storedUser);
          updateUserCache(storedUser);
        }
      }
    };
    
    const initializeAuth = () => {
      try {
        // First, check localStorage for user (supports name+phone authentication)
        const storedUser = getUserFromStorage();
        if (storedUser) {
          setUser(storedUser);
          setLoading(false);
          setInitialized(true);
        }

        // Fast timeout for better UX - only for fallback if Firebase fails
        timeoutRef.current = setTimeout(() => {
          // If we already have user from localStorage, keep them logged in
          const currentStoredUser = getUserFromStorage();
          if (currentStoredUser) {
            setUser(currentStoredUser);
          }
          setLoading(false);
          setInitialized(true);
        }, 1000); // 1s timeout for faster response

        // Initialize auth listener for Firebase Auth (for agents/admins)
        // But don't clear localStorage user if Firebase has no user
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
            // Don't clear user if we have one in localStorage (name+phone auth)
            // Only clear if explicitly signed out
            const storedUser = getUserFromStorage();
            if (!storedUser) {
              setUser(null);
              updateUserCache(null);
            }
          }
          
          setLoading(false);
          setInitialized(true);
        });

        // Also check localStorage periodically for changes (for same-tab updates)
        checkStorageInterval = setInterval(() => {
          const storedUser = getUserFromStorage();
          if (storedUser) {
            setUser((currentUser) => {
              if (!currentUser || storedUser.userId !== currentUser.userId) {
                return storedUser;
              }
              return currentUser;
            });
            updateUserCache(storedUser);
          }
        }, 500); // Check every 500ms

        window.addEventListener('storage', handleStorageChange);
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
      if (checkStorageInterval) {
        clearInterval(checkStorageInterval);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [createUserFromFirebase, updateUserCache, getUserFromStorage]);

  const signOut = useCallback(async () => {
    try {
      // Try to sign out from Firebase (for agents/admins)
      try {
        await firebaseSignOut(auth);
      } catch (error) {
        // Ignore Firebase sign out errors (user might not be using Firebase Auth)
      }
      
      // Always clear user state and localStorage
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
