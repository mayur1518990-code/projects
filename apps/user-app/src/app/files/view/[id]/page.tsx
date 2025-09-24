"use client";

import { useAuthContext } from "@/components/AuthProvider";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
  const isLoadingRef = useRef(false); // Prevent duplicate requests
  const fileCacheRef = useRef<Map<string, { file: FileData; content: string; timestamp: number }>>(new Map());

  useEffect(() => {
    if (user && !authLoading && fileId) {
      loadFile();
    }
  }, [user, authLoading, fileId]);

  const loadFile = useCallback(async () => {
    if (!user || !fileId || isLoadingRef.current) return;

    // Check cache first
    const cacheKey = `${fileId}-${user.userId}`;
    const cached = fileCacheRef.current.get(cacheKey);
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      setFile(cached.file);
      setFileContent(cached.content);
      setLoading(false);
      return;
    }

    try {
      isLoadingRef.current = true;
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

      // Fetch file content as blob for better performance
      const contentResponse = await fetch(`/api/files/content?fileId=${fileId}&userId=${user.userId}`);
      
      if (contentResponse.ok) {
        const blob = await contentResponse.blob();
        const url = URL.createObjectURL(blob);
        setFileContent(url);
      } else {
        setFileContent(null);
      }

      // Cache the result
      fileCacheRef.current.set(cacheKey, {
        file: fileResult.file,
        content: fileContent || '',
        timestamp: Date.now()
      });

    } catch (error: any) {
      setError(error.message || "Failed to load file. Please try again.");
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [user, fileId]);

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
  }, []);

  const renderFileContent = useCallback(() => {
    if (!file || !fileContent) return null;

    if (file.mimeType.includes("image")) {
      return (
        <div className="flex justify-center">
          <img 
            src={fileContent} 
            alt={file.originalName}
            className="max-w-full max-h-96 object-contain rounded-lg shadow-lg"
          />
        </div>
      );
    }

    if (file.mimeType === "application/pdf") {
      return (
        <div className="w-full h-96">
          <iframe
            src={fileContent}
            className="w-full h-full border-0 rounded-lg shadow-lg"
            title={file.originalName}
          />
        </div>
      );
    }

    if (file.mimeType.includes("text")) {
      return (
        <div className="bg-gray-50 p-6 rounded-lg">
          <pre className="whitespace-pre-wrap text-sm font-mono">
            {fileContent}
          </pre>
        </div>
      );
    }

    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          {getFileIcon(file.mimeType)}
        </div>
        <p className="text-gray-500 mb-4">
          Preview not available for this file type
        </p>
        <a 
          href={fileContent} 
          download={file.originalName}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Download File
        </a>
      </div>
    );
  }, [file, fileContent, getFileIcon]);

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center space-x-3">
                {getFileIcon(file.mimeType)}
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">{file.originalName}</h1>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                href="/files"
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                My Files
              </Link>
              <a 
                href={fileContent || '#'} 
                download={file.originalName}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {renderFileContent()}
        </div>
      </main>
    </div>
  );
}

