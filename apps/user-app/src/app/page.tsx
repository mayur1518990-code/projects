"use client";

import Link from "next/link";
import { useAuthContext } from "@/components/AuthProvider";
import { useMemo } from "react";

export default function Home() {
  const { user, loading } = useAuthContext();
  
  // Memoize the login button visibility to prevent unnecessary re-renders
  const showLoginButton = useMemo(() => !loading && !user, [loading, user]);
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="container mx-auto px-3 sm:px-4 py-12 sm:py-16 md:py-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              Secure Document Processing
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-8 text-blue-100 px-2 sm:px-0">
              Upload, process, and share your documents with QR code tracking and secure payment integration
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-2 sm:px-0">
              <Link
                href="/upload"
                className="bg-white text-blue-600 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:bg-gray-100 transition-colors w-full sm:w-auto"
              >
                Start Uploading
              </Link>
              {showLoginButton && (
                <Link
                  href="/login"
                  className="border-2 border-white text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:bg-white hover:text-blue-600 transition-colors w-full sm:w-auto"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8 sm:mb-12 md:mb-16">
              Why Choose DocUpload?
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              <div className="text-center p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Easy Upload</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Drag and drop or click to upload PDFs, images, Word docs, and screenshots up to 20MB each.
                </p>
              </div>

              <div className="text-center p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Secure Payment</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Integrated with Razorpay for secure payment processing. Multiple payment options available.
                </p>
              </div>

              <div className="text-center p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">QR Code Tracking</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Generate QR codes for easy sharing and tracking. QR codes expire after 24 hours for security.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-white py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8 sm:mb-12 md:mb-16">
              How It Works
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              <div className="text-center p-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-lg sm:text-xl font-bold">
                  1
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">Upload Files</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Upload your documents using drag & drop or file picker
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-lg sm:text-xl font-bold">
                  2
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">Make Payment</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Complete secure payment using Razorpay integration
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-lg sm:text-xl font-bold">
                  3
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">Generate QR</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Generate QR codes for easy sharing and tracking
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-lg sm:text-xl font-bold">
                  4
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">Track & Share</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Monitor file status and share with QR codes
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 text-white py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-4xl mx-auto text-center">
            {user ? (
              // Show different content when user is logged in
              <>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
                  Welcome back, {user.name}!
                </h2>
                <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-6 sm:mb-8 px-2 sm:px-0">
                  Ready to upload and process your documents? Your files are waiting.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-2 sm:px-0">
                  <Link
                    href="/upload"
                    className="bg-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
                  >
                    Upload Files
                  </Link>
                  <Link
                    href="/files"
                    className="border-2 border-white text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:bg-white hover:text-gray-900 transition-colors w-full sm:w-auto"
                  >
                    View My Files
                  </Link>
                </div>
              </>
            ) : (
              // Show signup content when user is not logged in
              <>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
                  Ready to Get Started?
                </h2>
                <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-6 sm:mb-8 px-2 sm:px-0">
                  Join thousands of users who trust DocUpload for their document processing needs.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-2 sm:px-0">
                  <Link
                    href="/signup"
                    className="bg-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
                  >
                    Create Account
                  </Link>
                  <Link
                    href="/upload"
                    className="border-2 border-white text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:bg-white hover:text-gray-900 transition-colors w-full sm:w-auto"
                  >
                    Try Now
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 sm:py-12">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              <div className="sm:col-span-2 lg:col-span-1">
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">DocUpload</h3>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                  Secure document processing with QR code tracking and payment integration.
                </p>
              </div>
              
              <div>
                <h4 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Features</h4>
                <ul className="space-y-2 text-sm sm:text-base text-gray-400">
                  <li>File Upload</li>
                  <li>Payment Processing</li>
                  <li>QR Code Generation</li>
                  <li>File Tracking</li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Support</h4>
                <ul className="space-y-2 text-sm sm:text-base text-gray-400">
                  <li>Help Center</li>
                  <li>Contact Us</li>
                  <li>Privacy Policy</li>
                  <li>Terms of Service</li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Connect</h4>
                <ul className="space-y-2 text-sm sm:text-base text-gray-400">
                  <li>Twitter</li>
                  <li>LinkedIn</li>
                  <li>GitHub</li>
                  <li>Email</li>
                </ul>
              </div>
            </div>
            
            <div className="border-t border-gray-700 mt-6 sm:mt-8 pt-6 sm:pt-8 text-center text-sm sm:text-base text-gray-400">
              <p>&copy; 2024 DocUpload. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
