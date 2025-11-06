import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getFileBuffer, extractKeyFromUrl, getFileStream } from '@/lib/b2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId');

    if (!fileId || !userId) {
      return NextResponse.json(
        { success: false, message: 'File ID and User ID are required' },
        { status: 400 }
      );
    }

    // Get file document from Firestore
    const fileDoc = await adminDb.collection('files').doc(fileId).get();
    
    if (!fileDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'File not found' },
        { status: 404 }
      );
    }

    const fileData = fileDoc.data();
    
    // Verify the file belongs to the user
    if (fileData?.userId !== userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized to access this file' },
        { status: 403 }
      );
    }

    // Get B2 file path/URL from Firestore
    const filePath = fileData?.filePath;
    const fileUrl = fileData?.fileUrl;
    
    if (!filePath && !fileUrl) {
      return NextResponse.json(
        { success: false, message: 'File storage location not found' },
        { status: 404 }
      );
    }

    // Determine B2 key: use filePath if available, otherwise extract from URL
    let b2Key = filePath;
    if (!b2Key && fileUrl) {
      b2Key = extractKeyFromUrl(fileUrl);
      if (!b2Key) {
        // Fallback: try to use the fileUrl as-is if extraction fails
        // This handles legacy data or alternative URL formats
        return NextResponse.json(
          { success: false, message: 'Unable to determine file location' },
          { status: 404 }
        );
      }
    }

    if (!b2Key) {
      return NextResponse.json(
        { success: false, message: 'File storage location not found' },
        { status: 404 }
      );
    }

    // Check if file is too large for browser rendering
    // Detect WebView from User-Agent header
    const userAgent = request.headers.get('user-agent') || '';
    const isWebView = /(wv|WebView|; wv\))/i.test(userAgent) || 
                     (!/Chrome\//i.test(userAgent) && /Version\//i.test(userAgent) && /Mobile/i.test(userAgent));
    
    const MAX_BROWSER_SIZE = isWebView ? 5 * 1024 * 1024 : 10 * 1024 * 1024; // 5MB for WebView, 10MB for browser
    
    // Get file from B2
    let fileBuffer: Buffer;
    try {
      fileBuffer = await getFileBuffer(b2Key);
    } catch (b2Error: any) {
      console.error('B2 retrieval error:', b2Error);
      
      // If file not found in B2, auto-delete the Firestore record
      if (b2Error.message && b2Error.message.includes('not found')) {
        try {
          await adminDb.collection('files').doc(fileId).delete();
          console.log(`Auto-deleted orphaned Firestore record: ${fileId}`);
        } catch (deleteError) {
          console.error('Failed to auto-delete orphaned record:', deleteError);
        }
        
        return NextResponse.json(
          { 
            success: false, 
            message: 'File not found in storage and has been removed from your files',
            autoDeleted: true 
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { success: false, message: 'Failed to retrieve file from storage' },
        { status: 404 }
      );
    }

    // Check file size for browser rendering
    if (fileBuffer.length > MAX_BROWSER_SIZE) {
      const sizeMB = Math.round(fileBuffer.length / 1024 / 1024);
      const limitMB = Math.round(MAX_BROWSER_SIZE / 1024 / 1024);
      return NextResponse.json(
        { 
          success: false, 
          message: `File is too large (${sizeMB}MB) to preview in ${isWebView ? 'mobile app' : 'browser'}. Maximum size is ${limitMB}MB. Please download to view.`,
          fileSize: fileBuffer.length,
          maxSize: MAX_BROWSER_SIZE,
          isWebView: isWebView
        },
        { status: 413 }
      );
    }
    
    // Set appropriate headers for file streaming
    const headers = new Headers();
    headers.set('Content-Type', fileData.mimeType || 'application/octet-stream');
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    headers.set('Content-Disposition', `inline; filename="${fileData.originalName || 'file'}"`);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`File content served from B2 for file ${fileId} to user ${userId} (${fileBuffer.length} bytes)`);
    }

    // Return file as stream
    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {

      console.error('Get file content error:', error);

    }
    return NextResponse.json(
      { success: false, message: 'An error occurred while fetching file content' },
      { status: 500 }
    );
  }
}

