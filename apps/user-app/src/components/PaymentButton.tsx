"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuthContext } from "./AuthProvider";

interface PaymentButtonProps {
  amount: number;
  fileId?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

// Razorpay types
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: any) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: {
    file_id?: string;
  };
  theme?: {
    color: string;
  };
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function PaymentButton({ amount, fileId, onSuccess, onError }: PaymentButtonProps) {
  const { user, loading: authLoading } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [isRazorpayLoaded, setIsRazorpayLoaded] = useState(false);

  // Load Razorpay script and handle mobile app messages
  useEffect(() => {
    // Check if Razorpay is already loaded
    if (window.Razorpay) {
      setIsRazorpayLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log("Razorpay script loaded successfully");
      }
      setIsRazorpayLoaded(true);
    };
    script.onerror = (error) => {
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to load Razorpay script:", error);
      }
      onError?.("Payment system unavailable. Please try again later.");
    };
    document.head.appendChild(script);

    return () => {
      // Only remove if we added it
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [onError]);

  // Handle messages from mobile app payment windows
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (process.env.NODE_ENV === 'development') {
        console.log("Received message:", event.data);
        console.log("Message origin:", event.origin);
        console.log("Message source:", event.source);
      }
      
      // Handle payment success
      if (event.data?.type === 'payment_success') {
        if (process.env.NODE_ENV === 'development') {
          console.log("Payment success message received from mobile app:", event.data);
        }
        
        // Show success message to user
        if (process.env.NODE_ENV === 'development') {
          console.log("Calling onSuccess callback");
        }
        onSuccess?.();
        
        // Also try to refresh the page or update UI
        setTimeout(() => {
          if (process.env.NODE_ENV === 'development') {
            console.log("Payment completed successfully, refreshing page...");
          }
          window.location.reload();
        }, 1000);
        
      } else if (event.data?.type === 'payment_error') {
        if (process.env.NODE_ENV === 'development') {
          console.log("Payment error message received from mobile app:", event.data.message);
        }
        onError?.(event.data.message || "Payment failed. Please try again.");
      }
    };

    // Add multiple event listeners for better compatibility
    window.addEventListener('message', handleMessage);
    
    // Also listen for custom events
    const handleCustomEvent = (event: CustomEvent) => {
      if (process.env.NODE_ENV === 'development') {
        console.log("Received custom event:", event.detail);
      }
      
      if (event.detail?.type === 'payment_success') {
        onSuccess?.();
        setTimeout(() => window.location.reload(), 1000);
      } else if (event.detail?.type === 'payment_error') {
        onError?.(event.detail.message || "Payment failed. Please try again.");
      }
    };
    
    document.addEventListener('payment_success', handleCustomEvent as EventListener);
    document.addEventListener('payment_error', handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('payment_success', handleCustomEvent as EventListener);
      document.removeEventListener('payment_error', handleCustomEvent as EventListener);
    };
  }, [onSuccess, onError]);

  const handlePayment = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log("Payment button clicked");
    }
    
    // Check if user is authenticated
    if (authLoading) {
      onError?.("Authentication is loading. Please wait...");
      return;
    }

    if (!user) {
      onError?.("Please log in to make a payment");
      return;
    }
    
    if (!isRazorpayLoaded) {
      if (process.env.NODE_ENV === 'development') {
        console.log("Razorpay not loaded yet");
      }
      onError?.("Payment system is loading. Please try again in a moment.");
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log("Razorpay is loaded, proceeding with payment");
    }
    setIsLoading(true);
    
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log("User data:", user);
      }

      if (process.env.NODE_ENV === 'development') {

        console.log("Opening Razorpay directly for payment:", { fileId, userId: user.userId, amount });

      }

      // Detect platform and environment
      const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
      const isAndroid = /Android/i.test(ua);
      const isWebView = /(wv|WebView|; wv\))/i.test(ua) || (!/Chrome\//i.test(ua) && /Version\//i.test(ua) && /Mobile/i.test(ua));
      const isAppxyz = /appxyz/i.test(ua) || window.location?.hostname?.includes('appxyz') || false;
      
      // Use redirect flow for Android WebViews and appxyz platform
      const useRedirectFlow = (isAndroid && isWebView) || isAppxyz;

      // Get the appropriate base URL for callbacks
      const siteOrigin = (() => {
        // For appxyz platform, use the original webapp URL
        if (isAppxyz) {
          return process.env.NEXT_PUBLIC_BASE_URL || 'https://projects-user-app.vercel.app';
        }
        // For regular webapp, use current origin
        return (typeof window !== 'undefined' && window.location?.origin) ||
               process.env.NEXT_PUBLIC_SITE_URL ||
               process.env.NEXT_PUBLIC_BASE_URL ||
               '';
      })();

      // Debug: Check if Razorpay key is available
      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_RJTmoYCxPGvgYd";
      if (process.env.NODE_ENV === 'development') {
        console.log("Environment variables check:");
        console.log("- NODE_ENV:", process.env.NODE_ENV);
        console.log("- NEXT_PUBLIC_RAZORPAY_KEY_ID:", process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
        console.log("- Razorpay Key:", razorpayKey ? "Found" : "Missing");
        console.log("- Key value:", razorpayKey);
        console.log("- Using fallback key:", razorpayKey === "rzp_test_RJTmoYCxPGvgYd");
      }
      
      if (!razorpayKey) {
        const errorMsg = "Razorpay key not found. Please check NEXT_PUBLIC_RAZORPAY_KEY_ID environment variable.";
        if (process.env.NODE_ENV === 'development') {
          console.error(errorMsg);
          console.error("Available env vars:", Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC')));
        }
        throw new Error(errorMsg);
      }

      const options: any = {
        key: razorpayKey,
        amount: amount * 100, // Convert to paise
          currency: "INR",
          name: "DocUpload",
          description: `Payment for file processing - ${fileId || "Document"}`,
        handler: async (response: any) => {
          if (process.env.NODE_ENV === 'development') {
            console.log("=== PAYMENT HANDLER CALLED ===");
          }
            if (process.env.NODE_ENV === 'development') {
              console.log("Payment successful:", response);
            }
          if (process.env.NODE_ENV === 'development') {
            console.log("Razorpay response details:", {
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            signature: response.razorpay_signature
          });
          }
          if (process.env.NODE_ENV === 'development') {
            console.log("Current user:", user);
          }
          if (process.env.NODE_ENV === 'development') {
            console.log("File ID:", fileId);
          }
          if (process.env.NODE_ENV === 'development') {
            console.log("Amount:", amount);
          }
          
          // Generate a fallback order ID if not provided by Razorpay
          const orderId = response.razorpay_order_id || `order_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          
          try {
            // Always create a new payment record with Razorpay details
            const createPaymentResponse = await fetch("/api/payment/create-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                fileId: fileId,
                userId: user.userId,
                amount: amount,
                razorpay_order_id: orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature || null,
                status: "captured"
              }),
            });

            if (process.env.NODE_ENV === 'development') {

              console.log('Payment creation response status:', createPaymentResponse.status);

            }
            
            if (!createPaymentResponse.ok) {
              const errorText = await createPaymentResponse.text();
              if (process.env.NODE_ENV === 'development') {
                console.error('Payment creation API error:', createPaymentResponse.status, errorText);
              }
              throw new Error(`Payment creation failed: ${createPaymentResponse.status} - ${errorText}`);
            }

            const createPaymentData = await createPaymentResponse.json();
            if (process.env.NODE_ENV === 'development') {
              console.log('Payment created with Razorpay details:', createPaymentData);
            }
            
            if (!createPaymentData.success) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Payment creation failed:', createPaymentData.message);
              }
              throw new Error(`Payment creation failed: ${createPaymentData.message}`);
            }

            // Update file status to paid
            const fileUpdateResponse = await fetch("/api/files", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                fileId: fileId,
                userId: user.userId,
                status: "paid"
              }),
            });

            const fileUpdateData = await fileUpdateResponse.json();
            if (process.env.NODE_ENV === 'development') {
              console.log("File status updated:", fileUpdateData);
            }
            
            if (process.env.NODE_ENV === 'development') {
            
              console.log("Calling onSuccess callback for file:", fileId);
            
            }
            onSuccess?.();
          } catch (updateError) {
            if (process.env.NODE_ENV === 'development') {
              console.error("Payment update error:", updateError);
            }
            // Still call success since payment was completed
            onSuccess?.();
          }
          },
          prefill: {
          name: user.name || "User",
          email: user.email || "user@example.com",
          contact: user.phone || "9999999999",
          },
          notes: {
            file_id: fileId,
          },
          theme: {
          color: "#2563eb",
          },
        };

      if (useRedirectFlow) {
        // In WebViews and appxyz platform, use redirect to Razorpay-hosted page and back to our callback
        const query = new URLSearchParams({
          fileId: fileId || '',
          userId: user.userId,
          amount: String(amount)
        }).toString();
        options.redirect = true;
        
        // For appxyz platform, use a special callback URL that works with mobile apps
        if (isAppxyz) {
          // Use a simpler success endpoint for mobile apps
          options.callback_url = `${siteOrigin}/api/payment/success?${query}`;
        } else {
          // For regular WebViews, use the standard callback
          options.callback_url = `${siteOrigin}/api/payment/verify?${query}`;
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log("Using redirect flow with callback URL:", options.callback_url);
        }
      }

      if (process.env.NODE_ENV === 'development') {

        console.log("Razorpay options:", options);

      }

      try {
        if (process.env.NODE_ENV === 'development') {
          console.log("Creating Razorpay instance");
        }
        const razorpay = new window.Razorpay(options);
        
        razorpay.on("payment.failed", (response: any) => {
          if (process.env.NODE_ENV === 'development') {
            console.error("Payment failed:", response.error);
          }
          onError?.(response.error.description || "Payment failed. Please try again.");
        });
        
        if (process.env.NODE_ENV === 'development') {
        
          console.log("Opening Razorpay popup");
        
        }
        razorpay.open();
      } catch (razorpayError) {
        if (process.env.NODE_ENV === 'development') {
          console.error("Razorpay initialization error:", razorpayError);
        }
        const errorMessage = razorpayError instanceof Error ? razorpayError.message : 'Unknown error';
        onError?.(`Payment gateway initialization failed: ${errorMessage}`);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Payment failed:", error);
      }
      onError?.(error instanceof Error ? error.message : "Payment failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <button
      onClick={handlePayment}
      disabled={isLoading || !isRazorpayLoaded || authLoading || !user}
      className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {authLoading ? (
        <>
          <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </>
      ) : !user ? (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Login Required
        </>
      ) : isLoading ? (
        <>
          <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </>
      ) : (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Pay ₹{amount}
        </>
      )}
    </button>
  );
}





