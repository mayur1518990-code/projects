// Shared User model

export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "agent" | "admin";
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

export interface CreateUserData {
  email: string;
  name: string;
  password: string;
  role?: "user" | "agent" | "admin";
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  isActive?: boolean;
}
