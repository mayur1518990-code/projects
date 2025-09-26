"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import { memo, useCallback, useEffect } from "react";

export const Navbar = memo(function Navbar() {
  const { user, loading, signOut } = useAuthContext();
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Navbar render - user:', user, 'loading:', loading);
    }
  }, [user, loading]);

  const isActive = useCallback((path: string) => pathname === path, [pathname]);

  return (
    <nav className="bg-white/95 backdrop-blur sticky top-0 z-50 shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex justify-between items-center h-12 sm:h-14 md:h-16">
          <div className="flex items-center min-w-0 flex-1">
            <Link href="/" className="flex-shrink-0">
              <span className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">DocUpload</span>
            </Link>
            
            <div className="hidden md:ml-6 md:flex md:space-x-6 lg:space-x-8">
              <Link
                href="/upload"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive("/upload")
                    ? "border-blue-500 text-gray-900"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                Upload
              </Link>
              
              <Link
                href="/files"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive("/files")
                    ? "border-blue-500 text-gray-900"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                My Files
              </Link>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            {loading ? (
              <div className="text-xs sm:text-sm text-gray-500">Loading...</div>
            ) : user ? (
              <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">
                <span className="hidden sm:inline text-xs sm:text-sm text-gray-700 truncate max-w-[20vw] md:max-w-none">
                  Welcome, {user.name || user.email}
                </span>
                <button
                  onClick={signOut}
                  className="bg-red-600 text-white px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">
                <Link
                  href="/login"
                  className="text-gray-500 hover:text-gray-700 px-1 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-md text-xs sm:text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="bg-blue-600 text-white px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
});

