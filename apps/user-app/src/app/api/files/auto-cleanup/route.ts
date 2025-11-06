import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getFileMetadata } from '@/lib/b2';

/**
 * Automatic cleanup endpoint - verifies files exist in B2 and removes orphaned records
 * Can be triggered manually or set up as a cron job
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const authHeader = request.headers.get('authorization');
    
    // Basic auth check (you can improve this)
    if (!authHeader && !userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    let query = adminDb.collection('files');
    
    // If userId provided, only check that user's files
    if (userId) {
      query = query.where('userId', '==', userId) as any;
    }

    const filesSnapshot = await query.get();
    
    const results = {
      total: filesSnapshot.docs.length,
      checked: 0,
      valid: 0,
      orphaned: 0,
      deleted: 0,
      errors: [] as string[],
    };

    // Check files in batches to avoid overwhelming B2
    const BATCH_SIZE = 10;
    const files = filesSnapshot.docs;
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (doc) => {
        const fileData = doc.data();
        const filePath = fileData.filePath;
        
        results.checked++;
        
        if (!filePath) {
          return;
        }

        try {
          // Check if file exists in B2
          await getFileMetadata(filePath);
          results.valid++;
        } catch (error: any) {
          // File doesn't exist in B2
          if (error.message && error.message.includes('not found')) {
            results.orphaned++;
            
            try {
              // Delete orphaned record
              await adminDb.collection('files').doc(doc.id).delete();
              results.deleted++;
              
              if (process.env.NODE_ENV === 'development') {
                console.log(`Auto-cleanup: Deleted orphaned record ${doc.id} (${fileData.originalName})`);
              }
            } catch (deleteError: any) {
              results.errors.push(`Failed to delete ${doc.id}: ${deleteError.message}`);
            }
          } else {
            results.errors.push(`Error checking ${doc.id}: ${error.message}`);
          }
        }
      }));
      
      // Small delay between batches
      if (i + BATCH_SIZE < files.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Auto-cleanup complete',
      results
    });

  } catch (error: any) {
    console.error('Auto-cleanup error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during auto-cleanup' },
      { status: 500 }
    );
  }
}

