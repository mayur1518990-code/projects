"use client";

import { memo } from "react";
import Link from "next/link";
import { LazyQRCodeDisplay } from "./LazyQRCodeDisplay";
import { LazyPaymentButton } from "./LazyPaymentButton";
import { formatFileSize, getFileIcon, getStatusBadge } from "@/lib/fileUtils";

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
  // Using shared utility functions from fileUtils

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-4 sm:p-6">
        {/* File Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4 gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
            <div className="flex-shrink-0">
              {getFileIcon(file.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{file.name}</h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <p className="text-xs sm:text-sm text-gray-500">
                  {formatFileSize(file.size)}
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  {file.uploadDate.toLocaleDateString()}
                </p>
                {file.status === "processing" && file.processingStartedAt && (
                  <p className="text-xs sm:text-sm text-blue-600">
                    Processing since: {new Date(file.processingStartedAt).toLocaleDateString()}
                  </p>
                )}
                {file.status === "completed" && file.completedAt && (
                  <p className="text-xs sm:text-sm text-green-600">
                    Completed: {new Date(file.completedAt).toLocaleDateString()}
                  </p>
                )}
                {file.completedFile && (
                  <p className="text-xs sm:text-sm text-gray-500">
                    by {file.completedFile.agentName}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end space-x-3 sm:ml-4">
            <div className="flex-shrink-0">
              {getStatusBadge(file.status)}
            </div>
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
          
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/files/view/${file.id}`}
              className="inline-flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View
            </Link>
            
            {/* Edit button - only for pending_payment and paid status */}
            {(file.status === "pending_payment" || file.status === "paid") && (
              <Link
                href={`/files/edit/${file.id}`}
                className="inline-flex items-center px-3 sm:px-4 py-2 bg-purple-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Link>
            )}
            
            {file.status === "completed" && file.completedFile && (
              <button 
                onClick={() => onDownloadCompletedFile(file.completedFile!.id, file.completedFile!.originalName)}
                className="inline-flex items-center px-3 sm:px-4 py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Completed
              </button>
            )}
            
            <button 
              onClick={() => onDeleteFile(file.id)}
              className="inline-flex items-center px-3 sm:px-4 py-2 bg-red-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>

        {/* Agent Response */}
        {file.agentResponse && (
          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">Agent Response</h4>
            <p className="text-xs sm:text-sm text-gray-700">{file.agentResponse.message}</p>
            {file.agentResponse.agent && (
              <p className="text-xs sm:text-sm text-gray-500 mt-2">
                By: {file.agentResponse.agent.name} ({file.agentResponse.agent.email})
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
