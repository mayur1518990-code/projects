"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Extend Window interface for WebView message handlers
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    webkit?: {
      messageHandlers?: {
        authSuccess?: {
          postMessage: (data: any) => void;
        };
        googleAuth?: {
          postMessage: (data: any) => void;
        };
        closeWebView?: {
          postMessage: (data: any) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Handle redirect result for mobile WebViews
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        // Check if we're already processing a redirect
        if (isRedirecting) {
          return;
        }

        const result = await getRedirectResult(auth);
        if (result) {
          const user = result.user;
          
          // Check if user already exists in Firestore
          const userDoc = await getDoc(doc(db, 'user', user.uid));
          
          let userData;
          if (!userDoc.exists()) {
            // Create new user in Firestore
            userData = {
              userId: user.uid,
              name: user.displayName || user.email?.split('@')[0] || 'User',
              email: user.email || '',
              phone: user.phoneNumber || '',
              createdAt: new Date().toISOString(),
            };
            
            await setDoc(doc(db, 'user', user.uid), userData);
          } else {
            // User exists, get their data
            userData = userDoc.data();
          }
          
          // Store user data in localStorage
          localStorage.setItem('user', JSON.stringify(userData));
          localStorage.setItem('token', await user.getIdToken());
          
          // Clear any auth parameters from URL
          const newUrl = new URL(window.location.href);
          newUrl.search = '';
          window.history.replaceState({}, '', newUrl.toString());
          
          // For mobile apps, send auth data and close WebView
          const token = await user.getIdToken();
          
          // Force send auth data to native app with multiple methods
          const authData = {
            type: 'AUTH_SUCCESS',
            success: true,
            user: userData,
            token: token,
            userId: userData.userId,
            userName: userData.name,
            userEmail: userData.email,
            timestamp: Date.now()
          };
          
          console.log('Sending auth data to native app:', authData);
          
          // Method 1: React Native WebView
          if (window.ReactNativeWebView) {
            console.log('Using React Native WebView communication');
            window.ReactNativeWebView.postMessage(JSON.stringify(authData));
          }
          
          // Method 2: iOS WKWebView
          if (window.webkit && window.webkit.messageHandlers) {
            console.log('Using iOS WKWebView communication');
            if (window.webkit.messageHandlers.authSuccess) {
              window.webkit.messageHandlers.authSuccess.postMessage(authData);
            }
          }
          
          // Method 3: Force redirect with auth data in URL (most reliable)
          console.log('Using URL redirect method for native app');
          const authUrl = new URL('/', window.location.origin);
          authUrl.searchParams.set('auth_success', 'true');
          authUrl.searchParams.set('user_id', userData.userId);
          authUrl.searchParams.set('user_name', userData.name);
          authUrl.searchParams.set('user_email', userData.email);
          authUrl.searchParams.set('token', token);
          authUrl.searchParams.set('timestamp', Date.now().toString());
          
          // Send multiple messages with different timing
          const sendMessages = () => {
            // Send auth success message
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'USER_AUTHENTICATED',
                userId: userData.userId,
                userName: userData.name,
                userEmail: userData.email,
                token: token,
                timestamp: Date.now()
              }));
            }
            
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.authSuccess) {
              window.webkit.messageHandlers.authSuccess.postMessage({
                type: 'USER_AUTHENTICATED',
                userId: userData.userId,
                userName: userData.name,
                userEmail: userData.email,
                token: token,
                timestamp: Date.now()
              });
            }
          };
          
          // Send messages immediately and with delays
          sendMessages();
          setTimeout(sendMessages, 500);
          setTimeout(sendMessages, 1000);
          
          // Force redirect after 2 seconds (this ensures native app gets the data)
          setTimeout(() => {
            console.log('Force redirecting to native app with auth data');
            window.location.href = authUrl.toString();
          }, 2000);
          
          // Also try to close WebView
          setTimeout(() => {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'CLOSE_WEBVIEW',
                reason: 'auth_complete'
              }));
            }
            
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.closeWebView) {
              window.webkit.messageHandlers.closeWebView.postMessage({
                type: 'CLOSE_WEBVIEW',
                reason: 'auth_complete'
              });
            }
          }, 2500);
        } else {
          // Check if we're coming back from a redirect but no result
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('state') || urlParams.get('code') || urlParams.get('error')) {
            // We have auth parameters but no result - might be an error
            const error = urlParams.get('error');
            if (error) {
              setError(`Authentication failed: ${error}`);
            } else {
              // No error but no result - might be a WebView issue
              setError('Authentication completed but could not process result. Please try again.');
            }
            
            // Clear the URL parameters to prevent loops
            const newUrl = new URL(window.location.href);
            newUrl.search = '';
            window.history.replaceState({}, '', newUrl.toString());
          }
        }
      } catch (error: any) {
        console.error('Redirect result error:', error);
        setError('Google sign-in failed. Please try again.');
      }
    };

    handleRedirectResult();

    // Listen for messages from native app
    const handleNativeMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'AUTH_RESPONSE') {
          if (data.success) {
            console.log('Native app confirmed auth success');
            // Clear URL parameters
            const newUrl = new URL(window.location.href);
            newUrl.search = '';
            window.history.replaceState({}, '', newUrl.toString());
          } else {
            console.error('Native app auth failed:', data.error);
            setError(data.error || 'Authentication failed');
          }
        }
      } catch (error) {
        console.error('Error handling native message:', error);
      }
    };

    window.addEventListener('message', handleNativeMessage);

    return () => {
      window.removeEventListener('message', handleNativeMessage);
    };
  }, [isRedirecting]);

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
      
      // Detect if we're in a mobile WebView
      const ua = navigator.userAgent || '';
      const isMobileWebView = /(wv|WebView|; wv\))/i.test(ua) || 
        (!/Chrome\//i.test(ua) && /Version\//i.test(ua) && /Mobile/i.test(ua)) ||
        /Android.*wv|iPhone.*wv|iPad.*wv/i.test(ua) ||
        window.ReactNativeWebView ||
        (window.webkit && window.webkit.messageHandlers);
      
      let result;
      
      if (isMobileWebView) {
        // For mobile WebViews, use redirect flow which is more reliable
        if (!isRedirecting) {
          setIsRedirecting(true);
          try {
            provider.setCustomParameters({
              prompt: 'select_account'
            });
            
            // Use redirect for WebViews - more reliable than popup
            await signInWithRedirect(auth, provider);
            return; // The redirect will handle the rest
          } catch (redirectError: any) {
            console.error('Redirect auth error:', redirectError);
            setError(`Authentication failed: ${redirectError.message || 'Unknown error'}`);
            setIsRedirecting(false);
            return;
          }
        } else {
          setError('Authentication is already in progress. Please wait...');
          return;
        }
      } else {
        // Use popup for regular browsers
        provider.addScope('email');
        provider.addScope('profile');
        provider.setCustomParameters({
          prompt: 'select_account'
        });
        
        result = await signInWithPopup(auth, provider);
      }
      
      const user = result.user;
      
      // Check if user already exists in Firestore
      const userDoc = await getDoc(doc(db, 'user', user.uid));
      
      if (!userDoc.exists()) {
        // Create new user in Firestore
        const userData = {
          userId: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          phone: user.phoneNumber || '',
          createdAt: new Date().toISOString(),
        };
        
        await setDoc(doc(db, 'user', user.uid), userData);
        
        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        // User exists, get their data
        const userData = userDoc.data();
        localStorage.setItem('user', JSON.stringify(userData));
      }
      
      localStorage.setItem('token', await user.getIdToken());
      
      // Redirect to home page
      window.location.href = "/";
    } catch (error: any) {
      
      let errorMessage = 'Google sign-in failed. Please try again.';
      
      if (error.code === 'auth/popup-closed-by-user') {
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
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
              Login
            </h1>

            <div className="mb-6">
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or sign in with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Logging In..." : "Login"}
              </button>
            </form>


            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
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
