"use client";

import { useAuthContext } from "@/components/AuthProvider";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface FileData {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  status: string;
  uploadedAt: string;
  paymentAmount: number;
  editTimerMinutes?: number;
  editTimerStartedAt?: string;
}

export default function EditFilePage() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const params = useParams();
  const fileId = params.id as string;

  const [fileData, setFileData] = useState<FileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasFetchedRef = useRef(false); // Prevent duplicate fetches
  const userIdRef = useRef<string | null>(null); // Track user ID to prevent re-fetch on user object change

  // Fetch file data - optimized to prevent duplicate calls
  useEffect(() => {
    if (!user || !fileId) return;
    
    // Prevent duplicate fetches for the same user and file
    if (hasFetchedRef.current && userIdRef.current === user.userId) {
      return;
    }
    
    hasFetchedRef.current = true;
    userIdRef.current = user.userId;

    const fetchFileData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/files?fileId=${fileId}&userId=${user.userId}`);
        const result = await response.json();

        if (!result.success) {
          setError(result.message || "File not found");
          return;
        }

        // API returns single 'file' object when fileId is provided
        const file = result.file;

        if (!file) {
          setError("File data not found");
          return;
        }

        // Check if file can be edited
        // Allow editing if:
        // 1. File is not completed, OR
        // 2. File is completed but timer is still active
        let canEdit = file.status !== 'completed';
        
        if (file.status === 'completed') {
          // Check if timer is active
          if (file.editTimerMinutes && file.editTimerStartedAt) {
            const startTime = new Date(file.editTimerStartedAt).getTime();
            const timerDuration = file.editTimerMinutes * 60 * 1000; // Convert to milliseconds
            const elapsed = Date.now() - startTime;
            const timeRemaining = timerDuration - elapsed;
            canEdit = timeRemaining > 0;
            
            if (!canEdit) {
              setError(`Edit timer has expired. You can no longer edit this completed file.`);
              return;
            }
          } else {
            setError(`Cannot edit completed files.`);
            return;
          }
        }

        setFileData({
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          mimeType: file.mimeType,
          status: file.status,
          uploadedAt: file.uploadedAt,
          paymentAmount: 0, // Files don't have paymentAmount in the API response
          editTimerMinutes: file.editTimerMinutes,
          editTimerStartedAt: file.editTimerStartedAt,
        });
      } catch (err: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error("Failed to fetch file data:", err);
        }
        setError("Failed to load file data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFileData();
  }, [user?.userId, fileId]);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size === 0) {
      setError("File is empty. Please select a valid file.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("File size exceeds 20MB limit.");
      return;
    }

    setSelectedFile(file);
    setError("");

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Handle file upload/replace or comment update
  const handleUpload = async () => {
    if (!user || !fileId) return;
    
    // Check if we have either a file or a comment
    if (!selectedFile && !comment.trim()) return;

    setIsUploading(true);
    setError("");

    try {
      // If only comment is being updated (no file selected)
      if (!selectedFile && comment.trim()) {
        const response = await fetch("/api/files/update-comment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.userId,
            fileId: fileId,
            comment: comment.trim(),
          }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || "Failed to update comment");
        }

        // Success - redirect to files page
        router.push("/files");
        return;
      }

      // If file is being replaced (with or without comment)
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("userId", user.userId);
        formData.append("fileId", fileId);
        
        // Add comment if provided
        if (comment.trim()) {
          formData.append("comment", comment.trim());
        }

        const response = await fetch("/api/files/replace", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || "Failed to replace file");
        }

        // Success - redirect to files page
        router.push("/files");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to update. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Auth check
  if (!user) {
    router.push("/login");
    return null;
  }

  // Error state
  if (error && !fileData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/files"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Files
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/files"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Files
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Edit File</h1>
          <p className="text-gray-600 mt-2">Replace your uploaded file with a new one</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Current File Info */}
        {fileData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current File</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">File Name</p>
                <p className="font-medium text-gray-900">{fileData.originalName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Size</p>
                <p className="font-medium text-gray-900">{formatFileSize(fileData.size)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="font-medium text-gray-900">{fileData.mimeType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  fileData.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                }`}>
                  {fileData.status === 'pending_payment' ? 'Pending Payment' : 'Paid'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload New File</h2>

          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx,.pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.txt,.rtf,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.svg"
            onChange={handleFileSelect}
          />

          {/* Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
          >
            {selectedFile ? (
              <div>
                <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-semibold text-gray-900 mb-2">{selectedFile.name}</p>
                <p className="text-sm text-gray-600 mb-4">{formatFileSize(selectedFile.size)}</p>
                {previewUrl && (
                  <img src={previewUrl} alt="Preview" className="max-w-xs mx-auto rounded-lg shadow-md mb-4" />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-lg font-semibold text-gray-900 mb-2">Click to select a file</p>
                <p className="text-sm text-gray-600">or drag and drop</p>
                <p className="text-xs text-gray-500 mt-2">PDF, Images, Documents (Max 20MB)</p>
              </div>
            )}
          </div>

          {/* Comment Section */}
          <div className="mt-6">
            <label htmlFor="comment" className="block text-sm font-semibold text-gray-900 mb-2">
              Add a Comment (Optional)
            </label>
            <textarea
              id="comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add any notes about this file replacement (e.g., what changed, why you're replacing it)..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-400"
              maxLength={500}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">
                You can add notes about this replacement
              </p>
              <p className="text-xs text-gray-500">
                {comment.length}/500
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <Link
              href="/files"
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleUpload}
              disabled={(!selectedFile && !comment.trim()) || isUploading}
              className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {selectedFile ? 'Uploading...' : 'Updating...'}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {selectedFile ? 'Replace File' : 'Update Comment'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Important Notes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>You can add/update comments without uploading a new file</li>
                <li>You can edit files multiple times, even while they're being processed</li>
                <li>Your file ID and payment status will be preserved</li>
                <li>When replacing files, the old file will be permanently deleted from storage</li>
                <li>Comments are visible to the assigned agent in real-time</li>
                <li>Completed files can be edited within the timer duration set by admin</li>
                <li>Supported formats: PDF, Images, Documents (Max 20MB)</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

