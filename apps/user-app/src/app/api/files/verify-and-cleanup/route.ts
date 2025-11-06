import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getFileMetadata } from '@/lib/b2';

/**
 * Verify file exists in B2 and cleanup if it doesn't
 * This endpoint can be called to verify a specific file or all files for a user
 */
export async function POST(request: NextRequest) {
  try {
    const { fileId, userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    let filesToCheck: any[] = [];

    // If specific fileId provided, check only that file
    if (fileId) {
      const fileDoc = await adminDb.collection('files').doc(fileId).get();
      if (fileDoc.exists) {
        filesToCheck = [{ id: fileDoc.id, ...fileDoc.data() }];
      }
    } else {
      // Check all files for the user
      const filesSnapshot = await adminDb
        .collection('files')
        .where('userId', '==', userId)
        .get();
      
      filesToCheck = filesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    const results = {
      checked: 0,
      valid: 0,
      deleted: 0,
      errors: [] as string[],
    };

    // Check each file
    for (const file of filesToCheck) {
      results.checked++;
      const filePath = file.filePath;

      if (!filePath) {
        continue;
      }

      try {
        // Check if file exists in B2
        await getFileMetadata(filePath);
        results.valid++;
      } catch (error: any) {
        // File doesn't exist in B2, delete from Firestore
        if (error.message.includes('not found')) {
          try {
            await adminDb.collection('files').doc(file.id).delete();
            results.deleted++;
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`Auto-deleted orphaned record: ${file.originalName} (${file.id})`);
            }
          } catch (deleteError) {
            results.errors.push(`Failed to delete ${file.id}`);
          }
        } else {
          results.errors.push(`Error checking ${file.id}: ${error.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Verification complete',
      results
    });

  } catch (error: any) {
    console.error('Verify and cleanup error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during verification' },
      { status: 500 }
    );
  }
}

