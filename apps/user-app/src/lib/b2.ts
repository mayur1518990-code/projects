import AWS from 'aws-sdk';

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 300
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.code === 'NoSuchKey' || error.code === 'NotFound' || error.statusCode === 404) {
        throw error;
      }
      
      // If this was the last attempt, throw
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}

// Backblaze B2 configuration
// Support multiple naming conventions for environment variables
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET || 'docuploader';
const B2_ENDPOINT = process.env.B2_ENDPOINT || 'https://s3.eu-central-003.backblazeb2.com';
const B2_APPLICATION_KEY_ID = process.env.B2_APPLICATION_KEY_ID || process.env.B2_KEY_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY || process.env.B2_APP_KEY;

// Initialize S3 client for Backblaze B2 (S3-compatible API)
const s3 = new AWS.S3({
  endpoint: B2_ENDPOINT,
  accessKeyId: B2_APPLICATION_KEY_ID,
  secretAccessKey: B2_APPLICATION_KEY,
  region: 'eu-central-003', // B2 doesn't require region but some SDKs need it
  s3ForcePathStyle: true, // Required for B2
  signatureVersion: 'v4',
});

export interface UploadFileResult {
  url: string;
  key: string;
  bucket: string;
}

/**
 * Upload a file to Backblaze B2 storage
 * @param buffer - File buffer to upload
 * @param key - Object key (path) in B2 bucket
 * @param mimeType - MIME type of the file
 * @returns Upload result with URL and key
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<UploadFileResult> {
  if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY) {
    throw new Error('B2 credentials are not configured. Please set B2_APPLICATION_KEY_ID and B2_APPLICATION_KEY environment variables.');
  }

  // Validate buffer
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty file buffer');
  }

  const params: AWS.S3.PutObjectRequest = {
    Bucket: B2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ServerSideEncryption: 'AES256', // SSE-B2 enabled
  };

  try {
    // Use retry logic for upload reliability with longer retries for large files
    const startTime = Date.now();
    const result = await retryWithBackoff(
      () => s3.upload(params).promise(),
      2, // Reduced to 2 retries for faster failure (was 3)
      500 // Increased base delay to 500ms for better reliability
    );
    
    const uploadTime = Date.now() - startTime;
    
    // Log slow uploads for monitoring
    if (uploadTime > 5000) {
      console.warn(`Slow B2 upload detected: ${uploadTime}ms for ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // Construct the public URL
    const url = result.Location || `${B2_ENDPOINT}/${B2_BUCKET_NAME}/${key}`;
    
    return {
      url,
      key: result.Key,
      bucket: result.Bucket || B2_BUCKET_NAME,
    };
  } catch (error: any) {
    console.error('B2 upload error:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      key,
      size: buffer.length
    });
    
    // Provide more specific error messages
    if (error.code === 'NetworkingError' || error.code === 'ECONNREFUSED') {
      throw new Error('Network error connecting to storage. Please check your internet connection.');
    } else if (error.code === 'RequestTimeout') {
      throw new Error('Storage connection timeout. File may be too large.');
    } else if (error.statusCode === 403) {
      throw new Error('Storage authentication failed. Please contact support.');
    } else {
      throw new Error(`Storage upload failed: ${error.message || 'Unknown error'}`);
    }
  }
}

/**
 * Delete a file from Backblaze B2 storage (including all versions if versioning is enabled)
 * @param key - Object key (path) to delete
 * @returns True if successful
 */
