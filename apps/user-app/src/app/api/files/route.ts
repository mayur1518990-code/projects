import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCached, setCached, getCacheKey } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const fileId = searchParams.get('fileId');

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    // If fileId is provided, return single file
    if (fileId) {
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

      // Get agent response if file has been responded to
      let agentResponse = null;
      if (fileData.responseFileURL || fileData.responseMessage) {
        // Get agent information
        let agentInfo = null;
        if (fileData.assignedAgentId) {
          const agentDoc = await adminDb.collection('users').doc(fileData.assignedAgentId).get();
          if (agentDoc.exists) {
            const agentData = agentDoc.data();
            if (agentData) {
              agentInfo = {
                id: fileData.assignedAgentId,
                name: agentData.name,
                email: agentData.email
              };
            }
          }
        }

        agentResponse = {
          message: fileData.responseMessage,
          responseFileURL: fileData.responseFileURL,
          respondedAt: fileData.respondedAt,
          agent: agentInfo
        };
      }

      // If completed, include completed file data
      let completedFile: any = null;
      if (fileData.status === 'completed' && fileData.completedFileId) {
        const completedDoc = await adminDb.collection('completedFiles').doc(fileData.completedFileId).get();
        if (completedDoc.exists) {
          const completedData = completedDoc.data();
          completedFile = {
            id: fileData.completedFileId,
            filename: completedData?.filename || '',
            originalName: completedData?.originalName || '',
            size: completedData?.size || 0,
            mimeType: completedData?.mimeType || '',
            filePath: completedData?.filePath || '',
            uploadedAt: completedData?.uploadedAt || '',
            agentId: completedData?.agentId || '',
            agentName: completedData?.agentName || ''
          };
        }
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
        // Agent response data
        agentResponse,
        hasResponse: !!fileData.responseFileURL,
        assignedAt: fileData.assignedAt,
        respondedAt: fileData.respondedAt,
        // Completed file data
        completedFile,
        completedFileId: fileData.completedFileId
      };

      return NextResponse.json({
        success: true,
        file
      });
    }

    // Check cache first with longer TTL for better performance
    const cacheKey = getCacheKey('user_files', userId);
    const cachedResult = getCached(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    // Get user's files from Firestore with field selection to reduce data transfer
    // Exclude fileContent to improve performance
    const filesSnapshot = await adminDb
      .collection('files')
      .where('userId', '==', userId)
      .select('id', 'userId', 'filename', 'originalName', 'size', 'mimeType', 'status', 'uploadedAt', 'processedAt', 'assignedAgentId', 'agentId', 'filePath', 'metadata', 'createdAt', 'responseFileURL', 'responseMessage', 'respondedAt', 'assignedAt', 'processingStartedAt', 'completedAt', 'completedFileId')
      .get();

    // Batch collect all unique agent IDs and completed file IDs
    const agentIds = new Set<string>();
    const completedFileIds = new Set<string>();
    
    filesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.assignedAgentId) {
        agentIds.add(data.assignedAgentId);
      }
      if (data.status === 'completed' && data.completedFileId) {
        completedFileIds.add(data.completedFileId);
      }
    });

    // Batch fetch all agents and completed files in parallel
    const [agentsSnapshot, completedFilesSnapshot] = await Promise.all([
      agentIds.size > 0 ? adminDb.collection('users').where('__name__', 'in', Array.from(agentIds)).select('name', 'email').get() : Promise.resolve({ docs: [] }),
      completedFileIds.size > 0 ? adminDb.collection('completedFiles').where('__name__', 'in', Array.from(completedFileIds)).select('filename', 'originalName', 'size', 'mimeType', 'filePath', 'uploadedAt', 'agentId', 'agentName').get() : Promise.resolve({ docs: [] })
    ]);

    // Create lookup maps for O(1) access
    const agentsMap = new Map();
    agentsSnapshot.docs.forEach(doc => {
      agentsMap.set(doc.id, doc.data());
    });

    const completedFilesMap = new Map();
    completedFilesSnapshot.docs.forEach(doc => {
      completedFilesMap.set(doc.id, doc.data());
    });

    // Process files without async operations (much faster)
    const files = filesSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Get agent response if file has been responded to
      let agentResponse = null;
      if (data.responseFileURL || data.responseMessage) {
        // Get agent information from batch lookup
        let agentInfo = null;
        if (data.assignedAgentId && agentsMap.has(data.assignedAgentId)) {
          const agentData = agentsMap.get(data.assignedAgentId);
          if (agentData) {
            agentInfo = {
              id: data.assignedAgentId,
              name: agentData.name,
              email: agentData.email
            };
          }
        }

        agentResponse = {
          message: data.responseMessage,
          responseFileURL: data.responseFileURL,
          respondedAt: data.respondedAt,
          agent: agentInfo
        };
      }

      // Get completed file information from batch lookup
      let completedFile = null;
      if (data.status === 'completed' && data.completedFileId && completedFilesMap.has(data.completedFileId)) {
        const completedData = completedFilesMap.get(data.completedFileId);
        completedFile = {
          id: data.completedFileId,
          filename: completedData?.filename || '',
          originalName: completedData?.originalName || '',
          size: completedData?.size || 0,
          mimeType: completedData?.mimeType || '',
          filePath: completedData?.filePath || '',
          uploadedAt: completedData?.uploadedAt || '',
          agentId: completedData?.agentId || '',
          agentName: completedData?.agentName || ''
        };
      }

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
        agentId: data.assignedAgentId || data.agentId, // Use assignedAgentId if available
        filePath: data.filePath,
        metadata: data.metadata || {},
        createdAt: data.createdAt,
        // Agent response data
        agentResponse,
        hasResponse: !!data.responseFileURL,
        assignedAt: data.assignedAt,
        respondedAt: data.respondedAt,
        // Processing status data
        processingStartedAt: data.processingStartedAt,
        completedAt: data.completedAt,
        // Completed file data
        completedFile,
        completedFileId: data.completedFileId
      };
    });

    // Sort files by uploadedAt in descending order (newest first)
    files.sort((a, b) => {
      const dateA = new Date(a.uploadedAt || a.createdAt || 0);
      const dateB = new Date(b.uploadedAt || b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });


    const result = {
      success: true,
      files,
      count: files.length
    };

    // Cache the result for 15 seconds to keep user view fresh on agent updates
    setCached(cacheKey, result, 15000);

    return NextResponse.json(result);

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
      return NextResponse.json(
        { success: false, message: 'File not found' },
        { status: 404 }
      );
    }

    const fileData = fileDoc.data();
    if (fileData?.userId !== userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized to delete this file' },
        { status: 403 }
      );
    }

    // Delete the file document and clear cache
    await adminDb.collection('files').doc(fileId).delete();
    
    // Clear cache for this user's files
    const cacheKey = getCacheKey('user_files', userId);
    setCached(cacheKey, null, 0); // Clear cache immediately

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
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
