/**
 * Utility functions for handling file downloads, especially in WebView environments
 */

/**
 * Detect if the app is running in a WebView (Android/iOS)
 */
export function isWebView(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // Check for WebView indicators
  const webViewPatterns = [
    /wv/i,                    // Android WebView
    /WebView/i,               // Generic WebView
    /; wv\)/i,                // Android WebView pattern
    /Android.*Version\/\d/i,  // Android WebView (sometimes)
  ];
  
  return webViewPatterns.some(pattern => pattern.test(userAgent));
}

/**
 * Download a file using blob URL (works in WebView)
 * This method creates a blob from the response and triggers download via anchor element
 */
export async function downloadFileAsBlob(
  url: string,
  filename: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }
    
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    // Get the blob
    const blob = await response.blob();
    
    // Create a blob URL
    const blobUrl = window.URL.createObjectURL(blob);
    
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL after a delay
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
    
    if (onProgress && total > 0) {
      onProgress(total, total);
    }
  } catch (error: any) {
    console.error('Blob download error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

/**
 * Download file with progress tracking using fetch
 * This is more reliable in WebView environments
 */
export async function downloadFileWithProgress(
  url: string,
  filename: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || `Download failed: ${response.statusText}`);
      } catch {
        throw new Error(`Download failed: ${response.statusText}`);
      }
    }
    
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    if (!response.body) {
      throw new Error('Response body is null');
    }
    
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    
    // Read the stream
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;
      
      if (onProgress && total > 0) {
        onProgress(loaded, total);
      }
    }
    
    // Combine chunks into a single blob
    const blob = new Blob(chunks);
    
    // Create blob URL and trigger download
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
  } catch (error: any) {
    console.error('Download with progress error:', error);
    throw error;
  }
}

