import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { uploadFile } from '@/lib/b2';

// Ensure Node.js runtime for Buffer and formData file handling, especially in Android WebView uploads
export const runtime = 'nodejs';
// Define interfaces locally to avoid import issues
interface File {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  uploadedAt: Date;
  processedAt?: Date;
  agentId?: string;
  filePath: string;
  metadata?: Record<string, any>;
}

interface CreateFileData {
  userId: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  filePath: string;
  fileUrl: string;
  status?: string;
  uploadedAt?: string;
  metadata?: Record<string, any>;
}

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
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'tiff':
    case 'tif':
      return 'image/tiff';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt':
      return 'text/plain';
    case 'rtf':
      return 'application/rtf';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'zip':
      return 'application/zip';
    case 'rar':
      return 'application/x-rar-compressed';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
};

const validateFileSize = (size: number): boolean => {
  const maxSize = 20 * 1024 * 1024; // 20MB to match frontend limit
  return size <= maxSize;
};

const generateUniqueFilename = (originalName: string): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
  
  // Handle files without extensions
  if (!extension || extension === originalName) {
    return `${timestamp}_${randomString}`;
  }
  
  return `${timestamp}_${randomString}.${extension}`;
};

export async function POST(request: NextRequest) {
  try {
    // Handle FormData instead of JSON
    const formData = await request.formData();
    const file = formData.get('file') as globalThis.File;
    const userId = formData.get('userId') as string;
    const metadataStr = formData.get('metadata') as string;
    
    if (!file || !userId) {
      return NextResponse.json(
        { success: false, message: 'File and userId are required' },
        { status: 400 }
      );
    }

    const metadata = metadataStr ? JSON.parse(metadataStr) : {};
    const originalName = file.name;
    const size = file.size;
    
    // Some Android WebViews may omit or misreport the MIME type; fall back to inferring from filename
    const mimeTypeRaw = (file as any).type || '';
    const mimeType = mimeTypeRaw && typeof mimeTypeRaw === 'string' && mimeTypeRaw.trim().length > 0
      ? mimeTypeRaw
      : inferMimeFromFilename(originalName);

    // Validate required fields
    if (!userId || !originalName || !size || !mimeType) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

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
    const filePath = `uploads/${userId}/${uniqueFilename}`;

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
    } catch (bufferError: any) {
      return NextResponse.json(
        { success: false, message: 'Failed to process file data. File may be corrupted.' },
        { status: 400 }
      );
    }
    
    // Upload file to Backblaze B2 with timeout
    let uploadResult: any;
    try {
      // Add timeout wrapper for B2 upload (reduced to 8s for better responsiveness)
      const uploadPromise = uploadFile(fileBuffer, filePath, mimeType);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout')), 8000) // 8s timeout
      );
      
      uploadResult = await Promise.race([uploadPromise, timeoutPromise]);
    } catch (uploadError: any) {
      return NextResponse.json(
        { success: false, message: uploadError.message === 'Upload timeout' ? 'Upload timeout. Please try again.' : 'Failed to upload file to storage.' },
        { status: 500 }
      );
    }

    // Create file document in Firestore with metadata only
    const fileRef = adminDb.collection('files').doc();
    const fileId = fileRef.id;

    const fileDocument = {
      id: fileId,
      userId,
      filename: uniqueFilename,
      originalName,
      size,
      mimeType,
      filePath,
      fileUrl: uploadResult.url,
      status: 'pending_payment', // Initial status - waiting for payment
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      metadata: metadata || {}
    };

    try {
      await fileRef.set(fileDocument);
      
      // Clear user's file cache immediately so new file shows up
      const { getCacheKey, setCached } = await import('@/lib/cache');
      const cacheKey = getCacheKey('user_files', userId);
      setCached(cacheKey, null, 0);
    } catch (firestoreError: any) {
      // If Firestore write fails, try to clean up B2 file
      try {
        const { deleteFile } = await import('@/lib/b2');
        await deleteFile(filePath);
      } catch (cleanupError) {
        // Silent cleanup fail
      }
      return NextResponse.json(
        { success: false, message: 'Failed to save file to database. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        id: fileId,
        filename: uniqueFilename,
        originalName,
        size,
        mimeType,
        status: 'uploaded',
        uploadedAt: fileDocument.uploadedAt,
        filePath
      }
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Upload error:', error);
    }
    
    let statusCode = 500;
    if (error.code === 'permission-denied') statusCode = 403;
    else if (error.code === 'invalid-argument') statusCode = 400;
    else if (error.code === 'resource-exhausted') statusCode = 413;
    
    return NextResponse.json(
      { success: false, message: 'An error occurred during upload' },
      { status: statusCode }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user's files from Firestore (without orderBy to avoid index requirement)
    const filesSnapshot = await adminDb
      .collection('files')
      .where('userId', '==', userId)
      .get();

    const files = filesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort files by uploadedAt in descending order (newest first)
    files.sort((a, b) => {
      const dateA = new Date((a as any).uploadedAt || (a as any).createdAt || 0);
      const dateB = new Date((b as any).uploadedAt || (b as any).createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    return NextResponse.json({
      success: true,
      files
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get files error:', error);
    }
    return NextResponse.json(
      { success: false, message: 'An error occurred while fetching files' },
      { status: 500 }
    );
  }
}