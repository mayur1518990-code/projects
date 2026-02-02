import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getFileUrlForKey } from '@/lib/b2';

export const runtime = 'nodejs';

/**
 * POST /api/upload/complete
 * Body: { fileId }
 * Called after client has PUT the file directly to B2. Updates Firestore with fileUrl and status.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json(
        { success: false, message: 'fileId is required' },
        { status: 400 }
      );
    }

    const fileRef = adminDb.collection('files').doc(fileId);
    const fileSnap = await fileRef.get();

    if (!fileSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'File record not found' },
        { status: 404 }
      );
    }

    const data = fileSnap.data() as { status?: string; filePath?: string };
    if (data.status !== 'pending_upload') {
      return NextResponse.json(
        { success: false, message: 'File already completed or invalid state' },
        { status: 400 }
      );
    }

    const filePath = data.filePath;
    if (!filePath) {
      return NextResponse.json(
        { success: false, message: 'File path missing' },
        { status: 400 }
      );
    }

    const fileUrl = getFileUrlForKey(filePath);

    await fileRef.update({
      fileUrl,
      status: 'pending_payment',
      updatedAt: new Date().toISOString(),
    });

    const updated = (await fileRef.get()).data();

    // Invalidate cache
    import('@/lib/cache').then(({ getCacheKey, setCached }) => {
      const userId = updated?.userId;
      if (userId) {
        const cacheKey = getCacheKey('user_files', userId);
        setCached(cacheKey, null, 0);
      }
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        id: fileId,
        filename: updated?.filename,
        originalName: updated?.originalName,
        size: updated?.size,
        mimeType: updated?.mimeType,
        status: 'uploaded',
        uploadedAt: updated?.uploadedAt,
        filePath: updated?.filePath,
      },
    });
  } catch (error: any) {
    console.error('[Upload complete]', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to complete upload' },
      { status: 500 }
    );
  }
}
