"use client";

import { useState, useEffect } from "react";

interface QRCodeDisplayProps {
  fileId?: string;
  paymentUrl?: string;
  onGenerate?: () => void;
}

export function QRCodeDisplay({ fileId, paymentUrl, onGenerate }: QRCodeDisplayProps) {
  const [qrCode, setQrCode] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  // Calculate time remaining
  useEffect(() => {
    if (!expiryTime) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = expiryTime.getTime();
      const difference = expiry - now;

      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft("Expired");
        setQrCode("");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiryTime]);

  const generateQRCode = async () => {
    setIsGenerating(true);
    
    try {
      // TODO: Replace with actual API call
      // For now, generate a placeholder QR code
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Generate a sample QR code URL (in real app, this would come from backend)
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
        paymentUrl || `https://yourapp.com/payment/${fileId}`
      )}`;
      
      setQrCode(qrCodeUrl);
      
      // Set expiry time to 24 hours from now
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);
      setExpiryTime(expiry);
      
      onGenerate?.();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to generate QR code:", error);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="inline-block">
      {qrCode ? (
        <div className="relative group">
          <button
            onClick={() => {
              // Show QR code in a modal or popup
              const newWindow = window.open('', '_blank', 'width=400,height=500');
              if (newWindow) {
                newWindow.document.write(`
                  <html>
                    <head><title>QR Code - Payment</title></head>
                    <body style="margin:0; padding:20px; text-align:center; font-family: Arial, sans-serif;">
                      <h2>Scan to Pay</h2>
                      <img src="${qrCode}" alt="QR Code" style="max-width:300px; border:1px solid #ddd; border-radius:8px;">
                      <p style="margin-top:10px; color:#666;">Scan this QR code to complete payment</p>
                      ${timeLeft ? `<p style="color:#f59e0b; font-weight:bold;">Expires in: ${timeLeft}</p>` : ''}
                    </body>
                  </html>
                `);
              }
            }}
            className="inline-flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="hidden sm:inline">View QR</span>
            <span className="sm:hidden">QR</span>
          </button>
        </div>
      ) : (
        <button
          onClick={generateQRCode}
          disabled={isGenerating}
          className="inline-flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          {isGenerating ? (
            <>
              <span className="hidden sm:inline">Generating...</span>
              <span className="sm:hidden">Generating</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Generate QR</span>
              <span className="sm:hidden">QR</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
