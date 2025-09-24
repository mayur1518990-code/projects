// Shared constants

export const FILE_UPLOAD_LIMITS = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'pdf',
    'doc',
    'docx',
    'jpg',
    'jpeg',
    'png',
    'gif',
    'txt',
    'rtf'
  ],
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/rtf'
  ]
} as const;

export const USER_ROLES = {
  USER: 'user',
  AGENT: 'agent',
  ADMIN: 'admin'
} as const;

export const FILE_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded'
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh'
  },
  FILES: {
    UPLOAD: '/api/files/upload',
    LIST: '/api/files',
    GET: '/api/files/:id',
    UPDATE: '/api/files/:id',
    DELETE: '/api/files/:id'
  },
  PAYMENTS: {
    CREATE_ORDER: '/api/payments/create-order',
    VERIFY: '/api/payments/verify',
    REFUND: '/api/payments/refund'
  }
} as const;
