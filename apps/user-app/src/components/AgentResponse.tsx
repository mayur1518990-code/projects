"use client";

import { useState } from "react";

interface AgentResponseProps {
  response: {
    message: string;
    responseFileURL: string;
    respondedAt: string;
    agent: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
}

export function AgentResponse({ response }: AgentResponseProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'jpg':
      case 'jpeg':
      case 'png':
        return '🖼️';
      default:
        return '📎';
    }
  };

  const getFileName = (url: string) => {
    return url.split('/').pop() || 'Response File';
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <h3 className="text-sm font-medium text-green-800">
            Agent Response
          </h3>
          {response.agent && (
            <span className="text-xs text-green-600">
              by {response.agent.name}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-green-600 hover:text-green-800 text-sm"
        >
          {isExpanded ? 'Hide' : 'View'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Response Message */}
          {response.message && (
            <div className="bg-white rounded-md p-3 border border-green-100">
              <p className="text-sm text-gray-700">{response.message}</p>
            </div>
          )}

          {/* Response File */}
          {response.responseFileURL && (
            <div className="bg-white rounded-md p-3 border border-green-100">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getFileIcon(response.responseFileURL)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {getFileName(response.responseFileURL)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Response file from agent
                  </p>
                </div>
                <a
                  href={response.responseFileURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1 border border-green-300 text-xs font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                >
                  Download
                </a>
              </div>
            </div>
          )}

          {/* Response Date */}
          <div className="text-xs text-green-600">
            Responded on {formatDate(response.respondedAt)}
          </div>
        </div>
      )}
    </div>
  );
}
