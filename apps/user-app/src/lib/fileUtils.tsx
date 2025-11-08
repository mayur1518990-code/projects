/**
 * Shared file utility functions
 * Used across multiple components to avoid duplication
 */

import React, { ReactNode } from 'react';

/**
 * Format file size in bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get appropriate icon for file type
 */
export function getFileIcon(type: string): ReactNode {
  if (type.includes("pdf")) {
    return (
      <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    );
  } else if (type.includes("image")) {
    return (
      <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    );
  } else {
    return (
      <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }
}

/**
 * Get appropriate icon for large file displays (12x12)
 */
export function getFileIconLarge(type: string): ReactNode {
  if (type.includes("pdf")) {
    return (
      <svg className="w-12 h-12 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    );
  } else if (type.includes("image")) {
    return (
      <svg className="w-12 h-12 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    );
  } else {
    return (
      <svg className="w-12 h-12 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }
}

/**
 * Get status badge styling and text
 */
export function getStatusBadge(status: "pending_payment" | "paid" | "processing" | "completed" | "pending" | "replacement"): ReactNode {
  const statusConfig = {
    pending_payment: { color: "bg-yellow-100 text-yellow-800", text: "Pending Payment" },
    pending: { color: "bg-yellow-100 text-yellow-800", text: "Pending Payment" },
    paid: { color: "bg-green-100 text-green-800", text: "Paid" },
    processing: { color: "bg-blue-100 text-blue-800", text: "Processing" },
    completed: { color: "bg-gray-100 text-gray-800", text: "Completed" },
    replacement: { color: "bg-green-100 text-green-800", text: "Paid" }
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.text}
    </span>
  );
}

/**
 * Get alert styling based on type
 */
export function getAlertStyles(type: string): string {
  switch (type) {
    case 'info':
      return 'bg-blue-100 border-blue-500 text-blue-900';
    case 'warning':
      return 'bg-yellow-100 border-yellow-500 text-yellow-900';
    case 'success':
      return 'bg-green-100 border-green-500 text-green-900';
    case 'error':
      return 'bg-red-100 border-red-500 text-red-900';
    default:
      return 'bg-gray-100 border-gray-500 text-gray-900';
  }
}

/**
 * Get alert icon based on type
 */
export function getAlertIcon(type: string): string {
  switch (type) {
    case 'info': return 'ℹ️';
    case 'warning': return '⚠️';
    case 'success': return '✅';
    case 'error': return '❌';
    default: return 'ℹ️';
  }
}

/**
 * Detect if running in WebView (Android app)
 */
export function isWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return /(wv|WebView|; wv\))/i.test(navigator.userAgent) || 
         (!/Chrome\//i.test(navigator.userAgent) && /Version\//i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent));
}

