import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

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

    // Get file content from database
    const fileContent = completedFileData?.fileContent;
    if (!fileContent) {
      return NextResponse.json({
        success: false,
        error: 'File content not found in database'
      }, { status: 404 });
    }

    try {
      // Handle data URL format (data:mimeType;base64,content) or pure base64
      let base64Content = fileContent;
      if (fileContent.startsWith('data:')) {
        // Extract base64 content from data URL
        const base64Index = fileContent.indexOf(',');
        if (base64Index !== -1) {
          base64Content = fileContent.substring(base64Index + 1);
        }
      }
      
      // Convert base64 content back to buffer
      const buffer = Buffer.from(base64Content, 'base64');
      
      // Set appropriate headers for file download with caching
      const headers = new Headers();
      headers.set('Content-Type', completedFileData?.mimeType || 'application/octet-stream');
      headers.set('Content-Disposition', `attachment; filename="${completedFileData?.originalName}"`);
      headers.set('Content-Length', buffer.length.toString());
      headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      // Return the file content as stream
      return new NextResponse(buffer as any, {
        status: 200,
        headers
      });

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('File processing error:', error);
      }
      return NextResponse.json({
        success: false,
        error: 'Failed to process file content'
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
