import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

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

    // Get file content from database
    const fileContent = fileData?.fileContent;
    if (!fileContent) {
      return NextResponse.json(
        { success: false, message: 'File content not found' },
        { status: 404 }
      );
    }

    // Convert base64 to buffer for streaming
    const fileBuffer = Buffer.from(fileContent, 'base64');
    
    // Check if file is too large for browser rendering
    const MAX_BROWSER_SIZE = 10 * 1024 * 1024; // 10MB
    if (fileBuffer.length > MAX_BROWSER_SIZE) {
      return NextResponse.json(
        { 
          success: false, 
          message: `File is too large (${Math.round(fileBuffer.length / 1024 / 1024)}MB) to preview in browser. Please download to view.`,
          fileSize: fileBuffer.length,
          maxSize: MAX_BROWSER_SIZE
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
      console.log(`File content served from database for file ${fileId} to user ${userId} (${fileBuffer.length} bytes)`);
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

