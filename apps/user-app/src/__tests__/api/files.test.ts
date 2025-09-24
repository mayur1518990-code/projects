/**
 * Smoke tests for files API endpoints
 * 
 * These tests verify that the API returns the expected response shape
 * without requiring a full database setup.
 */

import { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from '../../app/api/files/route';

// Mock Firebase Admin
jest.mock('../../lib/firebase-admin', () => ({
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({
          exists: true,
          data: () => ({
            id: 'test-file-id',
            userId: 'test-user-id',
            filename: 'test.pdf',
            originalName: 'test.pdf',
            size: 1024,
            mimeType: 'application/pdf',
            status: 'pending_payment',
            uploadedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          })
        })),
        update: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve())
      })),
      where: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({
          docs: []
        })),
        select: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({
            docs: []
          }))
        }))
      }))
    }))
  }
}));

// Mock cache
jest.mock('../../lib/cache', () => ({
  getCached: jest.fn(() => null),
  setCached: jest.fn(),
  getCacheKey: jest.fn((prefix, ...parts) => `${prefix}:${parts.join(':')}`)
}));

describe('Files API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/files', () => {
    it('should return 400 when userId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/files');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('User ID is required');
    });

    it('should return files list when userId is provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/files?userId=test-user-id');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.files)).toBe(true);
      expect(typeof data.count).toBe('number');
    });

    it('should return single file when fileId is provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/files?userId=test-user-id&fileId=test-file-id');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.file).toBeDefined();
      expect(data.file.id).toBe('test-file-id');
    });
  });

  describe('PATCH /api/files', () => {
    it('should return 400 when required fields are missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/files', {
        method: 'PATCH',
        body: JSON.stringify({})
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('File ID, User ID, and status are required');
    });

    it('should update file status when valid data is provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/files', {
        method: 'PATCH',
        body: JSON.stringify({
          fileId: 'test-file-id',
          userId: 'test-user-id',
          status: 'paid'
        })
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('File status updated successfully');
    });
  });

  describe('DELETE /api/files', () => {
    it('should return 400 when fileId or userId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/files');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('File ID and User ID are required');
    });

    it('should delete file when valid parameters are provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/files?fileId=test-file-id&userId=test-user-id');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('File deleted successfully');
    });
  });
});

