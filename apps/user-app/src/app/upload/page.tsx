

"use client";

import { LazyQRCodeDisplay } from "@/components/LazyQRCodeDisplay";
import { LazyPaymentButton } from "@/components/LazyPaymentButton";
import { useAuthContext } from "@/components/AuthProvider";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { formatFileSize, getFileIcon, getStatusBadge, getAlertStyles, getAlertIcon } from "@/lib/fileUtils";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "pending" | "paid" | "processing" | "completed";
  uploadDate: Date;
  qrCode?: string;
}

interface Alert {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  createdAt: string;
}

export default function UploadPage() {
  const { user, loading } = useAuthContext();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [authTimeout, setAuthTimeout] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  // Fetch alerts only on page load/refresh - no background polling
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let isMounted = true;
    
    const init = async () => {
      try {
        // Import alert cache utilities
        const cache = await import('@/lib/alertCache');
        
        // Load cached alerts immediately on mount (instant display)
        const cached = cache.getCachedAlerts();
        if (cached && isMounted) {
          setAlerts(cached);
        }
        
        const fetchAlerts = async () => {
          if (!isMounted) return;
          
          // Try to acquire lock - only one tab should fetch
          if (!cache.acquireFetchLock()) {
            // Another tab is fetching, wait for storage event
            return;
          }
          
          try {
            // Check version first to see if cache is stale
            const versionResponse = await fetch('/api/alerts?version=true');
            if (versionResponse.ok) {
              const versionData = await versionResponse.json();
              const newChecksum = versionData.checksum;
              
              // Only fetch full alerts if checksum changed or no cache
              if (!cached || cache.hasChecksumChanged(newChecksum)) {
                const response = await fetch('/api/alerts');
                if (response.ok && isMounted) {
                  const data = await response.json();
                  const alertsData = data.alerts || [];
                  const checksum = data.checksum;
                  setAlerts(alertsData);
                  // Cache with checksum for all tabs to use
                  cache.setCachedAlerts(alertsData, checksum);
                }
              } else {
                // Cache is still valid, no need to fetch
                // Alerts already set from cache above
              }
            }
          } catch (error) {
            // Silent in production - use cached data if available
            if (process.env.NODE_ENV === 'development') {
              console.error("Error fetching alerts:", error);
            }
          } finally {
            cache.releaseFetchLock();
          }
        };
        
        // Fetch alerts on page load/refresh
        // If cache exists, check version first (lightweight)
        // If no cache, fetch full alerts
        await fetchAlerts();
        
        // Listen for updates from other tabs (in case they fetch)
        if (isMounted) {
          cleanup = cache.setupAlertSync((alerts: any[]) => {
            if (isMounted) {
              setAlerts(alerts);
            }
          });
        }
      } catch (error) {
        // Silent fail - alerts are not critical for page load
        if (process.env.NODE_ENV === 'development') {
          console.error("Error initializing alerts:", error);
        }
      }
    };
    
    // Don't await - let page render immediately
    init();
    
    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, []);

  // Optimized authentication handling with timeout protection
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // Set a timeout to prevent infinite loading (reduced from 3s to 2s)
    const authTimeoutId = setTimeout(() => {
      if (loading) {
        setAuthTimeout(true);
      }
    }, 2000); // 2 second timeout for faster page load

    // Redirect to login if not authenticated (reduced delay)
    if (!loading && !user) {
      timeoutId = setTimeout(() => {
        window.location.href = '/login';
      }, 500); // Reduced from 1s to 500ms for faster redirect
    }

    return () => {
      clearTimeout(authTimeoutId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, loading]);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/jpg", 
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/rtf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-rar-compressed",
    "image/svg+xml"
  ];

  // Using shared utility functions from fileUtils
  
  const handleDismissAlert = useCallback((id: string) => {
    setDismissedAlerts(prev => [...prev, id]);
  }, []);
  
  const visibleAlerts = useMemo(() => 
    alerts.filter(alert => !dismissedAlerts.includes(alert.id)),
    [alerts, dismissedAlerts]
  );

  const uploadFileToServer = useCallback(async (file: File) => {
    try {
      // Use FormData for direct file upload instead of base64
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user?.userId || '');
      formData.append('metadata', JSON.stringify({
        uploadedVia: 'web',
        userAgent: navigator.userAgent
      }));

      // Add timeout protection for upload
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Upload failed');
      }

      // Notify other tabs that a new file was uploaded
      localStorage.setItem('newFileUploaded', Date.now().toString());

      return result.file;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Upload timeout - please try again');
      }
      throw error;
    }
  }, [user?.userId]);

  const handleFiles = useCallback(async (files: FileList) => {
    if (!user) {
      setError('Please log in to upload files');
      return;
    }

    setError("");
    setIsUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file size
        if (file.size === 0) {
          throw new Error(`File "${file.name}" is empty. Please select a valid file.`);
        }
        
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File "${file.name}" is too large. Maximum size is 20MB.`);
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          throw new Error(`File "${file.name}" is not supported. Allowed types: PDF, images, Word docs, Excel, PowerPoint, text files, and archives.`);
        }

        // Upload to server
        const uploadedFile = await uploadFileToServer(file);

        const newFile: UploadedFile = {
          id: uploadedFile.id,
          name: uploadedFile.originalName,
          size: uploadedFile.size,
          type: uploadedFile.mimeType,
          status: "pending",
          uploadDate: new Date(uploadedFile.uploadedAt),
        };

        return newFile;
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setUploadedFiles(prev => [...prev, ...uploadedFiles]);
    } catch (error: any) {
      setError(error.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [user]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handlePaymentSuccess = (fileId: string) => {
    setUploadedFiles(prev =>
      prev.map(file =>
        file.id === fileId ? { ...file, status: "paid" as const } : file
      )
    );
  };

  const handleQRGenerate = useCallback((fileId: string) => {
    setUploadedFiles(prev =>
      prev.map(file =>
        file.id === fileId ? { ...file, qrCode: "generated" } : file
      )
    );
  }, []);

  // Memoize the uploaded files list to prevent unnecessary re-renders
  const memoizedUploadedFiles = useMemo(() => uploadedFiles, [uploadedFiles]);

  // Show loading if checking authentication (with timeout protection)
  // Reduced timeout to show page faster
  if (loading && !authTimeout) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Show page immediately even if auth is still loading (after timeout)
  // This prevents blocking the page render

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please log in to upload files</h1>
          <a href="/login" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Alert Banners - Fixed below navbar */}
      {visibleAlerts.length > 0 && (
        <div className="fixed top-12 sm:top-14 md:top-16 left-0 right-0 bg-white border-b shadow-md z-40">
          <div className="container mx-auto px-3 sm:px-4">
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`border-l-4 p-4 my-2 rounded ${getAlertStyles(alert.type)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0">{getAlertIcon(alert.type)}</span>
                    <div className="scroll-container flex-1 min-w-0">
                      <p className="scroll-text text-sm sm:text-base font-medium">
                        {alert.message}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDismissAlert(alert.id)}
                    className="ml-4 text-xl hover:opacity-70 transition-opacity flex-shrink-0"
                    aria-label="Dismiss alert"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Spacer for navbar + fixed alert */}
      {visibleAlerts.length > 0 && (
        <div className="h-12 sm:h-14 md:h-16" />
      )}
      
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">
            Upload Documents
          </h1>
          
          {/* Upload Area */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Upload Your Files</h2>
            <div
              className={`border-2 border-dashed rounded-lg p-4 sm:p-6 md:p-8 text-center transition-colors ${
                dragActive
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleFileInput}
              />
              <div className="space-y-3 sm:space-y-4">
                <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  {isUploading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-blue-600"></div>
                      <span className="text-blue-600 font-medium text-base sm:text-lg">Uploading files...</span>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm sm:text-base hover:bg-blue-700 transition-colors"
                        disabled={isUploading}
                      >
                        Choose Files
                      </button>
                      <p className="text-gray-500 mt-2 text-sm sm:text-base">or drag and drop files here</p>
                    </>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-500">
                  PDF, DOC, DOCX, JPG, PNG, GIF, TXT, XLS, PPT, ZIP and more up to 20MB each
                </p>
              </div>
            </div>
            
            {error && (
              <div className="mt-3 sm:mt-4 bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-md text-xs sm:text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Uploaded Files List */}
          {memoizedUploadedFiles.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Uploaded Files</h2>
              <div className="space-y-3 sm:space-y-4">
                {memoizedUploadedFiles.map((file) => (
                  <div key={file.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="flex-shrink-0">
                          {getFileIcon(file.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 truncate text-sm sm:text-base">{file.name}</p>
                          <p className="text-xs sm:text-sm text-gray-500">
                            {formatFileSize(file.size)} • {file.uploadDate.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                        <div className="flex-shrink-0">
                          {getStatusBadge(file.status)}
                        </div>
                        {file.status === "pending" && (
                          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <LazyPaymentButton
                              amount={100}
                              fileId={file.id}
                              onSuccess={() => handlePaymentSuccess(file.id)}
                              onError={(error) => setError(error)}
                            />
                            <LazyQRCodeDisplay
                              fileId={file.id}
                              onGenerate={() => handleQRGenerate(file.id)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-2 sm:mb-3">How it works</h3>
            <ol className="list-decimal list-inside space-y-1 sm:space-y-2 text-sm sm:text-base text-blue-800">
              <li>Upload your files (PDF, images, Word docs, Excel, PowerPoint, text files, archives)</li>
              <li>Complete payment to process your files</li>
              <li>Generate QR codes for easy sharing and tracking</li>
              <li>Track your files in the "My Files" section</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}