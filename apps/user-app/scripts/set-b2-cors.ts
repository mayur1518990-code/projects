/**
 * Set CORS on your B2 bucket so the browser can PUT files directly (direct-to-B2 upload).
 * Run once; uses the same B2 credentials as your app (.env.local).
 *
 * Usage (from apps/user-app):
 *   npm run set-b2-cors
 *
 * Optional: add production origin(s) via env before running:
 *   CORS_ORIGINS=https://your-app.vercel.app,https://www.yoursite.com npm run set-b2-cors
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import AWS from 'aws-sdk';

const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET || 'docuploader';
const B2_ENDPOINT = process.env.B2_ENDPOINT || 'https://s3.eu-central-003.backblazeb2.com';
const B2_APPLICATION_KEY_ID = process.env.B2_APPLICATION_KEY_ID || process.env.B2_KEY_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY || process.env.B2_APP_KEY;

if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY) {
  console.error('❌ B2_KEY_ID and B2_APP_KEY must be set in .env.local');
  process.exit(1);
}

const s3 = new AWS.S3({
  endpoint: B2_ENDPOINT,
  accessKeyId: B2_APPLICATION_KEY_ID,
  secretAccessKey: B2_APPLICATION_KEY,
  region: 'eu-central-003',
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
});

// Default: localhost for dev; add more via CORS_ORIGINS (comma-separated)
const extraOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  ...extraOrigins,
];

async function main() {
  console.log('Setting CORS on B2 bucket:', B2_BUCKET_NAME);
  console.log('Allowed origins:', allowedOrigins.join(', ') || '(none)');

  try {
    await s3.putBucketCors({
      Bucket: B2_BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedOrigins: allowedOrigins,
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }).promise();

    console.log('✅ CORS updated. You can upload from the browser now.');
    if (extraOrigins.length === 0) {
      console.log('   For production, run: CORS_ORIGINS=https://your-app.vercel.app npm run set-b2-cors');
    }
  } catch (err: any) {
    console.error('❌ Failed to set CORS:', err.message || err);
    process.exit(1);
  }
}

main();