export async function deleteFile(key: string): Promise<boolean> {
  if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY) {
    throw new Error('B2 credentials are not configured. Please set B2_APPLICATION_KEY_ID and B2_APPLICATION_KEY environment variables.');
  }

  try {
    // List all versions of the file (handles versioning)
    const versions = await s3.listObjectVersions({
      Bucket: B2_BUCKET_NAME,
      Prefix: key,
    }).promise();

    // Collect all version IDs to delete
    const objectsToDelete: AWS.S3.ObjectIdentifierList = [];

    // Add all file versions
    if (versions.Versions) {
      for (const version of versions.Versions) {
        if (version.Key === key && version.VersionId) {
          objectsToDelete.push({
            Key: key,
            VersionId: version.VersionId,
          });
        }
      }
    }

    // Add all delete markers
    if (versions.DeleteMarkers) {
      for (const marker of versions.DeleteMarkers) {
        if (marker.Key === key && marker.VersionId) {
          objectsToDelete.push({
            Key: key,
            VersionId: marker.VersionId,
          });
        }
      }
    }

    // If no versions found, try simple delete (non-versioned bucket or file doesn't exist)
    if (objectsToDelete.length === 0) {
      await s3.deleteObject({
        Bucket: B2_BUCKET_NAME,
        Key: key,
      }).promise();
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Deleted file from B2 (no versions): ${key}`);
      }
      return true;
    }

    // Delete all versions and markers at once
    const deleteResult = await s3.deleteObjects({
      Bucket: B2_BUCKET_NAME,
      Delete: {
        Objects: objectsToDelete,
        Quiet: false,
      },
    }).promise();

    if (process.env.NODE_ENV === 'development') {
      console.log(`Deleted ${objectsToDelete.length} version(s) of ${key} from B2`);
      if (deleteResult.Deleted && deleteResult.Deleted.length > 0) {
        console.log(`Successfully deleted: ${deleteResult.Deleted.length} version(s)`);
      }
      if (deleteResult.Errors && deleteResult.Errors.length > 0) {
        console.error(`Failed to delete: ${deleteResult.Errors.length} version(s)`, deleteResult.Errors);
      }
    }

    return true;
  } catch (error: any) {
    console.error('B2 delete error:', error);
    // Don't throw - file might not exist, which is OK
    return false;
  }
}

/**
 * Get a file from Backblaze B2 storage as a stream
 * @param key - Object key (path) to retrieve
 * @returns File stream
 */
export async function getFileStream(key: string): Promise<NodeJS.ReadableStream> {
  if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY) {
    throw new Error('B2 credentials are not configured. Please set B2_APPLICATION_KEY_ID and B2_APPLICATION_KEY environment variables.');
  }

  const params: AWS.S3.GetObjectRequest = {
    Bucket: B2_BUCKET_NAME,
    Key: key,
  };

  try {
    const result = await s3.getObject(params).promise();
    
    // Convert to readable stream if needed
    if (result.Body instanceof Buffer) {
      const { Readable } = require('stream');
      const stream = new Readable();
      stream.push(result.Body);
      stream.push(null);
      return stream;
    }
    
    // If already a stream, return as-is
    if (result.Body && typeof (result.Body as any).pipe === 'function') {
      return result.Body as NodeJS.ReadableStream;
    }
    
    throw new Error('Unexpected response type from B2');
  } catch (error: any) {
    if (error.code === 'NoSuchKey') {
      throw new Error(`File not found in B2: ${key}`);
    }
    console.error('B2 get file error:', error);
    throw new Error(`Failed to retrieve file from B2: ${error.message}`);
  }
}

/**
 * Get file buffer from Backblaze B2 storage
 * @param key - Object key (path) to retrieve
 * @returns File buffer
 */
export async function getFileBuffer(key: string): Promise<Buffer> {
  if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY) {
    throw new Error('B2 credentials are not configured. Please set B2_APPLICATION_KEY_ID and B2_APPLICATION_KEY environment variables.');
  }

  const params: AWS.S3.GetObjectRequest = {
    Bucket: B2_BUCKET_NAME,
    Key: key,
  };

  try {
    // Use retry logic for download reliability
    const result = await retryWithBackoff(
      () => s3.getObject(params).promise(),
      3, // 3 retries
      300 // 300ms base delay
    );
    
    if (result.Body instanceof Buffer) {
      return result.Body;
    }
    
    // Convert ArrayBuffer or Uint8Array to Buffer
    if (result.Body) {
      return Buffer.from(result.Body as any);
    }
    
    throw new Error('No file content received from B2');
  } catch (error: any) {
    if (error.code === 'NoSuchKey') {
      throw new Error(`File not found in B2: ${key}`);
    }
    console.error('B2 get file buffer error:', error);
    throw new Error(`Failed to retrieve file from B2: ${error.message}`);
  }
}

/**
 * Get file metadata from Backblaze B2 storage
 * @param key - Object key (path) to get metadata for
 * @returns File metadata
 */
export async function getFileMetadata(key: string): Promise<AWS.S3.HeadObjectOutput> {
  if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY) {
    throw new Error('B2 credentials are not configured. Please set B2_APPLICATION_KEY_ID and B2_APPLICATION_KEY environment variables.');
  }

  const params: AWS.S3.HeadObjectRequest = {
    Bucket: B2_BUCKET_NAME,
    Key: key,
  };

  try {
    return await s3.headObject(params).promise();
  } catch (error: any) {
    if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
      throw new Error(`File not found in B2: ${key}`);
    }
    console.error('B2 get metadata error:', error);
    throw new Error(`Failed to get file metadata from B2: ${error.message}`);
  }
}

/**
 * Generate a signed URL for direct B2 file download (much faster than server proxy)
 * @param key - Object key (path) to retrieve
 * @param expiresIn - URL expiration time in seconds (default: 300 = 5 minutes)
 * @param filename - Optional filename for download (forces download with correct name)
 * @returns Signed download URL
 */
export function getSignedDownloadUrl(key: string, expiresIn: number = 300, filename?: string): string {
  if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY) {
    throw new Error('B2 credentials are not configured. Please set B2_APPLICATION_KEY_ID and B2_APPLICATION_KEY environment variables.');
  }

  const params: any = {
    Bucket: B2_BUCKET_NAME,
    Key: key,
    Expires: expiresIn, // URL expires in specified seconds
  };

  // Force download with proper filename (instead of opening in browser)
  // Use RFC 5987 encoding for filename to avoid double-encoding issues
  if (filename) {
    // Escape quotes and backslashes in filename, but don't encode the whole thing
    // AWS SDK will handle the proper encoding in the query string
    const safeFilename = filename.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    params.ResponseContentDisposition = `attachment; filename="${safeFilename}"`;
  }

  try {
    // Generate presigned URL for direct download
    const signedUrl = s3.getSignedUrl('getObject', params);
    return signedUrl;
  } catch (error: any) {
    console.error('B2 signed URL generation error:', error);
    throw new Error(`Failed to generate download URL: ${error.message}`);
  }
}

/**
 * Extract B2 key from a B2 URL
 * @param url - B2 file URL
 * @returns Object key (path)
 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    // Handle different URL formats:
    // https://s3.eu-central-003.backblazeb2.com/docuploader/uploads/user123/file.pdf
    // or https://f003.backblazeb2.com/file/docuploader/uploads/user123/file.pdf
    
    // Try to extract from standard S3-compatible URL
    const s3Match = url.match(/\/docuploader\/(.+)$/);
    if (s3Match) {
      return decodeURIComponent(s3Match[1]);
    }
    
    // Try to extract from B2 friendly URL
    const friendlyMatch = url.match(/\/file\/docuploader\/(.+)$/);
    if (friendlyMatch) {
      return decodeURIComponent(friendlyMatch[1]);
    }
    
    // If URL doesn't match expected patterns, return null
    return null;
  } catch (error) {
    console.error('Error extracting key from URL:', error);
    return null;
  }
}

