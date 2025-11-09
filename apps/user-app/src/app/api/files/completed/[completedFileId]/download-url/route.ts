import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getSignedDownloadUrl, extractKeyFromUrl } from '@/lib/b2';

/**
 * OPTIMIZED: Generate pre-signed download URL (instant response <100ms)
 * Instead of streaming file through server, return a direct B2 download URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ completedFileId: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { completedFileId } = await params;

    // Get user ID from query params for validation
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
      return NextResponse.json({
        success: false,
        error: 'Completed file not found'
      }, { status: 404 });
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

    // Get filename for proper download
    const filename = completedFileData?.originalName || completedFileData?.filename || 'download';

    // Generate pre-signed URL with Content-Disposition header (fast, ~10-30ms)
    // The getSignedDownloadUrl function already includes Content-Disposition: attachment
    const downloadUrl = getSignedDownloadUrl(b2Key, 3600, filename); // 1 hour expiry

    const elapsed = Date.now() - startTime;
    console.log(`[DOWNLOAD-URL] Generated in ${elapsed}ms for completed file: ${completedFileId}`);

    return NextResponse.json({
      success: true,
      downloadUrl,
      filename: filename,
      expiresIn: 3600
    });

  } catch (error: any) {
    console.error('Error generating download URL:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}

