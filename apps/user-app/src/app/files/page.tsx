"use client";

import { LazyQRCodeDisplay } from "@/components/LazyQRCodeDisplay";
import { LazyPaymentButton } from "@/components/LazyPaymentButton";
import { AgentResponse } from "@/components/AgentResponse";
import { useAuthContext } from "@/components/AuthProvider";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";

interface FileData {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "pending_payment" | "paid" | "processing" | "completed";
  uploadDate: Date;
  qrCode?: string;
  paymentAmount: number;
  // Agent response data
  agentResponse?: {
    message: string;
    responseFileURL: string;
    respondedAt: string;
    agent: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
  hasResponse?: boolean;
  agentId?: string;
  assignedAt?: string;
  respondedAt?: string;
  // Processing status data
  processingStartedAt?: string;
  completedAt?: string;
  // Completed file data
  completedFile?: {
    id: string;
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    filePath: string;
    uploadedAt: string;
    agentId: string;
    agentName: string;
  };
  completedFileId?: string;
}

export default function FilesPage() {
  const { user, loading: authLoading } = useAuthContext();
  const [files, setFiles] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending_payment" | "paid" | "processing" | "completed">("all");
  const [error, setError] = useState("");
  const isLoadingFilesRef = useRef(false); // Prevent duplicate requests
  const lastFetchTimeRef = useRef<number>(0); // Track last fetch time
  const filesDataRef = useRef<FileData[]>([]); // Cache files data
  const lastUserIdRef = useRef<string | null>(null); // Track last user ID

  // Sample data for demonstration
  const sampleFiles: FileData[] = [
    {
      id: "1",
      name: "contract.pdf",
      size: 2048576, // 2MB
      type: "application/pdf",
      status: "pending_payment",
      uploadDate: new Date("2024-01-15"),
      paymentAmount: 100,
    },
    {
      id: "2", 
      name: "invoice.docx",
      size: 1024000, // 1MB
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "paid",
      uploadDate: new Date("2024-01-14"),
      paymentAmount: 100,
      qrCode: "generated",
    },
    {
      id: "3",
      name: "screenshot.png",
      size: 512000, // 512KB
      type: "image/png",
      status: "processing",
      uploadDate: new Date("2024-01-13"),
      paymentAmount: 100,
    },
    {
      id: "4",
      name: "report.pdf",
      size: 3072000, // 3MB
      type: "application/pdf",
      status: "completed",
      uploadDate: new Date("2024-01-12"),
      paymentAmount: 100,
    },
  ];

  // Smart loading function that only fetches when needed
  const loadFiles = useCallback(async (forceRefresh = false) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('loadFiles called - forceRefresh:', forceRefresh, 'user:', !!user, 'isLoading:', isLoadingFilesRef.current);
    }
    
    if (!user || isLoadingFilesRef.current) return; // Prevent duplicate requests
    
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
    
    // If we have cached data and it's not expired, use it
    if (!forceRefresh && filesDataRef.current.length > 0 && (now - lastFetchTimeRef.current) < CACHE_DURATION) {
      setFiles(filesDataRef.current);
      setIsLoading(false);
      return;
    }
    
    try {
      isLoadingFilesRef.current = true;
      setIsLoading(true);
      setError("");
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      let response;
      try {
        response = await fetch(`/api/files?userId=${user.userId}`, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to load files');
      }
      
      // Transform the data to match our interface
      const transformedFiles: FileData[] = result.files.map((file: any) => {
        // Map database status to UI status
        let uiStatus: FileData["status"];
        switch (file.status) {
          case 'pending_payment':
            uiStatus = 'pending_payment';
            break;
          case 'uploaded':
            uiStatus = 'pending_payment';
            break;
          case 'paid':
            uiStatus = 'paid';
            break;
          case 'processing':
            uiStatus = 'processing';
            break;
          case 'completed':
            uiStatus = 'completed';
            break;
          default:
            uiStatus = 'pending_payment';
        }
        
        return {
          id: file.id,
          name: file.originalName,
          size: file.size,
          type: file.mimeType,
          status: uiStatus,
          uploadDate: new Date(file.uploadedAt),
          paymentAmount: 100, // Default amount
          qrCode: file.metadata?.qrCode,
          // Agent response data
          agentResponse: file.agentResponse,
          hasResponse: file.hasResponse,
          agentId: file.agentId,
          assignedAt: file.assignedAt,
          respondedAt: file.respondedAt,
          // Processing status data
          processingStartedAt: file.processingStartedAt,
          completedAt: file.completedAt,
          // Completed file data
          completedFile: file.completedFile,
          completedFileId: file.completedFileId
        };
      });
      
      // Cache the data and update timestamp
      filesDataRef.current = transformedFiles;
      lastFetchTimeRef.current = now;
      setFiles(transformedFiles);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setError('Request timeout - please try again');
      } else if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        setError('Unable to connect to server. Please check if the API is running.');
      } else {
        setError(error.message || "Failed to load files. Please try again.");
      }
    } finally {
      setIsLoading(false);
      isLoadingFilesRef.current = false;
    }
  }, [user]);

  // Single useEffect to load files when user is available
  useEffect(() => {
    if (user && !authLoading && !isLoadingFilesRef.current) {
      // Check if this is a different user or first load
      if (lastUserIdRef.current !== user.userId) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Loading files - new user:', user.userId, 'previous:', lastUserIdRef.current);
        }
        lastUserIdRef.current = user.userId;
        loadFiles();
      } else if (process.env.NODE_ENV === 'development') {
        console.log('Skipping loadFiles - same user, already loaded');
      }
    }
  }, [user, authLoading]); // Removed loadFiles from dependencies to prevent re-runs

  // Add timeout for auth loading to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (authLoading) {
        console.warn('Auth loading timeout - proceeding without user');
      }
    }, 5000); // 5 second timeout for faster response

    return () => clearTimeout(timeout);
  }, [authLoading]);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }, []);

  const getFileIcon = useCallback((type: string) => {
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
  }, []);

  const getStatusBadge = useCallback((status: FileData["status"]) => {
    const statusConfig = {
      pending_payment: { color: "bg-yellow-100 text-yellow-800", text: "Pending Payment" },
      pending: { color: "bg-yellow-100 text-yellow-800", text: "Pending Payment" },
      paid: { color: "bg-green-100 text-green-800", text: "Paid" },
      processing: { color: "bg-blue-100 text-blue-800", text: "Processing" },
      completed: { color: "bg-gray-100 text-gray-800", text: "Completed" }
    };
    
    const config = statusConfig[status];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  }, []);

  // Memoize filtered files to prevent unnecessary recalculations
  const filteredFiles = useMemo(() => 
    files.filter(file => filter === "all" || file.status === filter),
    [files, filter]
  );

  const handlePaymentSuccess = (fileId: string) => {
    
    // Update local state immediately for better UX
    setFiles(prev => {
      const updatedFiles = prev.map(file =>
        file.id === fileId ? { ...file, status: "paid" as const } : file
      );
      return updatedFiles;
    });
    
    // Also update cached data
    filesDataRef.current = filesDataRef.current.map(file =>
      file.id === fileId ? { ...file, status: "paid" as const } : file
    );
  };

  // Function to refresh data when new files are detected
  const refreshFiles = useCallback(() => {
    loadFiles(true); // Force refresh
  }, [loadFiles]);

  

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const isPullingRef = useRef(false);
  const pullStartYRef = useRef<number | null>(null);
  const PULL_THRESHOLD_PX = 64; // release threshold
  const PULL_MAX_PX = 128; // visual limit

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return; // only when scrolled to top
    isPullingRef.current = true;
    pullStartYRef.current = e.touches[0].clientY;
    setPullDistance(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current || pullStartYRef.current == null) return;
    const currentY = e.touches[0].clientY;
    const delta = Math.max(0, currentY - pullStartYRef.current);
    if (delta > 0) {
      // prevent page scroll while pulling
      e.preventDefault();
      const eased = Math.min(PULL_MAX_PX, delta * 0.6); // add a bit of resistance
      setPullDistance(eased);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isPullingRef.current) return;
    const shouldRefresh = pullDistance >= PULL_THRESHOLD_PX;
    isPullingRef.current = false;
    pullStartYRef.current = null;
    setPullDistance(0);
    if (shouldRefresh) {
      tryAutoRefresh('pull-to-refresh');
    }
  }, [pullDistance, tryAutoRefresh]);

  

  // Refresh when window regains focus or tab becomes visible
  useEffect(() => {
    const onFocus = () => tryAutoRefresh('focus');
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tryAutoRefresh('visibility');
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [tryAutoRefresh]);

  // Refresh when user scrolls near bottom (acts like infinite check for updates)
  useEffect(() => {
    const threshold = 200; // px from bottom
    const onScroll = () => {
      const scrolledToBottom = window.innerHeight + window.scrollY >= (document.body.offsetHeight - threshold);
      if (scrolledToBottom) {
        tryAutoRefresh('scroll-bottom');
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [tryAutoRefresh]);

  const handleQRGenerate = (fileId: string) => {
    setFiles(prev =>
      prev.map(file =>
        file.id === fileId ? { ...file, qrCode: "generated" } : file
      )
    );
  };

  // Listen for storage events to detect new file uploads from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'newFileUploaded' && e.newValue) {
        // New file uploaded, refresh the list
        refreshFiles();
        // Clear the storage event
        localStorage.removeItem('newFileUploaded');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshFiles]);

  const handleDeleteFile = useCallback(async (fileId: string) => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    // Optimistic update - remove from UI immediately
    const originalFiles = [...files];
    setFiles(prev => prev.filter(file => file.id !== fileId));
    setError(''); // Clear any previous errors

    try {
      const response = await fetch(`/api/files?fileId=${fileId}&userId=${user.userId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (!result.success) {
        // Revert optimistic update on failure
        setFiles(originalFiles);
        throw new Error(result.message || 'Failed to delete file');
      }
      
      // Update cached data as well
      filesDataRef.current = filesDataRef.current.filter(file => file.id !== fileId);
      
    } catch (error: any) {
      // Revert optimistic update on error
      setFiles(originalFiles);
      setError(error.message || 'Failed to delete file. Please try again.');
    }
  }, [user, files]);

  const downloadCompletedFile = useCallback(async (completedFileId: string, filename: string) => {
    if (!user) return;
    
    try {
      // Show download progress
      setError(''); // Clear any previous errors
      
      const response = await fetch(`/api/files/completed/${completedFileId}/download?userId=${user.userId}`);
      if (response.ok) {
        // Get file size for progress tracking
        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        
        // Create download with progress
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Failed to read file stream');
        
        const chunks: Uint8Array[] = [];
        let received = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          received += value.length;
          
          // Update progress if we know the total size
          if (total > 0) {
            const progress = Math.round((received / total) * 100);
            if (process.env.NODE_ENV === 'development') {
              console.log(`Download progress: ${progress}%`);
            }
          }
        }
        
        // Combine chunks and create blob
        const blob = new Blob(chunks as BlobPart[], { type: response.headers.get('content-type') || 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
        
      } else {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to download completed file. Please try again.');
    }
  }, [user]);



  // Show loading if checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please log in to view your files</h1>
          <a href="/login" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-200 rounded"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Pull-to-refresh indicator area at top */}
      <div
        className="sticky top-0 z-10 flex items-center justify-center"
        style={{ height: pullDistance ? Math.min(64, pullDistance) : 0 }}
      >
        {pullDistance > 0 && (
          <div className="flex items-center space-x-2 text-blue-600 text-sm">
            {pullDistance < 64 ? (
              <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
            <span>{pullDistance < 64 ? 'Pull to refresh' : 'Release to refresh'}</span>
          </div>
        )}
      </div>
      <main
        className="container mx-auto px-3 sm:px-4 py-4 sm:py-8"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap gap-3 justify-between items-center mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Files</h1>
            <Link
              href="/upload"
              className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload New File
            </Link>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
              <div className="flex space-x-1 overflow-x-auto no-scrollbar [-ms-overflow-style:none] [scrollbar-width:none] pb-1 sm:pb-0">
                {[
                  { key: "all", label: "All Files" },
                  { key: "pending_payment", label: "Pending Payment" },
                  { key: "paid", label: "Paid" },
                  { key: "processing", label: "Processing" },
                  { key: "completed", label: "Completed" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key as any)}
                    className={`px-2 sm:px-3 md:px-4 py-2 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                      filter === tab.key
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex space-x-2">
              </div>
            </div>
          </div>


          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
              {error}
            </div>
          )}

          {/* Files List */}
          {filteredFiles.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 mb-4">
                  {filter === "all" ? "No files uploaded yet" : `No ${filter} files`}
                </p>
                <Link
                  href="/upload"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Upload Your First Document
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredFiles.map((file) => (
                <div key={file.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="p-4 sm:p-6">
                    {/* File Header */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                        {getFileIcon(file.type)}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{file.name}</h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                            <p className="text-sm text-gray-500">
                              {formatFileSize(file.size)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {file.uploadDate.toLocaleDateString()}
                            </p>
                            {file.status === "processing" && file.processingStartedAt && (
                              <p className="text-sm text-blue-600">
                                Processing since: {(() => { try { const d = new Date(file.processingStartedAt as any); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(); } catch { return '—'; } })()}
                              </p>
                            )}
                            {file.status === "completed" && file.completedAt && (
                              <p className="text-sm text-green-600">
                                Completed: {(() => { try { const d = new Date(file.completedAt as any); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(); } catch { return '—'; } })()}
                              </p>
                            )}
                            {file.completedFile && (
                              <p className="text-sm text-gray-500">
                                by {file.completedFile.agentName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 ml-2 sm:ml-4 shrink-0">
                        {getStatusBadge(file.status)}
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-semibold text-gray-900">
                            ₹{file.paymentAmount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 sm:pt-4 border-t border-gray-100">
                      <div className="flex flex-wrap items-center gap-2">
                        {(file.status === "pending_payment") && (
                          <>
                            <LazyPaymentButton
                              amount={file.paymentAmount}
                              fileId={file.id}
                              onSuccess={() => handlePaymentSuccess(file.id)}
                              onError={(error) => setError(error)}
                            />
                            <LazyQRCodeDisplay
                              fileId={file.id}
                              onGenerate={() => handleQRGenerate(file.id)}
                            />
                          </>
                        )}
                        {/* QR code only shows for pending payments, not for paid */}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/files/view/${file.id}`}
                          className="inline-flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </Link>
                        
                        {file.status === "completed" && file.completedFile && (
                          <button 
                            onClick={() => downloadCompletedFile(file.completedFile!.id, file.completedFile!.originalName)}
                            className="inline-flex items-center px-3 sm:px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download Completed
                          </button>
                        )}
                        
                        <button 
                          onClick={() => handleDeleteFile(file.id)}
                          className="inline-flex items-center px-3 sm:px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Agent Response */}
                    {file.agentResponse && (
                      <AgentResponse response={file.agentResponse} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="mt-6 sm:mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{files.length}</div>
              <div className="text-xs sm:text-sm text-gray-500">Total Files</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-yellow-600">
                {files.filter(f => f.status === "pending_payment").length}
              </div>
              <div className="text-xs sm:text-sm text-gray-500">Pending Payment</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                {files.filter(f => f.status === "paid" || f.status === "processing" || f.status === "completed").length}
              </div>
              <div className="text-xs sm:text-sm text-gray-500">Paid</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                {files.filter(f => f.status === "completed").length}
              </div>
              <div className="text-xs sm:text-sm text-gray-500">Completed</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
