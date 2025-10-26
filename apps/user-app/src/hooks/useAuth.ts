"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface User {
  userId: string;
  name: string;
  email: string;
  phone: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Memoized function to get user data from localStorage
  const getUserFromStorage = useCallback(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error parsing stored user data:', error);
      }
      return null;
    }
  }, []);

  // Memoized function to create user object from Firebase user
  const createUserFromFirebase = useCallback((firebaseUser: any): User => ({
    userId: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    email: firebaseUser.email || '',
    phone: firebaseUser.phoneNumber || '',
  }), []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Auth initialization timeout - proceeding without user');
          }
          setLoading(false);
          setInitialized(true);
        }, 5000); // 5 second timeout

        // Initialize auth listener
        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          clearTimeout(timeoutId);
          
          if (process.env.NODE_ENV === 'development') {
            console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'User logged out');
          }
          
          if (firebaseUser) {
            // Try to get user from localStorage first (faster)
            const storedUser = getUserFromStorage();
            if (storedUser) {
              setUser(storedUser);
            } else {
              // Fallback to Firebase user data
              setUser(createUserFromFirebase(firebaseUser));
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('User logged out, clearing data');
            }
            setUser(null);
            // Clear localStorage asynchronously to avoid blocking
            setTimeout(() => {
              localStorage.removeItem('user');
              localStorage.removeItem('token');
            }, 0);
          }
          
          setLoading(false);
          setInitialized(true);
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Auth initialization error:', error);
        }
        clearTimeout(timeoutId);
        setLoading(false);
        setInitialized(true);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [getUserFromStorage, createUserFromFirebase]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      // Clear localStorage asynchronously to avoid blocking
      setTimeout(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }, 0);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error signing out:', error);
      }
    }
  }, []);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(() => ({
    user,
    loading: loading || !initialized,
    signOut,
    initialized
  }), [user, loading, initialized, signOut]);
}
