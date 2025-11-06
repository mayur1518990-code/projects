/**
 * Cleanup script for removing 0-byte hidden files from Backblaze B2
 * 
 * Run this script to clean up any 0-byte files that may have been created
 * due to failed uploads or other issues.
 * 
 * Usage:
 * npx ts-node scripts/cleanup-b2-hidden-files.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(__dirname, '../.env.local') });

import AWS from 'aws-sdk';

// B2 Configuration - ensure these match your .env.local
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET || 'docuploader';
const B2_ENDPOINT = process.env.B2_ENDPOINT || 'https://s3.eu-central-003.backblazeb2.com';
const B2_APPLICATION_KEY_ID = process.env.B2_APPLICATION_KEY_ID || process.env.B2_KEY_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY || process.env.B2_APP_KEY;

// Validate configuration
if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY) {
  console.error('❌ Error: B2 credentials not found in environment variables');
  console.error('Please ensure B2_KEY_ID and B2_APP_KEY are set in your .env.local');
  process.exit(1);
}

// Initialize S3 client
const s3 = new AWS.S3({
  endpoint: B2_ENDPOINT,
  accessKeyId: B2_APPLICATION_KEY_ID,
  secretAccessKey: B2_APPLICATION_KEY,
  region: 'eu-central-003',
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
});

interface FileToClean {
  key: string;
  size: number;
  lastModified: Date;
}

async function listAllFiles(): Promise<FileToClean[]> {
  const allFiles: FileToClean[] = [];
  let continuationToken: string | undefined;

  console.log('📋 Listing all files in bucket...');

  do {
    const params: AWS.S3.ListObjectsV2Request = {
      Bucket: B2_BUCKET_NAME,
      ContinuationToken: continuationToken,
    };

    const response = await s3.listObjectsV2(params).promise();

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Size !== undefined && obj.LastModified) {
          allFiles.push({
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified,
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return allFiles;
}

async function deleteFile(key: string): Promise<boolean> {
  try {
    await s3.deleteObject({
      Bucket: B2_BUCKET_NAME,
      Key: key,
    }).promise();
    return true;
  } catch (error) {
    console.error(`Failed to delete ${key}:`, error);
    return false;
  }
}

async function cleanupZeroByteFiles() {
  try {
    console.log('🚀 Starting B2 cleanup process...\n');

    // List all files
    const allFiles = await listAllFiles();
    console.log(`✅ Found ${allFiles.length} total files\n`);

    // Find 0-byte files
    const zeroByteFiles = allFiles.filter(file => file.size === 0);
    
    if (zeroByteFiles.length === 0) {
      console.log('✅ No 0-byte files found. Bucket is clean!');
      return;
    }

    console.log(`⚠️  Found ${zeroByteFiles.length} hidden/0-byte files:\n`);
    
    // Display files to be deleted
    zeroByteFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.key} (${file.size} bytes, modified: ${file.lastModified.toISOString()})`);
    });

    console.log('\n🗑️  Deleting 0-byte files...\n');

    // Delete files
    let deleted = 0;
    let failed = 0;

    for (const file of zeroByteFiles) {
      const success = await deleteFile(file.key);
      if (success) {
        deleted++;
        console.log(`✅ Deleted: ${file.key}`);
      } else {
        failed++;
        console.log(`❌ Failed: ${file.key}`);
      }
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`   Total 0-byte files found: ${zeroByteFiles.length}`);
    console.log(`   Successfully deleted: ${deleted}`);
    console.log(`   Failed to delete: ${failed}`);
    console.log('\n✅ Cleanup complete!');

  } catch (error: any) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
cleanupZeroByteFiles();

