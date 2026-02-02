import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getSignedUploadUrl } from '@/lib/b2';

export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = [
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
  'image/svg+xml',
];

const inferMimeFromFilename = (filename: string): string => {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff',
    pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain', rtf: 'application/rtf', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip', rar: 'application/x-rar-compressed', svg: 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
};

const generateUniqueFilename = (originalName: string): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
  if (!extension || extension === originalName) return `${timestamp}_${randomString}`;
  return `${timestamp}_${randomString}.${extension}`;
};

// Direct-to-B2: no Vercel body limit; allow up to 100MB per file
const MAX_DIRECT_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * POST /api/upload/presign
 * Body: { userId, originalName, size, mimeType?, metadata? }
 * Returns presigned PUT URL so client uploads file directly to B2 (bypasses 4.5MB serverless limit).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, originalName, size, mimeType: mimeTypeRaw, metadata } = body;

    if (!userId || !originalName || size == null) {
      return NextResponse.json(
        { success: false, message: 'userId, originalName, and size are required' },
        { status: 400 }
      );
    }

    const mimeType = (mimeTypeRaw && typeof mimeTypeRaw === 'string' && mimeTypeRaw.trim())
      ? mimeTypeRaw
      : inferMimeFromFilename(originalName);

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { success: false, message: `File type not supported: ${mimeType}` },
        { status: 400 }
      );
    }

    if (size <= 0) {
      return NextResponse.json(
        { success: false, message: 'File size must be greater than 0' },
        { status: 400 }
      );
    }

    if (size > MAX_DIRECT_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, message: 'File size exceeds 100MB limit' },
        { status: 400 }
      );
    }

    const uniqueFilename = generateUniqueFilename(originalName);
    const filePath = `uploads/${userId}/${uniqueFilename}`;

    const fileRef = adminDb.collection('files').doc();
    const fileId = fileRef.id;
    const timestamp = new Date().toISOString();

    const fileDocument = {
      id: fileId,
      userId,
      filename: uniqueFilename,
      originalName,
      size,
      mimeType,
      filePath,
      fileUrl: '', // set in complete after client PUT to B2
      status: 'pending_upload',
      uploadedAt: timestamp,
      createdAt: timestamp,
      metadata: metadata || {},
    };

    await fileRef.set(fileDocument);

    const expiresIn = 900; // 15 min
    const uploadUrl = getSignedUploadUrl(filePath, mimeType, expiresIn);

    return NextResponse.json({
      success: true,
      uploadUrl,
      fileId,
      filePath,
      mimeType,
      expiresIn,
      filename: uniqueFilename,
    });
  } catch (error: any) {
    console.error('[Upload presign]', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to get upload URL' },
      { status: 500 }
    );
  }
}
