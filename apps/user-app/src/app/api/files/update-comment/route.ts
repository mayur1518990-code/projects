import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Update file comment/message without replacing the file
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, fileId, comment } = body;
    
    if (!userId || !fileId) {
      return NextResponse.json(
        { success: false, message: 'userId and fileId are required' },
        { status: 400 }
      );
    }

    if (!comment || !comment.trim()) {
      return NextResponse.json(
        { success: false, message: 'Comment cannot be empty' },
        { status: 400 }
      );
    }

    // Get existing file record
    const fileDoc = await adminDb.collection('files').doc(fileId).get();
    
    if (!fileDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'File not found' },
        { status: 404 }
      );
    }

    const existingFileData = fileDoc.data();
    
    // Verify ownership
    if (existingFileData?.userId !== userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized to update this file' },
        { status: 403 }
      );
    }

    // Only prevent updates for completed files
    if (existingFileData?.status === 'completed') {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Cannot update comment for completed files.' 
        },
        { status: 400 }
      );
    }
    
    // Allow updates for pending_payment, paid, assigned, and processing status

    // Update only the comment fields
    const updateData = {
      userComment: comment.trim(),
      userCommentUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await adminDb.collection('files').doc(fileId).update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Comment updated successfully',
      file: {
        id: fileId,
        userComment: updateData.userComment,
        userCommentUpdatedAt: updateData.userCommentUpdatedAt
      }
    });

  } catch (error: any) {
    console.error('Update comment error:', error);
    
    let errorMessage = 'An error occurred while updating the comment';
    let statusCode = 500;
    
    if (error.code === 'permission-denied') {
      errorMessage = 'Permission denied. Please check your authentication.';
      statusCode = 403;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { 
          error: error.message,
          stack: error.stack 
        })
      },
      { status: statusCode }
    );
  }
}

