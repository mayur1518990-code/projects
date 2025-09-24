// Database connection and utilities for user-app

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface File {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  uploadedAt: Date;
  processedAt?: Date;
}

export interface Payment {
  id: string;
  userId: string;
  fileId: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: Date;
}

// TODO: Implement actual database connection
export class Database {
  // Placeholder methods - implement with your preferred database
  async createUser(userData: Partial<User>): Promise<User> {
    throw new Error("Not implemented");
  }

  async getUserById(id: string): Promise<User | null> {
    throw new Error("Not implemented");
  }

  async createFile(fileData: Partial<File>): Promise<File> {
    throw new Error("Not implemented");
  }

  async getFilesByUserId(userId: string): Promise<File[]> {
    throw new Error("Not implemented");
  }

  async createPayment(paymentData: Partial<Payment>): Promise<Payment> {
    throw new Error("Not implemented");
  }

  async updatePaymentStatus(id: string, status: Payment["status"]): Promise<void> {
    throw new Error("Not implemented");
  }
}

export const db = new Database();
