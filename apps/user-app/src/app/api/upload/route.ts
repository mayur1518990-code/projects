import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
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
  status?: string;
  uploadedAt?: string;
  fileContent?: string;
  metadata?: Record<string, any>;
}

// Validation functions
const validateFileType = (mimeType: string): boolean => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/svg+xml'
  ];
  return allowedTypes.includes(mimeType);
};

const validateFileSize = (size: number): boolean => {
  const maxSize = 10 * 1024 * 1024; // 10MB for database storage (reduced from 20MB)
  return size <= maxSize;
};

const generateUniqueFilename = (originalName: string): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
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
    const mimeType = file.type;

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
        { success: false, message: 'File type not supported' },
        { status: 400 }
      );
    }

    // Validate file size
    if (!validateFileSize(size)) {
      return NextResponse.json(
        { success: false, message: 'File size exceeds 10MB limit for database storage' },
        { status: 400 }
      );
    }

    // Generate unique filename for storage
    const uniqueFilename = generateUniqueFilename(originalName);
    const filePath = `uploads/${userId}/${uniqueFilename}`;

    // Convert file to buffer for database storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const base64Content = fileBuffer.toString('base64');
    
    // Create file document in Firestore with file content
    const fileDocumentData: CreateFileData = {
      userId,
      filename: uniqueFilename,
      originalName,
      size,
      mimeType,
      filePath,
      status: 'pending_payment', // Set initial status
      uploadedAt: new Date().toISOString(),
      fileContent: base64Content, // Store file content as base64
      metadata: metadata || {}
    };

    const fileRef = adminDb.collection('files').doc();
    const fileId = fileRef.id;

    const fileDocument = {
      id: fileId,
      ...fileDocumentData,
      // Store file buffer temporarily (should be moved to Firebase Storage)
      fileBuffer: fileBuffer.toString('base64'), // Temporary - will be migrated
      status: 'pending_payment', // Initial status - waiting for payment
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await fileRef.set(fileDocument);

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
    return NextResponse.json(
      { success: false, message: 'An error occurred during upload' },
      { status: 500 }
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