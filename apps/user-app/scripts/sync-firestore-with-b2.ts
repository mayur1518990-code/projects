/**
 * Sync Firestore with Backblaze B2
 * 
 * This script checks for orphaned Firestore records where files were deleted
 * directly from B2 but the metadata still exists in Firestore.
 * 
 * Usage:
 * npx tsx scripts/sync-firestore-with-b2.ts [--dry-run] [--delete-orphans]
 * 
 * Options:
 * --dry-run          Show what would be deleted without actually deleting
 * --delete-orphans   Delete orphaned Firestore records (requires confirmation)
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(__dirname, '../.env.local') });

import AWS from 'aws-sdk';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');
const deleteOrphans = process.argv.includes('--delete-orphans');

// B2 Configuration
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET || 'docuploader';
const B2_ENDPOINT = process.env.B2_ENDPOINT || 'https://s3.eu-central-003.backblazeb2.com';
const B2_APPLICATION_KEY_ID = process.env.B2_APPLICATION_KEY_ID || process.env.B2_KEY_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY || process.env.B2_APP_KEY;

// Firebase Admin Configuration
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

// Validate configuration
if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY) {
  console.error('❌ Error: B2 credentials not found');
  console.error('Please set B2_KEY_ID and B2_APP_KEY in .env.local');
  process.exit(1);
}

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error('❌ Error: Firebase credentials not found');
  console.error('Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env.local');
  process.exit(1);
}

// Initialize B2 S3 client
const s3 = new AWS.S3({
  endpoint: B2_ENDPOINT,
  accessKeyId: B2_APPLICATION_KEY_ID,
  secretAccessKey: B2_APPLICATION_KEY,
  region: 'eu-central-003',
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
});

// Initialize Firebase Admin
const adminApp = getApps().length === 0 
  ? initializeApp({
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY,
      }),
    })
  : getApps()[0];

const adminDb = getFirestore(adminApp);

interface FileRecord {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  filePath: string;
  fileUrl?: string;
  status: string;
  uploadedAt: string;
}

interface OrphanRecord {
  firestoreId: string;
  filePath: string;
  originalName: string;
  userId: string;
  status: string;
}

/**
 * Get all files from B2 bucket
 */
async function listB2Files(): Promise<Set<string>> {
  const b2Files = new Set<string>();
  let continuationToken: string | undefined;

  console.log('📋 Listing all files in B2 bucket...');

  do {
    const params: AWS.S3.ListObjectsV2Request = {
      Bucket: B2_BUCKET_NAME,
      ContinuationToken: continuationToken,
    };

    const response = await s3.listObjectsV2(params).promise();

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          b2Files.add(obj.Key);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`✅ Found ${b2Files.size} files in B2\n`);
  return b2Files;
}

/**
 * Get all file records from Firestore
 */
async function listFirestoreFiles(): Promise<FileRecord[]> {
  console.log('📋 Listing all file records in Firestore...');
  
  const snapshot = await adminDb.collection('files').get();
  const files: FileRecord[] = [];

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    files.push({
      id: doc.id,
      userId: data.userId || 'unknown',
      filename: data.filename || 'unknown',
      originalName: data.originalName || 'unknown',
      filePath: data.filePath || '',
      fileUrl: data.fileUrl,
      status: data.status || 'unknown',
      uploadedAt: data.uploadedAt || data.createdAt || 'unknown',
    });
  });

  console.log(`✅ Found ${files.length} file records in Firestore\n`);
  return files;
}

/**
 * Check if a file exists in B2
 */
async function fileExistsInB2(key: string): Promise<boolean> {
  try {
    await s3.headObject({
      Bucket: B2_BUCKET_NAME,
      Key: key,
    }).promise();
    return true;
  } catch (error: any) {
    if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
      return false;
    }
    // For other errors, assume file might exist
    return true;
  }
}

/**
 * Find orphaned Firestore records
 */
