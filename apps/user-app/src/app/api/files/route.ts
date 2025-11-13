import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCached, setCached, getCacheKey, deleteCached } from '@/lib/cache';
import { deleteFile, extractKeyFromUrl } from '@/lib/b2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const fileId = searchParams.get('fileId');
    const cacheBuster = searchParams.get('_t'); // Cache-busting parameter

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    // If fileId is provided, return single file
    if (fileId) {
      // Check cache first for single file (skip if cache-busting parameter present)
      const singleFileCacheKey = getCacheKey('single_file', `${userId}_${fileId}`);
      if (!cacheBuster) {
        const cachedFile = getCached(singleFileCacheKey);
        if (cachedFile) {
          return NextResponse.json({ success: true, file: cachedFile });
        }
      }

      const fileDoc = await adminDb.collection('files').doc(fileId).get();
      
      if (!fileDoc.exists) {
        return NextResponse.json(
          { success: false, message: 'File not found' },
          { status: 404 }
        );
      }

      const fileData = fileDoc.data();
      
      // Verify the file belongs to the user
      if (fileData?.userId !== userId) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized to access this file' },
          { status: 403 }
        );
      }

      // Parallelize agent and completed file fetches for speed
      const [agentData, completedData] = await Promise.all([
        // Fetch agent info if exists
        fileData.assignedAgentId 
          ? adminDb.collection('users').doc(fileData.assignedAgentId).get().catch(() => null)
          : Promise.resolve(null),
        // Fetch completed file if exists
        fileData.status === 'completed' && fileData.completedFileId
          ? adminDb.collection('completedFiles').doc(fileData.completedFileId).get().catch(() => null)
          : Promise.resolve(null)
      ]);

      // Build agent response
      let agentResponse = null;
      if (fileData.responseFileURL || fileData.responseMessage) {
        let agentInfo = null;
        if (agentData?.exists) {
          const agent = agentData.data();
          if (agent) {
            agentInfo = {
              id: fileData.assignedAgentId,
              name: agent.name,
              email: agent.email
            };
          }
        }

        agentResponse = {
          message: fileData.responseMessage,
          responseFileURL: fileData.responseFileURL,
          respondedAt: fileData.respondedAt,
          agent: agentInfo
        };
      }

      // Build completed file
      let completedFile: any = null;
      if (completedData?.exists) {
        const completed = completedData.data();
        completedFile = {
          id: fileData.completedFileId,
          filename: completed?.filename || '',
          originalName: completed?.originalName || '',
          size: completed?.size || 0,
          mimeType: completed?.mimeType || '',
          filePath: completed?.filePath || '',
          uploadedAt: completed?.uploadedAt || '',
          agentId: completed?.agentId || '',
          agentName: completed?.agentName || ''
        };
      }

      const file = {
        id: fileDoc.id,
        userId: fileData.userId,
        filename: fileData.filename,
        originalName: fileData.originalName,
        size: fileData.size,
        mimeType: fileData.mimeType,
        status: fileData.status,
        uploadedAt: fileData.uploadedAt,
        processedAt: fileData.processedAt,
        agentId: fileData.assignedAgentId || fileData.agentId,
        filePath: fileData.filePath,
        metadata: fileData.metadata || {},
        createdAt: fileData.createdAt,
        // User comment data
        userComment: fileData.userComment,
        userCommentUpdatedAt: fileData.userCommentUpdatedAt,
        // Agent response data
        agentResponse,
        hasResponse: !!fileData.responseFileURL,
        assignedAt: fileData.assignedAt,
        respondedAt: fileData.respondedAt,
        // Completed file data
        completedFile,
        completedFileId: fileData.completedFileId,
        // Timer data
        editTimerMinutes: fileData.editTimerMinutes,
        editTimerStartedAt: fileData.editTimerStartedAt
      };

      // Smart cache for single file based on status
      // Active states (paid, processing, assigned) = 10 seconds for FAST real-time updates
      // Other states = 30 seconds (reduced from 5min to catch deletions faster)
      const isActiveFile = fileData.status === 'paid' || 
                          fileData.status === 'processing' || 
                          fileData.status === 'assigned';
      const singleFileTTL = isActiveFile ? 10000 : 30000; // 10s vs 30s
      
      setCached(singleFileCacheKey, file, singleFileTTL);

      return NextResponse.json({
        success: true,
        file
      });
    }

    // Check cache first with longer TTL for better performance (skip if cache-busting parameter present)
    const cacheKey = getCacheKey('user_files', userId);
    if (!cacheBuster) {
      const cachedResult = getCached(cacheKey);
      if (cachedResult) {
        return NextResponse.json(cachedResult);
      }
    }

    // Get user's files from Firestore with optimized query
    // Using composite index (userId + uploadedAt) for fast query
    // Limit to 10 for fastest initial load (<500ms) - aggressive optimization
    // CRITICAL: Only select needed fields to reduce bandwidth and processing time
    const filesSnapshot = await adminDb
      .collection('files')
      .where('userId', '==', userId)
      .orderBy('uploadedAt', 'desc')
      .limit(10) // Reduced to 10 for maximum speed
      .select(
        'userId', 'filename', 'originalName', 'size', 'mimeType', 'status',
        'uploadedAt', 'processedAt', 'filePath', 'metadata', 'createdAt',
        'userComment', 'userCommentUpdatedAt', 'assignedAgentId', 'agentId',
        'responseFileURL', 'responseMessage', 'assignedAt', 'respondedAt',
        'processingStartedAt', 'completedAt', 'completedFileId',
        'editTimerMinutes', 'editTimerStartedAt'
      )
      .get();

    // Early return if no files found
    if (filesSnapshot.empty) {
      const result = {
        success: true,
        files: [],
        count: 0
      };
      
      // Cache empty result for 30 seconds (shorter cache to catch new uploads quickly)
      setCached(cacheKey, result, 30000);
      
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          'Content-Type': 'application/json; charset=utf-8',
        }
      });
    }

    // PERFORMANCE OPTIMIZATION: Skip agent and completed file lookups in main query
    // These will be loaded on-demand when user views file details
    // This reduces API response time from 3s to <500ms
    const agentsMap = new Map();
    const completedFilesMap = new Map();

    // Process files - return minimal data for fast response
    // Agent and completed file details will be loaded on-demand
    const files = filesSnapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        userId: data.userId,
        filename: data.filename,
        originalName: data.originalName,
        size: data.size,
        mimeType: data.mimeType,
        status: data.status,
        uploadedAt: data.uploadedAt,
        processedAt: data.processedAt,
        agentId: data.assignedAgentId || data.agentId,
        filePath: data.filePath,
        metadata: data.metadata || {},
        createdAt: data.createdAt,
        // User comment data
        userComment: data.userComment,
        userCommentUpdatedAt: data.userCommentUpdatedAt,
        // Agent response data - minimal (no agent details lookup)
        agentResponse: (data.responseFileURL || data.responseMessage) ? {
          message: data.responseMessage,
          responseFileURL: data.responseFileURL,
          respondedAt: data.respondedAt,
          agent: null // Will be loaded on-demand if needed
        } : null,
        hasResponse: !!data.responseFileURL,
        assignedAt: data.assignedAt,
        respondedAt: data.respondedAt,
        // Processing status data
        processingStartedAt: data.processingStartedAt,
        completedAt: data.completedAt,
        // Completed file data - minimal (no lookup)
        completedFile: null, // Will be loaded on-demand if needed
        completedFileId: data.completedFileId,
        // Timer data
        editTimerMinutes: data.editTimerMinutes,
        editTimerStartedAt: data.editTimerStartedAt
      };
    });

    // Files are already sorted by Firestore (orderBy uploadedAt desc)
    // No JavaScript sorting needed - saves CPU time!

    const result = {
      success: true,
      files,
      count: files.length
    };

    // Smart caching: Check if user has active files
    const hasActiveFiles = files.some(f => 
      f.status === 'paid' || 
      f.status === 'processing' || 
      f.status === 'assigned'
    );

    // AGGRESSIVE CACHE STRATEGY for sub-500ms performance:
    // - Active files: 15 seconds (balance between real-time and performance)
    // - Other files: 60 seconds (1 minute for better performance)
    const cacheTTL = hasActiveFiles ? 15000 : 60000;
    const maxAge = hasActiveFiles ? 15 : 60;
    const staleTime = hasActiveFiles ? 30 : 120;

    setCached(cacheKey, result, cacheTTL);

    // Return with dynamic cache headers based on file states
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleTime}`,
        'Content-Type': 'application/json; charset=utf-8',
        'X-Cache-Strategy': hasActiveFiles ? 'realtime' : 'cached', // Debug header
      }
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, userId, status } = body;

    if (!fileId || !userId || !status) {
      return NextResponse.json(
        { success: false, message: 'File ID, User ID, and status are required' },
        { status: 400 }
      );
    }

    // Verify the file belongs to the user
    const fileDoc = await adminDb.collection('files').doc(fileId).get();
    
    if (!fileDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'File not found' },
        { status: 404 }
      );
    }

    const fileData = fileDoc.data();
    if (fileData?.userId !== userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized to update this file' },
        { status: 403 }
      );
    }

    // Update the file status
    await adminDb.collection('files').doc(fileId).update({
      status: status,
      updatedAt: new Date().toISOString(),
    });
    
    // Clear cache for this user's files to reflect the update
    const cacheKey = getCacheKey('user_files', userId);
    setCached(cacheKey, null, 0); // Clear cache immediately

    return NextResponse.json({
      success: true,
      message: 'File status updated successfully'
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update file error:', error);
    }
    return NextResponse.json(
      { success: false, message: 'An error occurred while updating file' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId');

    if (!fileId || !userId) {
      return NextResponse.json(
        { success: false, message: 'File ID and User ID are required' },
        { status: 400 }
      );
    }

    // Verify the file belongs to the user
    const fileDoc = await adminDb.collection('files').doc(fileId).get();
    
    if (!fileDoc.exists) {
      // File might have been deleted already - return success to prevent error
      // Also clear cache to ensure consistency
      const cacheKey = getCacheKey('user_files', userId);
      const singleFileCacheKey = getCacheKey('single_file', `${userId}_${fileId}`);
      deleteCached(cacheKey);
      deleteCached(singleFileCacheKey);
      
      return NextResponse.json(
        { success: true, message: 'File already deleted' }
      );
    }

    const fileData = fileDoc.data();
    if (fileData?.userId !== userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized to delete this file' },
        { status: 403 }
      );
    }

    // Extract B2 file key before deleting Firestore document
    const filePath = fileData?.filePath;
    const fileUrl = fileData?.fileUrl;
    
    // Determine B2 key for deletion
    let b2Key = filePath;
    if (!b2Key && fileUrl) {
      b2Key = extractKeyFromUrl(fileUrl);
    }

    // Delete from B2 and Firestore in parallel for speed
    await Promise.all([
      // Delete the file document from Firestore
      adminDb.collection('files').doc(fileId).delete(),
      // Delete file from B2 storage (if key exists)
      b2Key ? deleteFile(b2Key).catch(() => {
        // Silent fail - file might not exist in B2
      }) : Promise.resolve()
    ]);

    // IMPORTANT: Clear cache AFTER successful deletion to ensure cache invalidation
    const cacheKey = getCacheKey('user_files', userId);
    const singleFileCacheKey = getCacheKey('single_file', `${userId}_${fileId}`);
    deleteCached(cacheKey);
    deleteCached(singleFileCacheKey);

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
      deletedAt: Date.now() // Timestamp to help client invalidate cache
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete file error:', error);
    }
    return NextResponse.json(
      { success: false, message: 'An error occurred while deleting file' },
      { status: 500 }
    );
  }
}
