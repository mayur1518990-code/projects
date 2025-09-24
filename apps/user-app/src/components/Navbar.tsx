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
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0">
              <span className="text-2xl font-bold text-blue-600">DocUpload</span>
            </Link>
            
            <div className="hidden md:ml-6 md:flex md:space-x-8">
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

          <div className="flex items-center">
            {loading ? (
              <div className="text-gray-500">Loading...</div>
            ) : user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  Welcome, {user.name || user.email}
                </span>
                <button
                  onClick={signOut}
                  className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/login"
                  className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
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

