"use client";

import { useAuthContext } from "@/components/AuthProvider";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatFileSize, getFileIconLarge } from "@/lib/fileUtils";

interface FileData {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  status: string;
  uploadedAt: string;
  filePath: string;
  metadata: any;
  userComment?: string;
  userCommentUpdatedAt?: string;
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
  } | null;
  completedFileId?: string | null;
}

export default function ViewDocumentPage() {
  const { user, loading: authLoading } = useAuthContext();
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");
  const isLoadingRef = useRef(false); // Prevent duplicate requests
  const fileCacheRef = useRef<Map<string, { file: FileData; content: string; timestamp: number }>>(new Map());
  const hasFetchedRef = useRef(false); // Prevent duplicate initial fetches
  const userIdRef = useRef<string | null>(null); // Track user ID changes

  const loadFile = useCallback(async (force: boolean = false) => {
    if (!user || !fileId || (isLoadingRef.current && !force)) return;
    
    // Prevent duplicate fetches for the same user and file (unless forced)
    if (!force && hasFetchedRef.current && userIdRef.current === user.userId) {
      return;
    }

    // Check cache first
    const cacheKey = `${fileId}-${user.userId}`;
    const cached = fileCacheRef.current.get(cacheKey);
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    if (!force && cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      setFile(cached.file);
      setFileContent(cached.content);
      setLoading(false);
      return;
    }

    try {
      isLoadingRef.current = true;
      hasFetchedRef.current = true;
      userIdRef.current = user.userId;
      setLoading(true);
      setError("");

      // Fetch file details first
      const fileResponse = await fetch(`/api/files?fileId=${fileId}&userId=${user.userId}`);
      const fileResult = await fileResponse.json();

      if (!fileResult.success) {
        throw new Error(fileResult.message || 'Failed to load file');
      }

      if (!fileResult.file) {
        throw new Error('File not found');
      }

      setFile(fileResult.file);

      // Load file content with better error handling
      await loadFileContent(fileResult.file);

      // Cache the result
      fileCacheRef.current.set(cacheKey, {
        file: fileResult.file,
        content: (fileContent || ''),
        timestamp: Date.now()
      });

    } catch (error: any) {
      setError(error.message || "Failed to load file. Please try again.");
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [user?.userId, fileId]);

  const loadFileContent = useCallback(async (fileData: FileData) => {
    try {
      setContentLoading(true);
      setContentError("");

      // Detect if running in WebView (Android app)
      const isWebView = /(wv|WebView|; wv\))/i.test(navigator.userAgent) || 
                       (!/Chrome\//i.test(navigator.userAgent) && /Version\//i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent));
      
      // Lower limits for WebView environments (Android apps)
      const MAX_BROWSER_RENDER_SIZE = isWebView ? 5 * 1024 * 1024 : 10 * 1024 * 1024; // 5MB for WebView, 10MB for browser
      
      if (fileData.size > MAX_BROWSER_RENDER_SIZE) {
        const sizeMB = Math.round(fileData.size / 1024 / 1024);
        const limitMB = Math.round(MAX_BROWSER_RENDER_SIZE / 1024 / 1024);
        setContentError(`File is too large (${sizeMB}MB) to preview in ${isWebView ? 'mobile app' : 'browser'}. Maximum size is ${limitMB}MB. Please download to view.`);
        setFileContent(null);
        return;
      }

      // Decide which content to fetch: agent-completed file (if available) or original upload
      let contentResponse: Response;
      if (fileData?.status === 'completed' && fileData?.completedFileId) {
        contentResponse = await fetch(`/api/files/completed/${fileData.completedFileId}/download?userId=${user?.userId}`);
      } else {
        contentResponse = await fetch(`/api/files/content?fileId=${fileId}&userId=${user?.userId}`);
      }
      
      if (contentResponse.ok) {
        const blob = await contentResponse.blob();
        
        // Check if blob is too large for browser
        if (blob.size > MAX_BROWSER_RENDER_SIZE) {
          setContentError(`File content is too large (${Math.round(blob.size / 1024 / 1024)}MB) to preview in browser. Please download to view.`);
          setFileContent(null);
          return;
        }

        const url = URL.createObjectURL(blob);
        setFileContent(url);
      } else {
        throw new Error(`Failed to load file content: ${contentResponse.status}`);
      }
    } catch (error: any) {
      setContentError(error.message || "Failed to load file content");
      setFileContent(null);
    } finally {
      setContentLoading(false);
    }
  }, [user, fileId]);

  useEffect(() => {
    if (user && !authLoading && fileId) {
      loadFile();
    }
  }, [user?.userId, authLoading, fileId, loadFile]);

  // Using shared utility functions from fileUtils

  const renderFileContent = useCallback(() => {
    if (!file || !fileContent) return null;

    // Detect if running in WebView (Android app)
    const isWebView = /(wv|WebView|; wv\))/i.test(navigator.userAgent) || 
                     (!/Chrome\//i.test(navigator.userAgent) && /Version\//i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent));

    if (file.mimeType.includes("image")) {
      return (
        <div className="flex justify-center">
          <img 
            src={fileContent} 
            alt={file.originalName}
            className={`max-w-full object-contain rounded-lg shadow-lg ${
              isWebView 
                ? 'max-h-48 sm:max-h-64' // Smaller height for WebView
                : 'max-h-64 sm:max-h-80 md:max-h-96'
            }`}
            onError={() => setContentError("Failed to load image. Please download to view.")}
            loading="lazy"
          />
        </div>
      );
    }

    if (file.mimeType === "application/pdf") {
      return (
        <div className="w-full">
          <div className="bg-gray-100 p-2 rounded-t-lg flex items-center justify-between">
            <span className="text-sm text-gray-600">PDF Document</span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB</span>
              <a 
                href={fileContent} 
                download={file.originalName}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Download
              </a>
            </div>
          </div>
          <div className={`w-full ${
            isWebView 
              ? 'h-64 sm:h-80' // Smaller height for WebView
              : 'h-96 sm:h-[500px] md:h-[600px] lg:h-[700px]'
          }`}>
            {isWebView ? (
              // For WebView, use a more compatible approach
              <div className="w-full h-full border rounded-b-lg shadow-lg bg-gray-50 flex flex-col items-center justify-center">
                <div className="text-center p-4">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-gray-600 mb-3">PDF Preview not available in mobile app</p>
                  <a 
                    href={fileContent} 
                    download={file.originalName}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Download PDF
                  </a>
                </div>
              </div>
            ) : (
              <iframe
                src={fileContent}
                className="w-full h-full border-0 rounded-b-lg shadow-lg"
                title={file.originalName}
                onError={() => setContentError("Failed to load PDF preview. Please download to view.")}
              />
            )}
          </div>
        </div>
      );
    }

    if (file.mimeType.includes("text")) {
      return (
        <div className="bg-gray-50 p-3 sm:p-4 md:p-6 rounded-lg">
          <pre className="whitespace-pre-wrap text-xs sm:text-sm font-mono overflow-x-auto">
            {fileContent}
          </pre>
        </div>
      );
    }

    return (
      <div className="text-center py-6 sm:py-8">
        <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          {getFileIconLarge(file.mimeType)}
        </div>
        <p className="text-sm sm:text-base text-gray-500 mb-3 sm:mb-4">
          Preview not available for this file type
        </p>
        <a 
          href={fileContent} 
          download={file.originalName}
          className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          Download File
        </a>
      </div>
    );
  }, [file, fileContent, getFileIconLarge]);

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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please log in to view documents</h1>
          <a href="/login" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button 
              onClick={() => router.back()}
              className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700"
            >
              Go Back
            </button>
            <Link
              href="/files"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              My Files
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">File not found</h1>
          <p className="text-gray-600 mb-6">The requested file could not be found.</p>
          <Link
            href="/files"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Back to My Files
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 py-3 sm:py-4">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
              <button 
                onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700 flex-shrink-0"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                <div className="flex-shrink-0">
                  {getFileIconLarge(file.mimeType)}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-sm sm:text-lg font-semibold text-gray-900 truncate">{file.originalName}</h1>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              <Link
                href="/files"
                className="text-gray-500 hover:text-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium"
              >
                My Files
              </Link>
              <a 
                href={fileContent || '#'} 
                download={file.originalName}
                className="bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 md:py-8">
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6">
          {contentLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading document...</span>
            </div>
          )}
          
          {contentError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">Preview Not Available</h3>
                  <p className="text-sm text-yellow-700 mt-1">{contentError}</p>
                  {/(wv|WebView|; wv\))/i.test(navigator.userAgent) && (
                    <p className="text-xs text-yellow-600 mt-1">
                      💡 Tip: Some files work better in the web browser version of this app.
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <a 
                  href={fileContent || '#'} 
                  download={file?.originalName}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors text-center"
                >
                  Download File
                </a>
                {/(wv|WebView|; wv\))/i.test(navigator.userAgent) && (
                  <a 
                    href={window.location.href.replace(/^https?:\/\/[^\/]+/, 'https://your-website-domain.com')}
                    target="_blank"
                    className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors text-center"
                  >
                    Open in Browser
                  </a>
                )}
              </div>
            </div>
          )}
          
          {!contentLoading && !contentError && renderFileContent()}
        </div>

        {/* User Comment Section */}
        {file.userComment && (
          <div className="mt-6 bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-purple-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Your Comment</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{file.userComment}</p>
                {file.userCommentUpdatedAt && (
                  <p className="text-xs text-gray-500 mt-2">
                    Updated: {new Date(file.userCommentUpdatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

