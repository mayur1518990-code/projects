#!/usr/bin/env node

/**
 * Migration script to move base64 file content from Firestore to Firebase Storage
 * 
 * This script:
 * 1. Finds all Firestore documents with base64 file content
 * 2. Uploads the content to Firebase Storage
 * 3. Updates the document to remove base64 and add storage URL
 * 4. Logs progress and creates a summary
 * 
 * Usage:
 *   Dry run: node migrate-firestore-files-20241220-143000.ts --dry-run
 *   Real run: node migrate-firestore-files-20241220-143000.ts
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/^"|"$/g, '') || '';
const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
};

const adminApp = getApps().length === 0 ? initializeApp(firebaseAdminConfig) : getApps()[0];
const adminDb = getFirestore(adminApp);
const adminStorage = getStorage(adminApp);

interface MigrationResult {
  totalDocuments: number;
  migratedDocuments: number;
  failedDocuments: number;
  skippedDocuments: number;
  errors: Array<{ docId: string; error: string }>;
  migratedFiles: Array<{ docId: string; storagePath: string; originalSize: number }>;
}

async function migrateFirestoreFiles(dryRun: boolean = false): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalDocuments: 0,
    migratedDocuments: 0,
    failedDocuments: 0,
    skippedDocuments: 0,
    errors: [],
    migratedFiles: []
  };

  console.log(`Starting migration ${dryRun ? '(DRY RUN)' : '(REAL RUN)'}...`);
  
  try {
    // Find all documents with base64 file content
    const filesSnapshot = await adminDb.collection('files').get();
    result.totalDocuments = filesSnapshot.docs.length;
    
    console.log(`Found ${result.totalDocuments} files to check`);

    for (const doc of filesSnapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      
      // Check if document has base64 content that needs migration
      const hasBase64Content = data.fileContent || data.fileBuffer;
      const alreadyMigrated = data.migrated === true;
      
      if (!hasBase64Content) {
        result.skippedDocuments++;
        console.log(`Skipping ${docId}: No base64 content found`);
        continue;
      }
      
      if (alreadyMigrated) {
        result.skippedDocuments++;
        console.log(`Skipping ${docId}: Already migrated`);
        continue;
      }

      try {
        const base64Content = data.fileContent || data.fileBuffer;
        if (!base64Content) {
          result.skippedDocuments++;
          continue;
        }

        // Extract file info
        const userId = data.userId;
        const filename = data.filename || data.originalName || 'unknown';
        const mimeType = data.mimeType || 'application/octet-stream';
        
        // Create storage path
        const storagePath = `user-uploads/${userId}/${docId}/${filename}`;
        
        console.log(`Processing ${docId}: ${filename} (${base64Content.length} chars)`);
        
        if (!dryRun) {
          // Convert base64 to buffer
          const fileBuffer = Buffer.from(base64Content, 'base64');
          
          // Upload to Firebase Storage
          const bucket = adminStorage.bucket();
          const file = bucket.file(storagePath);
          
          await file.save(fileBuffer, {
            metadata: {
              contentType: mimeType,
              metadata: {
                originalFilename: filename,
                userId: userId,
                migratedAt: new Date().toISOString(),
                migratedFrom: 'firestore'
              }
            }
          });
          
          // Make file publicly readable (optional - adjust based on your security needs)
          await file.makePublic();
          
          // Update Firestore document
          const updateData = {
            storageUrl: `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
            storagePath: storagePath,
            migrated: true,
            migratedAt: new Date().toISOString(),
            // Remove base64 content
            fileContent: null,
            fileBuffer: null
          };
          
          await adminDb.collection('files').doc(docId).update(updateData);
          
          result.migratedFiles.push({
            docId,
            storagePath,
            originalSize: base64Content.length
          });
        }
        
        result.migratedDocuments++;
        console.log(`✓ ${dryRun ? 'Would migrate' : 'Migrated'} ${docId}`);
        
      } catch (error) {
        result.failedDocuments++;
        result.errors.push({
          docId,
          error: error instanceof Error ? error.message : String(error)
        });
        console.error(`✗ Failed to migrate ${docId}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
  
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  try {
    const result = await migrateFirestoreFiles(dryRun);
    
    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Total documents: ${result.totalDocuments}`);
    console.log(`Migrated: ${result.migratedDocuments}`);
    console.log(`Failed: ${result.failedDocuments}`);
    console.log(`Skipped: ${result.skippedDocuments}`);
    
    if (result.errors.length > 0) {
      console.log('\n=== ERRORS ===');
      result.errors.forEach(error => {
        console.log(`${error.docId}: ${error.error}`);
      });
    }
    
    if (result.migratedFiles.length > 0) {
      console.log('\n=== MIGRATED FILES ===');
      result.migratedFiles.forEach(file => {
        console.log(`${file.docId}: ${file.storagePath} (${file.originalSize} chars)`);
      });
    }
    
    // Save summary to file
    const summaryPath = `user-app/migrations/migrate-firestore-files-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const fs = require('fs');
    const path = require('path');
    
    // Ensure migrations directory exists
    const migrationsDir = path.dirname(summaryPath);
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }
    
    fs.writeFileSync(summaryPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      dryRun,
      result
    }, null, 2));
    
    console.log(`\nSummary saved to: ${summaryPath}`);
    
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main();
}

export { migrateFirestoreFiles };

