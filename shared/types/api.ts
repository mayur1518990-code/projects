// Shared API types

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  details?: Record<string, any>;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface RequestConfig {
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
}
