"use client";

import { LazyQRCodeDisplay } from "@/components/LazyQRCodeDisplay";
import { LazyPaymentButton } from "@/components/LazyPaymentButton";
import { AgentResponse } from "@/components/AgentResponse";
import { useAuthContext } from "@/components/AuthProvider";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { formatFileSize, getFileIcon, getStatusBadge } from "@/lib/fileUtils";

interface FileData {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "pending_payment" | "paid" | "processing" | "completed" | "replacement";
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
  editTimerMinutes?: number;
  editTimerStartedAt?: string;
}

export default function FilesPage() {
  const { user, loading: authLoading } = useAuthContext();
  
  // Initialize with cached data if available (instant render)
  const [files, setFiles] = useState<FileData[]>(() => {
    try {
      // Try to get cached files from ref (will be set after first load)
      // For now, start empty but will populate immediately if cache exists
      return [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending_payment" | "paid" | "processing" | "completed">("all");
  const [error, setError] = useState("");
  const isLoadingFilesRef = useRef(false); // Prevent duplicate requests
  const lastFetchTimeRef = useRef<number>(0); // Track last fetch time
  const filesDataRef = useRef<FileData[]>([]); // Cache files data
  const lastUserIdRef = useRef<string | null>(null); // Track last user ID
  const [contactNumbers, setContactNumbers] = useState<string[]>([]); // Contact numbers for processing files
  const abortControllerRef = useRef<AbortController | null>(null); // For request cancellation

  // Memoize localStorage reads to prevent blocking on every render
  const localStorageCache = useMemo(() => {
    try {
      const paidIds = localStorage.getItem('paidFileIds');
      const deletedIds = localStorage.getItem('deletedFileIds');
      const lastDeleteTime = localStorage.getItem('lastFileDeleteTime');
      
      return {
        paidIds: new Set((paidIds ? JSON.parse(paidIds) : []) as string[]),
        deletedIds: new Set((deletedIds ? JSON.parse(deletedIds) : []) as string[]),
        lastDeleteTime: lastDeleteTime ? parseInt(lastDeleteTime, 10) : 0
      };
    } catch {
      return {
        paidIds: new Set<string>(),
        deletedIds: new Set<string>(),
        lastDeleteTime: 0
      };
    }
  }, [files.length]); // Only recalculate when files length changes

  // Smart loading function that only fetches when needed
  const loadFiles = useCallback(async (forceRefresh = false) => {
    if (!user || isLoadingFilesRef.current) return; // Prevent duplicate requests
    
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const now = Date.now();
    
    // Check if there was a recent delete - if so, force refresh to bypass cache
    let shouldForceRefresh = forceRefresh;
    const timeSinceDelete = now - localStorageCache.lastDeleteTime;
    if (timeSinceDelete < 30000) {
      shouldForceRefresh = true;
      // Also clear any cached data to prevent showing stale data
      filesDataRef.current = [];
      lastFetchTimeRef.current = 0;
    }
    
    // Simple cache - only use cached data if not forcing refresh and data exists
    // Show cached data immediately for instant render
    if (!shouldForceRefresh && filesDataRef.current.length > 0) {
      setFiles(filesDataRef.current);
      setIsLoading(false);
      // Don't fetch in background here - let the useEffect handle it
      return;
    }
    
    try {
      isLoadingFilesRef.current = true;
      setIsLoading(true);
      setError("");
      
      // Create new abort controller for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Reduced to 8s for faster response
      
      // Add cache-busting parameter to bypass any caching layers
      const url = `/api/files?userId=${user.userId}&_t=${Date.now()}`;

      let response;
      try {
        response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
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
      
      // Use cached localStorage values instead of reading again
      const localPaidIds = localStorageCache.paidIds;
      const localDeletedIds = localStorageCache.deletedIds;

      // Transform the data to match our interface
      const transformedFiles: FileData[] = result.files
        .filter((file: any) => !localDeletedIds.has(file.id)) // Filter out locally deleted files
        .map((file: any) => {
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
            case 'assigned':
              // CRITICAL FIX: When admin assigns the file, keep showing as "paid"
              // User doesn't need to know about internal assignment - they already paid
              // Only show "processing" when agent actually starts working
              uiStatus = 'paid';
              break;
            case 'processing':
              uiStatus = 'processing';
              break;
            case 'completed':
              uiStatus = 'completed';
              break;
            case 'replacement':
              // Replacement files should show as "paid" - no payment needed
              uiStatus = 'paid';
              break;
            default:
              uiStatus = 'pending_payment';
          }
          // If we have a locally recorded paid status and server hasn't caught up yet,
          // keep showing as paid until backend updates to processing/completed.
          if ((uiStatus === 'pending_payment') && localPaidIds.has(file.id)) {
            uiStatus = 'paid';
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
            completedFileId: file.completedFileId,
            // Timer data
            editTimerMinutes: file.editTimerMinutes,
            editTimerStartedAt: file.editTimerStartedAt
          };
        });
      
      // Cache the data and update timestamp
      filesDataRef.current = transformedFiles;
      lastFetchTimeRef.current = now;
      setFiles(transformedFiles);

      // Cleanup local overrides when server shows completed (or file missing)
      try {
        const key = 'paidFileIds';
        const raw = localStorage.getItem(key);
        const existing: string[] = raw ? JSON.parse(raw) : [];
        if (existing.length) {
          const stillPendingIds = new Set(transformedFiles
            .filter(f => f.status === 'paid' || f.status === 'pending_payment' || f.status === 'processing')
            .map(f => f.id));
          const cleaned = existing.filter(id => stillPendingIds.has(id));
          if (cleaned.length !== existing.length) {
            localStorage.setItem(key, JSON.stringify(cleaned));
          }
        }
      } catch {}

      // Cleanup deleted file IDs when they're confirmed gone from server
      try {
        const deletedKey = 'deletedFileIds';
        const deletedRaw = localStorage.getItem(deletedKey);
        const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
        if (deletedIds.length) {
          const existingIds = new Set(result.files.map((f: any) => f.id));
          const stillDeleted = deletedIds.filter(id => existingIds.has(id));
          // If server no longer has these files, remove from deleted tracking
          if (stillDeleted.length !== deletedIds.length) {
            const confirmed = deletedIds.filter(id => !existingIds.has(id));
            if (confirmed.length === 0) {
              // All deleted files confirmed gone, clean up the timestamp too
              localStorage.removeItem('lastFileDeleteTime');
              localStorage.removeItem(deletedKey);
            } else {
              localStorage.setItem(deletedKey, JSON.stringify(confirmed));
            }
          }
        }
      } catch {}
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
      abortControllerRef.current = null;
    }
  }, [user, localStorageCache]);

  // Single useEffect to load files when user is available
  useEffect(() => {
    if (user && !authLoading && !isLoadingFilesRef.current) {
      // Check if this is a different user or first load
      const isNewUser = lastUserIdRef.current !== user.userId;
      lastUserIdRef.current = user.userId;
      
      // Show cached data immediately for instant render
      if (filesDataRef.current.length > 0 && !isNewUser) {
        setFiles(filesDataRef.current);
        setIsLoading(false);
        // Then fetch fresh data in background (non-blocking)
        setTimeout(() => loadFiles(false), 100);
      } else if (isNewUser) {
        // New user - fetch immediately
        loadFiles(false);
      }
    }
  }, [user, authLoading, loadFiles]);

  // Add timeout for auth loading to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (authLoading) {
        console.warn('Auth loading timeout - proceeding without user');
      }
    }, 2000); // Reduced to 2 seconds for faster page load

    return () => clearTimeout(timeout);
  }, [authLoading]);

  // No auto-refresh - only fetch on page load or manual refresh

  // Fetch contact numbers only on page load/refresh - no background polling
  // Always fetch on page load to ensure cache exists, even if no processing files yet
  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      // Load cached contact numbers immediately on mount (instant display)
      try {
        const cached = localStorage.getItem('contact_numbers_cache');
        if (cached) {
          const cachedData = JSON.parse(cached);
          const cacheTime = cachedData.timestamp || 0;
          const now = Date.now();
          const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
          
          // Use cached data if still fresh
          if (now - cacheTime < cacheDuration && cachedData.contactNumbers && cachedData.isActive) {
            if (isMounted) {
              setContactNumbers(cachedData.contactNumbers);
            }
          }
        }
      } catch (error) {
        // Ignore cache errors
      }

      const fetchContactNumbers = async () => {
        if (!isMounted) return;
        
        try {
          // Check version first to see if cache is stale
          const versionResponse = await fetch('/api/contact-numbers?version=true');
          if (versionResponse.ok) {
            const versionData = await versionResponse.json();
            const newChecksum = versionData.checksum;
            
            // Check if cached checksum matches
            let cachedChecksum: string | null = null;
            try {
              const cached = localStorage.getItem('contact_numbers_cache');
              if (cached) {
                const cachedData = JSON.parse(cached);
                cachedChecksum = cachedData.checksum || null;
              }
            } catch {
              // Ignore
            }
            
            // Only fetch full contact numbers if checksum changed or no cache
            if (!cachedChecksum || cachedChecksum !== newChecksum) {
              const response = await fetch('/api/contact-numbers');
              if (response.ok && isMounted) {
                const data = await response.json();
                if (data.success && data.isActive) {
                  // Always cache contact numbers, even if no processing files yet
                  // This ensures they're available when files become processing
                  const contactNums = data.contactNumbers || [];
                  
                  // Always cache in localStorage with checksum
                  try {
                    localStorage.setItem('contact_numbers_cache', JSON.stringify({
                      contactNumbers: contactNums,
                      isActive: data.isActive,
                      checksum: data.checksum,
                      timestamp: Date.now()
                    }));
                  } catch (cacheError) {
                    // Ignore localStorage errors
                  }
                  
                  // Set state if there are processing files (check again after fetch)
                  const hasProcessingFiles = files.some(f => f.status === 'processing');
                  if (hasProcessingFiles && isMounted) {
                    setContactNumbers(contactNums);
                  }
                } else {
                  // Feature is inactive, clear cache
                  if (isMounted) {
                    setContactNumbers([]);
                  }
                  try {
                    localStorage.removeItem('contact_numbers_cache');
                  } catch {
                    // Ignore
                  }
                }
              }
            } else {
              // Cache is still valid, no need to fetch
              // Contact numbers already set from cache above if processing files exist
              // But check again in case files loaded after cache was set
              const hasProcessingFiles = files.some(f => f.status === 'processing');
              if (hasProcessingFiles && isMounted) {
                try {
                  const cached = localStorage.getItem('contact_numbers_cache');
                  if (cached) {
                    const cachedData = JSON.parse(cached);
                    if (cachedData.contactNumbers && cachedData.isActive) {
                      setContactNumbers(cachedData.contactNumbers);
                    }
                  }
                } catch {
                  // Ignore
                }
              }
            }
          }
        } catch (error) {
          // Silent fail - contact numbers are not critical
          if (process.env.NODE_ENV === 'development') {
            console.error('Error fetching contact numbers:', error);
          }
        }
      };

      // Fetch contact numbers on page load/refresh
      // Always fetch to ensure cache exists for when files become processing
      // If cache exists, check version first (lightweight)
      // If no cache, fetch full contact numbers
      await fetchContactNumbers();
    };

    init();
    
    return () => {
      isMounted = false;
    };
  }, []); // Only run on mount/refresh, not when files change

  // Load cached contact numbers when files change to processing status
  // This doesn't fetch from API, just loads from cache
  useEffect(() => {
    const hasProcessingFiles = files.some(f => f.status === 'processing');
    
    if (hasProcessingFiles) {
      // Load from cache if available (no API call)
      // Always try to load from cache when processing files exist
      try {
        const cached = localStorage.getItem('contact_numbers_cache');
        if (cached) {
          const cachedData = JSON.parse(cached);
          const cacheTime = cachedData.timestamp || 0;
          const now = Date.now();
          const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
          
          // Use cached data if still fresh and active
          if (now - cacheTime < cacheDuration && cachedData.contactNumbers && cachedData.isActive) {
            setContactNumbers(cachedData.contactNumbers);
            return; // Successfully loaded from cache
          }
        }
        // If we get here, cache doesn't exist or is stale
        // Don't clear contact numbers - they might have been set by the first useEffect
        // The first useEffect will handle fetching if needed
      } catch (error) {
        // Ignore cache errors - don't clear contact numbers
      }
    } else {
      // No processing files, clear contact numbers
      setContactNumbers([]);
    }
  }, [files]); // Watch files array for status changes

  // Using shared utility functions from fileUtils

  // Helper to safely format dates (memoized per file to avoid recalculation)
  const formatDateSafe = useCallback((dateString: string | undefined): string => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString as any);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
    } catch {
      return '—';
    }
  }, []);

  // Memoize filtered files to prevent unnecessary recalculations
  const filteredFiles = useMemo(() => 
    files.filter(file => filter === "all" || file.status === filter),
    [files, filter]
  );

  // Memoize stats to prevent recalculation on every render
  const fileStats = useMemo(() => ({
    total: files.length,
    pendingPayment: files.filter(f => f.status === "pending_payment").length,
    paid: files.filter(f => f.status === "paid" || f.status === "processing" || f.status === "completed").length,
    completed: files.filter(f => f.status === "completed").length
  }), [files]);

  const hasActiveFiles = useMemo(() =>
    files.some(f => f.status === "pending_payment" || f.status === "paid" || f.status === "processing"),
  [files]);

  const handlePaymentSuccess = useCallback((fileId: string) => {
    // Update local state immediately for better UX
    setFiles(prev => 
      prev.map(file =>
        file.id === fileId ? { ...file, status: "paid" as const } : file
      )
    );
    
    // Also update cached data
    filesDataRef.current = filesDataRef.current.map(file =>
      file.id === fileId ? { ...file, status: "paid" as const } : file
    );

    // Persist paid status locally to survive refresh (async to not block UI)
    requestIdleCallback(() => {
      try {
        const key = 'paidFileIds';
        const existingRaw = localStorage.getItem(key);
        const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
        if (!existing.includes(fileId)) {
          localStorage.setItem(key, JSON.stringify([...existing, fileId]));
        }
      } catch {}
    }, { timeout: 500 });

    // Force refresh from server to ensure payment status is persisted
    setTimeout(() => {
      loadFiles(true);
    }, 1000);
  }, [loadFiles]);

  // Manual refresh function (called by pull-to-refresh only)
  const refreshFiles = useCallback(() => {
    loadFiles(true); // Force refresh
  }, [loadFiles]);

  

  // Pull-to-refresh state (increased threshold to prevent accidental triggers)
  const [pullDistance, setPullDistance] = useState(0);
  const isPullingRef = useRef(false);
  const pullStartYRef = useRef<number | null>(null);
  const PULL_THRESHOLD_PX = 100; // release threshold (increased from 64 to prevent accidents)
  const PULL_MAX_PX = 150; // visual limit (increased from 128)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 5) return; // only when scrolled to very top (5px tolerance)
    isPullingRef.current = true;
    pullStartYRef.current = e.touches[0].clientY;
    setPullDistance(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current || pullStartYRef.current == null) return;
    const currentY = e.touches[0].clientY;
    const delta = Math.max(0, currentY - pullStartYRef.current);
    if (delta > 10) { // Need at least 10px pull before activating
      // prevent page scroll while pulling
      e.preventDefault();
      const eased = Math.min(PULL_MAX_PX, delta * 0.5); // more resistance (0.5 instead of 0.6)
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
      refreshFiles(); // Manual refresh via pull-to-refresh
    }
  }, [pullDistance, refreshFiles]);

  

  // REMOVED auto-refresh on focus/visibility/scroll - too annoying for users
  // Users can manually refresh by pull-to-refresh or reload button

  const handleQRGenerate = useCallback((fileId: string) => {
    // Use functional update to avoid dependencies
    setFiles(prev =>
      prev.map(file =>
        file.id === fileId ? { ...file, qrCode: "generated" } : file
      )
    );
    // Also update cache
    filesDataRef.current = filesDataRef.current.map(file =>
      file.id === fileId ? { ...file, qrCode: "generated" } : file
    );
  }, []);

  // REMOVED: Storage event auto-refresh - causes unexpected page refreshes
  // Users can manually refresh if needed

  const handleDeleteFile = useCallback(async (fileId: string) => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    // Check if file exists in current state (prevent double-delete)
    const fileExists = files.some(file => file.id === fileId);
    if (!fileExists) {
      setError('File already deleted');
      return;
    }

    // Optimistic update - remove from UI immediately
    const originalFiles = [...files];
    const originalCachedFiles = [...filesDataRef.current];
    
    setFiles(prev => prev.filter(file => file.id !== fileId));
    filesDataRef.current = filesDataRef.current.filter(file => file.id !== fileId);
    setError('');

    try {
      const response = await fetch(`/api/files?fileId=${fileId}&userId=${user.userId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (!result.success) {
        // Revert optimistic update on failure
        setFiles(originalFiles);
        filesDataRef.current = originalCachedFiles;
        throw new Error(result.message || 'Failed to delete file');
      }
      
      // Remove from localStorage overrides (async to not block UI)
      requestIdleCallback(() => {
        try {
          const key = 'paidFileIds';
          const raw = localStorage.getItem(key);
          const existing: string[] = raw ? JSON.parse(raw) : [];
          if (existing.includes(fileId)) {
            localStorage.setItem(key, JSON.stringify(existing.filter(id => id !== fileId)));
          }
        } catch {}
        
        // Track deleted file ID to prevent it from showing up again
        try {
          const deletedKey = 'deletedFileIds';
          const deletedRaw = localStorage.getItem(deletedKey);
          const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
          if (!deletedIds.includes(fileId)) {
            localStorage.setItem(deletedKey, JSON.stringify([...deletedIds, fileId]));
          }
        } catch {}
        
        // Don't set lastFileDeleteTime - it was causing unwanted refreshes
        // The optimistic update already removed it from UI
      }, { timeout: 500 });

      try {
        localStorage.setItem('fileDeleted', JSON.stringify({ id: fileId, timestamp: Date.now() }));
      } catch {}

      // Force refresh to ensure the deleted file doesn't reappear from caches
      setTimeout(() => {
        if (!isLoadingFilesRef.current) {
          loadFiles(true).catch(() => {});
        }
      }, 100);

    } catch (error: any) {
      // Revert optimistic update on error
      setFiles(originalFiles);
      filesDataRef.current = originalCachedFiles;
      setError(error.message || 'Failed to delete file. Please try again.');
    }
  }, [user, files]);

  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [timerCountdown, setTimerCountdown] = useState<Map<string, number>>(new Map());
  
  // Timer countdown effect
  useEffect(() => {
    const interval = setInterval(() => {
      const newCountdown = new Map<string, number>();
      files.forEach(file => {
        if (file.status === "completed" && file.editTimerMinutes && file.editTimerStartedAt) {
          const startTime = new Date(file.editTimerStartedAt).getTime();
          const timerDuration = file.editTimerMinutes * 60 * 1000;
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, timerDuration - elapsed);
          if (remaining > 0) {
            newCountdown.set(file.id, remaining);
          }
        }
      });
      setTimerCountdown(newCountdown);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [files]);

  const downloadCompletedFile = useCallback(async (completedFileId: string, filename: string) => {
    if (!user) return;
    
    // Prevent multiple clicks for the same file
    if (downloadingFiles.has(completedFileId)) return;
    
    // Mark as downloading
    setDownloadingFiles(prev => new Set(prev).add(completedFileId));
    
    try {
      setError(''); // Clear any previous errors
      
      // OPTIMIZED: Get pre-signed URL (instant response <100ms)
      // Same logic as agent portal - direct download using window.location
      const response = await fetch(`/api/files/completed/${completedFileId}/download-url?userId=${user.userId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.downloadUrl) {
          // FIXED: Direct download using window.location
          // The Content-Disposition: attachment header forces download
          window.location.href = data.downloadUrl;
        } else {
          setError(data.error || 'Failed to download file');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to download file');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to download completed file. Please try again.');
    } finally {
      // Re-enable button after 500ms
      setTimeout(() => {
        setDownloadingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(completedFileId);
          return newSet;
        });
      }, 500);
    }
  }, [user, downloadingFiles]);

  useEffect(() => {
    if (!user) return;

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return;

      if (event.key === 'newFileUploaded' && !isLoadingFilesRef.current) {
        localStorage.removeItem('newFileUploaded');
        loadFiles(true).catch(() => {});
      }

      if (event.key === 'fileDeleted') {
        try {
          const data = event.newValue ? JSON.parse(event.newValue) : null;
          if (data?.id) {
            // Remove deleted file immediately from state
            setFiles(prev => prev.filter(file => file.id !== data.id));
            filesDataRef.current = filesDataRef.current.filter(file => file.id !== data.id);
            if (!isLoadingFilesRef.current) {
              loadFiles(true).catch(() => {});
            }
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [user, loadFiles]);

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
        style={{ height: pullDistance ? Math.min(100, pullDistance) : 0 }}
      >
        {pullDistance > 0 && (
          <div className="flex items-center space-x-2 text-blue-600 text-sm">
            {pullDistance < 100 ? (
              <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
            <span>{pullDistance < 100 ? 'Pull to refresh' : 'Release to refresh'}</span>
          </div>
        )}
      </div>
      <main
        className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="max-w-4xl mx-auto w-full">
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
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4 sm:mb-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
              <div className="flex space-x-1 overflow-x-auto pb-1 sm:pb-0 -mx-3 sm:mx-0 px-3 sm:px-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e0 transparent' }}>
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
                    className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
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
                <div key={file.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
                  <div className="p-4 sm:p-6">
                    {/* File Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3 sm:mb-4">
                      <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">{getFileIcon(file.type)}</div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{file.name}</h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                            <p className="text-sm text-gray-500">
                              {formatFileSize(file.size)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {file.uploadDate.toLocaleDateString()}
                            </p>
                            {file.status === "processing" && (
                              <div className="text-sm flex flex-wrap items-center gap-x-2 w-full">
                                <span className="text-blue-600">
                                  Processing since: {formatDateSafe(file.processingStartedAt)}
                                </span>
                                {contactNumbers.length > 0 && (
                                  <span className="inline-flex items-center gap-1 text-green-700 font-medium flex-wrap">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <span className="whitespace-normal">For any issue contact: {contactNumbers.map((num, idx) => (
                                      <a key={idx} href={`tel:${num}`} className="hover:underline">
                                        {num}{idx < contactNumbers.length - 1 ? ', ' : ''}
                                      </a>
                                    ))}</span>
                                  </span>
                                )}
                              </div>
                            )}
                            {file.status === "completed" && file.completedAt && (
                              <p className="text-sm text-green-600">
                                Completed: {formatDateSafe(file.completedAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-3 sm:ml-4 shrink-0">
                        {getStatusBadge(file.status)}
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-semibold text-gray-900">
                            ₹{file.paymentAmount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 sm:pt-4 border-t border-gray-100">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Only show payment button for pending_payment status, not for replacement */}
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
                      
                      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:pb-0">
                        <Link
                          href={`/files/view/${file.id}`}
                          className="inline-flex items-center px-2.5 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </Link>
                        
                        {/* Edit button - for pending_payment, paid, processing, replacement status, or if timer is active for completed files */}
                        {(() => {
                          const canEdit = file.status === "pending_payment" || 
                                         file.status === "paid" || 
                                         file.status === "processing" ||
                                         file.status === "replacement";
                          
                          // Check if timer is active for completed files
                          const timeRemaining = timerCountdown.get(file.id) || 0;
                          const timerActive = timeRemaining > 0;
                          
                          const showEdit = canEdit || timerActive;
                          
                          if (!showEdit) return null;
                          
                          return (
                            <Link
                              href={`/files/edit/${file.id}`}
                              className="inline-flex items-center px-2.5 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap flex-shrink-0"
                            >
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                              {timerActive && (
                                <span className="ml-1.5 sm:ml-2 text-xs bg-purple-700 px-1.5 sm:px-2 py-0.5 rounded">
                                  {Math.floor(timeRemaining / 60000)}:{
                                    String(Math.floor((timeRemaining % 60000) / 1000)).padStart(2, '0')
                                  }
                                </span>
                              )}
                            </Link>
                          );
                        })()}
                        
                        {file.status === "completed" && file.completedFileId && (
                          <button 
                            onClick={() => downloadCompletedFile(
                              file.completedFileId || file.id, 
                              file.name
                            )}
                            disabled={downloadingFiles.has(file.completedFileId || file.id)}
                            className="inline-flex items-center px-2.5 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                          >
                            {downloadingFiles.has(file.completedFileId || file.id) ? (
                              <>
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span className="hidden sm:inline">Downloading...</span>
                                <span className="sm:hidden">Loading...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="hidden sm:inline">Download Completed</span>
                                <span className="sm:hidden">Download</span>
                              </>
                            )}
                          </button>
                        )}
                        
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteFile(file.id);
                          }}
                          className="inline-flex items-center px-2.5 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{fileStats.total}</div>
              <div className="text-xs sm:text-sm text-gray-500">Total Files</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-yellow-600">
                {fileStats.pendingPayment}
              </div>
              <div className="text-xs sm:text-sm text-gray-500">Pending Payment</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                {fileStats.paid}
              </div>
              <div className="text-xs sm:text-sm text-gray-500">Paid</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                {fileStats.completed}
              </div>
              <div className="text-xs sm:text-sm text-gray-500">Completed</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
