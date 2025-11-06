import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getSignedDownloadUrl, extractKeyFromUrl } from '@/lib/b2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ completedFileId: string }> }
) {
  try {
    const { completedFileId } = await params;

    // Get user ID from query params first for faster validation
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 });
    }

    // Get completed file information and original file in parallel
    const [completedFileDoc, originalFileDoc] = await Promise.all([
      adminDb.collection('completedFiles').doc(completedFileId).get(),
      adminDb.collection('files').where('completedFileId', '==', completedFileId)
        .where('userId', '==', userId)
        .limit(1)
        .get()
    ]);
    
    if (!completedFileDoc.exists) {
      return NextResponse.json({
        success: false,
        error: 'Completed file not found'
      }, { status: 404 });
    }

    if (originalFileDoc.empty) {
      return NextResponse.json({
        success: false,
        error: 'Original file not found or unauthorized'
      }, { status: 404 });
    }

    const completedFileData = completedFileDoc.data();
    if (!completedFileData) {
      return NextResponse.json(
        { success: false, message: 'Completed file not found' },
        { status: 404 }
      );
    }

    // Get B2 file path from completed file document
    // Handle both naming conventions: b2Key/b2Url (agent app) and filePath/fileUrl (user app)
    let b2Key = completedFileData?.b2Key || completedFileData?.filePath;
    const fileUrl = completedFileData?.b2Url || completedFileData?.fileUrl;
    
    // If no direct B2 key, try to construct from filename (legacy support)
    if (!b2Key && completedFileData?.filename) {
      const agentId = completedFileData?.agentId;
      const filename = completedFileData?.filename;
      
      if (agentId && filename) {
        b2Key = `agent-uploads/${agentId}/${filename}`;
      }
    }
    
    // Try to extract from URL if still no key
    if (!b2Key && fileUrl) {
      b2Key = extractKeyFromUrl(fileUrl);
    }
    
    if (!b2Key) {
      return NextResponse.json({
        success: false,
        error: 'File storage location not found'
      }, { status: 404 });
    }

    try {
      // Get filename for proper download
      const filename = completedFileData?.originalName || completedFileData?.filename || 'download';
      
      // Generate signed URL for direct B2 download with forced download header
      // URL expires in 5 minutes (300 seconds)
      const signedUrl = getSignedDownloadUrl(b2Key, 300, filename);
      
      // Return signed URL in JSON for client to handle
      return NextResponse.json({
        success: true,
        downloadUrl: signedUrl,
        filename: filename,
        mimeType: completedFileData?.mimeType || 'application/octet-stream'
      }, {
        headers: {
          'Cache-Control': 'no-store' // Don't cache signed URLs
        }
      });

    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('B2 signed URL error:', error);
      }
      
      return NextResponse.json({
        success: false,
        error: 'Failed to generate download URL'
      }, { status: 500 });
    }

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error downloading completed file:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
