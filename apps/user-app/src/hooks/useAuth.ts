"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';

interface User {
  userId: string;
  name: string;
  email: string;
  phone: string;
}

export function useAuth() {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Memoized function to create user object from NextAuth session
  const createUserFromSession = useCallback((session: any): User => ({
    userId: session.userId || session.user?.id || '',
    name: session.user?.name || session.user?.email?.split('@')[0] || 'User',
    email: session.user?.email || '',
    phone: '',
  }), []);

  useEffect(() => {
    if (status === 'loading') {
      setLoading(true);
      return;
    }

    if (status === 'authenticated' && session) {
      setUser(createUserFromSession(session));
      setLoading(false);
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [session, status, createUserFromSession]);

  const signOut = useCallback(async () => {
    try {
      await nextAuthSignOut({ callbackUrl: '/' });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error signing out:', error);
      }
    }
  }, []);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(() => ({
    user,
    loading,
    signOut,
    initialized: status !== 'loading'
  }), [user, loading, signOut, status]);
}