async function findOrphanedRecords(
  firestoreFiles: FileRecord[],
  b2Files: Set<string>
): Promise<OrphanRecord[]> {
  console.log('🔍 Checking for orphaned Firestore records...\n');
  
  const orphans: OrphanRecord[] = [];
  let checked = 0;

  for (const file of firestoreFiles) {
    checked++;
    
    // Show progress
    if (checked % 10 === 0 || checked === firestoreFiles.length) {
      process.stdout.write(`   Checked ${checked}/${firestoreFiles.length} records...\r`);
    }

    // Skip if no filePath
    if (!file.filePath) {
      continue;
    }

    // Check if file exists in B2
    const existsInB2 = b2Files.has(file.filePath);

    if (!existsInB2) {
      // Double-check with API call to be sure
      const confirmedExists = await fileExistsInB2(file.filePath);
      
      if (!confirmedExists) {
        orphans.push({
          firestoreId: file.id,
          filePath: file.filePath,
          originalName: file.originalName,
          userId: file.userId,
          status: file.status,
        });
      }
    }
  }

  console.log('\n');
  return orphans;
}

/**
 * Delete orphaned Firestore records
 */
async function deleteOrphanedRecords(orphans: OrphanRecord[]): Promise<number> {
  let deleted = 0;

  for (const orphan of orphans) {
    try {
      await adminDb.collection('files').doc(orphan.firestoreId).delete();
      deleted++;
      console.log(`   ✅ Deleted: ${orphan.originalName} (${orphan.firestoreId})`);
    } catch (error: any) {
      console.error(`   ❌ Failed to delete ${orphan.firestoreId}:`, error.message);
    }
  }

  return deleted;
}

/**
 * Main sync function
 */
async function syncFirestoreWithB2() {
  try {
    console.log('🚀 Starting Firestore-B2 Sync\n');
    console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : deleteOrphans ? 'DELETE ORPHANS' : 'READ ONLY'}\n`);

    // Get files from both sources
    const [b2Files, firestoreFiles] = await Promise.all([
      listB2Files(),
      listFirestoreFiles(),
    ]);

    // Find orphaned records
    const orphans = await findOrphanedRecords(firestoreFiles, b2Files);

    if (orphans.length === 0) {
      console.log('✅ No orphaned records found! Firestore is in sync with B2.\n');
      return;
    }

    console.log(`⚠️  Found ${orphans.length} orphaned Firestore record(s):\n`);

    // Display orphaned records
    orphans.forEach((orphan, index) => {
      console.log(`${index + 1}. ${orphan.originalName}`);
      console.log(`   File Path: ${orphan.filePath}`);
      console.log(`   User ID: ${orphan.userId}`);
      console.log(`   Status: ${orphan.status}`);
      console.log(`   Firestore ID: ${orphan.firestoreId}\n`);
    });

    // Handle deletion
    if (deleteOrphans && !isDryRun) {
      console.log('⚠️  You are about to DELETE these orphaned records from Firestore!');
      console.log('This action CANNOT be undone.\n');

      // In a real interactive script, you'd use readline for confirmation
      // For now, we require explicit flag
      console.log('🗑️  Deleting orphaned records...\n');
      
      const deleted = await deleteOrphanedRecords(orphans);

      console.log('\n📊 Deletion Summary:');
      console.log(`   Total orphaned records: ${orphans.length}`);
      console.log(`   Successfully deleted: ${deleted}`);
      console.log(`   Failed: ${orphans.length - deleted}\n`);
      console.log('✅ Sync complete!\n');
    } else if (isDryRun) {
      console.log('💡 DRY RUN: No records were deleted.');
      console.log('   Run with --delete-orphans flag to actually delete these records.\n');
    } else {
      console.log('💡 READ ONLY mode: No records were deleted.');
      console.log('   Run with --delete-orphans flag to delete these records.\n');
    }

    // Display statistics
    console.log('📈 Statistics:');
    console.log(`   Files in B2: ${b2Files.size}`);
    console.log(`   Records in Firestore: ${firestoreFiles.length}`);
    console.log(`   Orphaned records: ${orphans.length}`);
    console.log(`   Sync percentage: ${((1 - orphans.length / firestoreFiles.length) * 100).toFixed(2)}%\n`);

  } catch (error: any) {
    console.error('❌ Error during sync:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the sync
syncFirestoreWithB2().then(() => {
  console.log('✨ Done!');
  process.exit(0);
});

