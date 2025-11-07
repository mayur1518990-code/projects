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

  // Load Razorpay script
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

      // Detect Android WebView to prefer redirect flow (popup can fail in WebViews)
      const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
      const isAndroid = /Android/i.test(ua);
      const isWebView = /(wv|WebView|; wv\))/i.test(ua) || (!/Chrome\//i.test(ua) && /Version\//i.test(ua) && /Mobile/i.test(ua));
      const useRedirectFlow = isAndroid && isWebView;

      // First, create an order on the server so we have a payment record to verify against
      const orderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, userId: user.userId, amount })
      });
      if (!orderRes.ok) {
        const errText = await orderRes.text();
        throw new Error(`Failed to create order: ${orderRes.status} ${errText}`);
      }
      const orderData = await orderRes.json();

      // Open Razorpay with appropriate flow
      const options: any = {
        key: "rzp_test_RJTmoYCxPGvgYd",
        amount: orderData.amount, // already in paise from API
          currency: "INR",
          name: "DocUpload",
          description: `Payment for file processing - ${fileId || "Document"}`,
        order_id: orderData.order_id,
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
          
          // Use the order_id we created; Razorpay returns the same
          const orderId = response.razorpay_order_id || orderData.order_id;
          
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
        // In WebViews, use redirect to Razorpay-hosted page and back to our callback
        const query = new URLSearchParams({
          fileId: fileId || '',
          userId: user.userId,
          amount: String(amount)
        }).toString();
        options.redirect = true;
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (typeof window !== 'undefined' ? window.location.origin : '');
        options.callback_url = `${baseUrl}/api/payment/verify?${query}`;
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
      className="inline-flex items-center px-3 sm:px-4 py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {authLoading ? (
        <>
          <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="hidden sm:inline">Loading...</span>
          <span className="sm:hidden">Loading</span>
        </>
      ) : !user ? (
        <>
          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="hidden sm:inline">Login Required</span>
          <span className="sm:hidden">Login</span>
        </>
      ) : isLoading ? (
        <>
          <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="hidden sm:inline">Processing...</span>
          <span className="sm:hidden">Processing</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <span className="hidden sm:inline">Pay ₹{amount}</span>
          <span className="sm:hidden">₹{amount}</span>
        </>
      )}
    </button>
  );
}
