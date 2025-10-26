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
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
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
        // Reduced timeout to 1 second for much faster UX
        timeoutRef.current = setTimeout(() => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Auth initialization timeout - proceeding without user');
          }
          setLoading(false);
          setInitialized(true);
        }, 1000);

        // Check localStorage first for immediate response
        const storedUser = getUserFromStorage();
        if (storedUser) {
          setUser(storedUser);
          setLoading(false);
          setInitialized(true);
        }

        // Initialize auth listener with optimized callback
        unsubscribeRef.current = onAuthStateChanged(auth, (firebaseUser) => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'User logged out');
          }
          
          if (firebaseUser) {
            // Use cached data if available, otherwise create from Firebase
            const userData = getUserFromStorage() || createUserFromFirebase(firebaseUser);
            setUser(userData);
            updateUserCache(userData);
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('User logged out, clearing data');
            }
            setUser(null);
            updateUserCache(null);
            
            // Clear localStorage asynchronously to avoid blocking
            requestIdleCallback(() => {
              localStorage.removeItem('user');
              localStorage.removeItem('token');
            });
          }
          
          setLoading(false);
          setInitialized(true);
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Auth initialization error:', error);
        }
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
  }, [getUserFromStorage, createUserFromFirebase, updateUserCache]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      updateUserCache(null);
      
      // Clear localStorage asynchronously to avoid blocking
      requestIdleCallback(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error signing out:', error);
      }
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
