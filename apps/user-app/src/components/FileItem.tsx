"use client";

import { memo, useCallback } from "react";
import Link from "next/link";
import { LazyQRCodeDisplay } from "./LazyQRCodeDisplay";
import { LazyPaymentButton } from "./LazyPaymentButton";

interface FileItemProps {
  file: {
    id: string;
    name: string;
    size: number;
    type: string;
    status: "pending_payment" | "paid" | "processing" | "completed";
    uploadDate: Date;
    paymentAmount: number;
    qrCode?: string;
    agentResponse?: any;
    hasResponse?: boolean;
    agentId?: string;
    assignedAt?: string;
    respondedAt?: string;
    processingStartedAt?: string;
    completedAt?: string;
    completedFile?: any;
    completedFileId?: string;
  };
  onPaymentSuccess: (fileId: string) => void;
  onQRGenerate: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDownloadCompletedFile: (completedFileId: string, filename: string) => void;
  onError: (error: string) => void;
}

export const FileItem = memo(function FileItem({
  file,
  onPaymentSuccess,
  onQRGenerate,
  onDeleteFile,
  onDownloadCompletedFile,
  onError
}: FileItemProps) {
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

  const getStatusBadge = useCallback((status: string) => {
    const statusConfig = {
      pending_payment: { color: "bg-yellow-100 text-yellow-800", text: "Pending Payment" },
      pending: { color: "bg-yellow-100 text-yellow-800", text: "Pending Payment" },
      paid: { color: "bg-green-100 text-green-800", text: "Paid" },
      processing: { color: "bg-blue-100 text-blue-800", text: "Processing" },
      completed: { color: "bg-gray-100 text-gray-800", text: "Completed" }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* File Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4 flex-1">
            {getFileIcon(file.type)}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{file.name}</h3>
              <div className="flex items-center space-x-4 mt-1">
                <p className="text-sm text-gray-500">
                  {formatFileSize(file.size)}
                </p>
                <p className="text-sm text-gray-500">
                  {file.uploadDate.toLocaleDateString()}
                </p>
                {file.status === "processing" && file.processingStartedAt && (
                  <p className="text-sm text-blue-600">
                    Processing since: {new Date(file.processingStartedAt).toLocaleDateString()}
                  </p>
                )}
                {file.status === "completed" && file.completedAt && (
                  <p className="text-sm text-green-600">
                    Completed: {new Date(file.completedAt).toLocaleDateString()}
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
          
          <div className="flex items-center space-x-3 ml-4">
            {getStatusBadge(file.status)}
            <div className="text-right">
              <span className="text-lg font-semibold text-gray-900">
                ₹{file.paymentAmount}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-2">
            {(file.status === "pending_payment") && (
              <>
                <LazyPaymentButton
                  amount={file.paymentAmount}
                  fileId={file.id}
                  onSuccess={() => onPaymentSuccess(file.id)}
                  onError={onError}
                />
                <LazyQRCodeDisplay
                  fileId={file.id}
                  onGenerate={() => onQRGenerate(file.id)}
                />
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Link
              href={`/files/view/${file.id}`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View
            </Link>
            
            {file.status === "completed" && file.completedFile && (
              <button 
                onClick={() => onDownloadCompletedFile(file.completedFile!.id, file.completedFile!.originalName)}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Completed
              </button>
            )}
            
            <button 
              onClick={() => onDeleteFile(file.id)}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
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
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Agent Response</h4>
            <p className="text-gray-700">{file.agentResponse.message}</p>
            {file.agentResponse.agent && (
              <p className="text-sm text-gray-500 mt-2">
                By: {file.agentResponse.agent.name} ({file.agentResponse.agent.email})
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
