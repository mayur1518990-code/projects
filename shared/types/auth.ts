// Shared authentication types

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "agent" | "admin";
  permissions?: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  refreshToken?: string;
  message?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}
