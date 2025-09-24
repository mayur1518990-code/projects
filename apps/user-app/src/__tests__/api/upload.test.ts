/**
 * Smoke tests for upload API endpoint
 * 
 * These tests verify that the API returns the expected response shape
 * without requiring a full database setup.
 */

import { NextRequest } from 'next/server';
import { POST } from '../../app/api/upload/route';

// Mock Firebase Admin
jest.mock('../../lib/firebase-admin', () => ({
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        id: 'test-file-id',
        set: jest.fn(() => Promise.resolve())
      }))
    }))
  }
}));

describe('Upload API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/upload', () => {
    it('should return 400 when required fields are missing', async () => {
      const formData = new FormData();
      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('File and userId are required');
    });

    it('should return 400 when file type is not supported', async () => {
      const formData = new FormData();
      const file = new File(['test content'], 'test.exe', { type: 'application/x-executable' });
      formData.append('file', file);
      formData.append('userId', 'test-user-id');
      
      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('File type not supported');
    });

    it('should return 400 when file size exceeds limit', async () => {
      const formData = new FormData();
      // Create a large file (25MB)
      const largeContent = 'x'.repeat(25 * 1024 * 1024);
      const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' });
      formData.append('file', file);
      formData.append('userId', 'test-user-id');
      
      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('File size exceeds 20MB limit');
    });

    it('should upload file successfully when valid data is provided', async () => {
      const formData = new FormData();
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      formData.append('file', file);
      formData.append('userId', 'test-user-id');
      formData.append('metadata', JSON.stringify({ uploadedVia: 'test' }));
      
      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('File uploaded successfully');
      expect(data.file).toBeDefined();
      expect(data.file.id).toBe('test-file-id');
      expect(data.file.originalName).toBe('test.pdf');
      expect(data.file.status).toBe('uploaded');
    });
  });
});

