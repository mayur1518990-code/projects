import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { uploadFile, deleteFile } from '@/lib/b2';

// Ensure Node.js runtime for Buffer and formData file handling
export const runtime = 'nodejs';

// Validation functions
const validateFileType = (mimeType: string): boolean => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-rar-compressed',
    'image/svg+xml'
  ];
  return allowedTypes.includes(mimeType);
};

const inferMimeFromFilename = (filename: string): string => {
  const extension = (filename.split('.').pop() || '').toLowerCase();
  switch (extension) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'bmp': return 'image/bmp';
    case 'tiff':
    case 'tif': return 'image/tiff';
    case 'pdf': return 'application/pdf';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt': return 'text/plain';
    case 'rtf': return 'application/rtf';
    case 'xls': return 'application/vnd.ms-excel';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt': return 'application/vnd.ms-powerpoint';
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'zip': return 'application/zip';
    case 'rar': return 'application/x-rar-compressed';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
};

const validateFileSize = (size: number): boolean => {
  const maxSize = 20 * 1024 * 1024; // 20MB
  return size <= maxSize;
};

const generateUniqueFilename = (originalName: string): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
  
  if (!extension || extension === originalName) {
    return `${timestamp}_${randomString}`;
  }
  
  return `${timestamp}_${randomString}.${extension}`;
};

/**
 * Replace/Update an existing file
 * Preserves file ID, payment status, and metadata
 */
export async function POST(request: NextRequest) {
  try {
    // Handle FormData
    const formData = await request.formData();
    const file = formData.get('file') as globalThis.File;
    const userId = formData.get('userId') as string;
    const fileId = formData.get('fileId') as string;
    const comment = formData.get('comment') as string | null;
    
    if (!file || !userId || !fileId) {
      return NextResponse.json(
        { success: false, message: 'File, userId, and fileId are required' },
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

    // If file is completed, change status to replacement
    // This allows user to request corrections after receiving completed file
    const shouldChangeToReplacement = existingFileData?.status === 'completed';

    const originalName = file.name;
    const size = file.size;
    
    // Get MIME type
    const mimeTypeRaw = (file as any).type || '';
    const mimeType = mimeTypeRaw && typeof mimeTypeRaw === 'string' && mimeTypeRaw.trim().length > 0
      ? mimeTypeRaw
      : inferMimeFromFilename(originalName);

    // Validate file type
    if (!validateFileType(mimeType)) {
      return NextResponse.json(
        { success: false, message: `File type not supported: ${mimeType}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (size === 0) {
      return NextResponse.json(
        { success: false, message: 'File is empty. Please select a valid file.' },
        { status: 400 }
      );
    }
    
    if (!validateFileSize(size)) {
      return NextResponse.json(
        { success: false, message: 'File size exceeds 20MB limit' },
        { status: 400 }
      );
    }

    // Generate unique filename for storage
    const uniqueFilename = generateUniqueFilename(originalName);
    const newFilePath = `uploads/${userId}/${uniqueFilename}`;

    // Convert file to buffer for B2 upload
    let fileBuffer: Buffer;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      
      // Validate buffer has content
      if (fileBuffer.length === 0) {
        return NextResponse.json(
          { success: false, message: 'File is empty. Please select a valid file.' },
          { status: 400 }
        );
      }
      
      // Double-check size matches
      if (fileBuffer.length !== size) {
        console.warn(`File size mismatch: expected ${size}, got ${fileBuffer.length}`);
      }
    } catch (bufferError: any) {
      console.error('Buffer conversion error:', bufferError);
      return NextResponse.json(
        { success: false, message: 'Failed to process file data. File may be corrupted.' },
        { status: 400 }
      );
    }
    
    // Upload new file to B2
    let uploadResult;
    try {
      uploadResult = await uploadFile(fileBuffer, newFilePath, mimeType);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Replacement file uploaded to B2: ${newFilePath} (${fileBuffer.length} bytes)`);
      }
    } catch (uploadError: any) {
      console.error('B2 upload error:', uploadError);
      return NextResponse.json(
        { success: false, message: 'Failed to upload file to storage. Please try again.' },
        { status: 500 }
      );
    }

    // Delete old file from B2 (if it exists)
    const oldFilePath = existingFileData?.filePath;
    if (oldFilePath) {
      try {
        await deleteFile(oldFilePath);
        if (process.env.NODE_ENV === 'development') {
          console.log(`Deleted old file from B2: ${oldFilePath}`);
        }
      } catch (deleteError) {
        console.warn('Failed to delete old file from B2:', deleteError);
        // Don't fail the request if old file deletion fails
      }
    }

    // Update file document in Firestore
    const updateData: any = {
      filename: uniqueFilename,
      originalName,
      size,
      mimeType,
      filePath: newFilePath,
      fileUrl: uploadResult.url,
      updatedAt: new Date().toISOString(),
      replacedAt: new Date().toISOString(),
      // If file was completed, change status to replacement
      // If file is already replacement, keep it as replacement (no payment needed)
      status: shouldChangeToReplacement ? 'replacement' : (existingFileData?.status === 'replacement' ? 'replacement' : (existingFileData?.status || 'pending_payment')),
      metadata: existingFileData?.metadata || {}
    };

    // Preserve payment status - replacement files should not require payment again
    // Only include payment fields if they exist (Firestore doesn't allow undefined)
    if (existingFileData?.paymentId) {
      updateData.paymentId = existingFileData.paymentId;
    }
    if (existingFileData?.paidAt) {
      updateData.paidAt = existingFileData.paidAt;
    }

    // Add comment if provided
    if (comment && comment.trim()) {
      updateData.userComment = comment.trim();
      updateData.userCommentUpdatedAt = new Date().toISOString();
    }

    try {
      await adminDb.collection('files').doc(fileId).update(updateData);
    } catch (firestoreError: any) {
      console.error('Firestore update error:', firestoreError);
      // If Firestore update fails, try to clean up new B2 file
      try {
        await deleteFile(newFilePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup B2 file after Firestore error:', cleanupError);
      }
      return NextResponse.json(
        { success: false, message: 'Failed to update file in database. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'File replaced successfully',
      file: {
        id: fileId,
        filename: uniqueFilename,
        originalName,
        size,
        mimeType,
        status: updateData.status,
        updatedAt: updateData.updatedAt,
        filePath: newFilePath
      }
    });

  } catch (error: any) {
    console.error('Replace file error:', error);
    
    let errorMessage = 'An error occurred while replacing the file';
    let statusCode = 500;
    
    if (error.code === 'permission-denied') {
      errorMessage = 'Permission denied. Please check your authentication.';
      statusCode = 403;
    } else if (error.code === 'invalid-argument') {
      errorMessage = 'Invalid file data provided.';
      statusCode = 400;
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

