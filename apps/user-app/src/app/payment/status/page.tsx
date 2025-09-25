"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function PaymentStatusPage() {
  const [query, setQuery] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const entries: Record<string, string> = {};
    params.forEach((v, k) => { entries[k] = v; });
    setQuery(entries);
  }, []);

  const state = useMemo(() => {
    const payment = query.payment || "failed";
    const code = query.code || (payment === 'success' ? 'ok' : 'unknown_error');
    const msg = query.msg ? decodeURIComponent(query.msg) : undefined;
    const fileId = query.fileId;
    return { payment, code, msg, fileId };
  }, [query]);

  const isSuccess = state.payment === 'success';

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className={`rounded-lg border p-5 ${isSuccess ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
        <h1 className="text-xl font-semibold mb-2">
          {isSuccess ? 'Payment Successful' : 'Payment Failed'}
        </h1>
        <p className="text-sm text-gray-700">
          {isSuccess
            ? 'Your payment was verified successfully.'
            : 'Your payment could not be completed or verified.'}
        </p>
        {!isSuccess && (
          <div className="mt-3 text-xs text-gray-600">
            <div><span className="font-medium">Reason Code:</span> {state.code}</div>
            {state.msg ? (
              <div className="mt-1">
                <span className="font-medium">Message:</span> {state.msg}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <Link href={state.fileId ? `/files?highlight=${encodeURIComponent(state.fileId)}` : '/files'} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            Go to Files
          </Link>
          {!isSuccess && (
            <button onClick={() => {
              if (typeof window !== 'undefined') {
                window.history.length > 1 ? window.history.back() : window.location.assign('/files');
              }
            }} className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-900 text-sm font-medium rounded-md hover:bg-gray-300">
              Try Again
            </button>
          )}
        </div>
      </div>

      {!isSuccess && (
        <div className="mt-6 text-xs text-gray-500">
          <div className="font-semibold mb-1">Debug (safe for support):</div>
          <pre className="whitespace-pre-wrap break-words bg-white border rounded p-3">
{JSON.stringify(query, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}


