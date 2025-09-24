"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// Lazy load the actual PaymentButton component
const PaymentButton = dynamic(() => import("./PaymentButton").then(mod => ({ default: mod.PaymentButton })), {
  loading: () => (
    <button
      disabled
      className="inline-flex items-center px-4 py-2 bg-gray-400 text-white text-sm font-medium rounded-lg cursor-not-allowed"
    >
      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Loading...
    </button>
  ),
  ssr: false, // Disable SSR for payment components
});

interface LazyPaymentButtonProps {
  amount: number;
  fileId?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function LazyPaymentButton(props: LazyPaymentButtonProps) {
  return <PaymentButton {...props} />;
}

