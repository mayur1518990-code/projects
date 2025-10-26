"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const validateEmail = useCallback((email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Validate input
      if (!formData.email || !validateEmail(formData.email)) {
        setError("Please enter a valid email address");
        return;
      }

      if (!formData.password) {
        setError("Password is required");
        return;
      }

      // Sign in with Firebase Auth directly
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Try to get user data from Firestore, but don't fail if it doesn't work
      let userData = null;
      try {
        const userDoc = await getDoc(doc(db, 'user', user.uid));
        if (userDoc.exists()) {
          userData = userDoc.data();
        }
      } catch (error) {
        // Could not fetch user data from Firestore, using basic info
      }

      // Store user data with name from Firestore if available, otherwise use email
      localStorage.setItem('user', JSON.stringify({
        userId: user.uid,
        name: userData?.name || user.displayName || user.email?.split('@')[0] || 'User',
        email: userData?.email || user.email,
        phone: userData?.phone || user.phoneNumber || '',
      }));
      localStorage.setItem('token', await user.getIdToken());

      // Redirect to home page after successful login
      window.location.href = "/";
    } catch (error: any) {
      
      // Handle Firebase Auth errors
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (error.code === 'auth/wrong-password') {
        setError('Incorrect password');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later');
      } else if (error.code === 'auth/user-disabled') {
        setError('This account has been disabled');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      const provider = new GoogleAuthProvider();
      
      // No additional scopes - use defaults for maximum speed
      // provider.addScope('email'); // Removed for speed
      
      // Minimal parameters for fastest authentication
      provider.setCustomParameters({
        prompt: 'select_account',
        hd: '' // Disable domain hint for faster processing
      });
      
      // Ultra-fast timeout - 3 seconds max
      const signInPromise = signInWithPopup(auth, provider);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign-in timeout')), 3000)
      );
      
      const result = await Promise.race([signInPromise, timeoutPromise]) as any;
      const user = result.user;
      
      // Create minimal user data immediately
      const userData = {
        userId: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        phone: user.phoneNumber || '',
        createdAt: new Date().toISOString(),
      };
      
      // Store immediately for instant UI response
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Get token asynchronously to avoid blocking
      user.getIdToken().then((token: string) => {
        localStorage.setItem('token', token);
      }).catch(() => {
        // Silent fail - user is still logged in
      });
      
      // Redirect immediately - no waiting for anything
      window.location.href = "/";
      
      // Handle Firestore operations in background (completely non-blocking)
      setTimeout(async () => {
        try {
          const userDoc = await getDoc(doc(db, 'user', user.uid));
          if (!userDoc.exists()) {
            await setDoc(doc(db, 'user', user.uid), userData);
          }
        } catch (error) {
          // Silent fail - user is already logged in
        }
      }, 100);
      
    } catch (error: any) {
      let errorMessage = 'Google sign-in failed. Please try again.';
      
      if (error.message === 'Sign-in timeout') {
        errorMessage = 'Sign-in is taking too long. Please try again.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in was cancelled. Please try again.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked. Please allow popups and try again.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'This domain is not authorized. Please contact support.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google sign-in is not enabled. Please contact support.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Please contact support or try a different account.';
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with this email using a different sign-in method.';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid credentials. Please try again.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
              Login
            </h1>

            <div className="mb-4 sm:mb-6">
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex justify-center items-center px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-300 rounded-md shadow-sm bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>
            </div>

            <div className="relative mb-4 sm:mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-xs sm:text-sm">
                <span className="px-2 bg-white text-gray-500">Or sign in with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-gray-900 placeholder-gray-500"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-gray-900 placeholder-gray-500"
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-md text-xs sm:text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2.5 sm:py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base font-medium"
              >
                {isLoading ? "Logging In..." : "Login"}
              </button>
            </form>


            <div className="mt-4 sm:mt-6 text-center">
              <p className="text-xs sm:text-sm text-gray-600">
                Don't have an account?{" "}
                <Link
                  href="/signup"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign up here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
