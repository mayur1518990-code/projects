// Shared File model

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
  agentId?: string;
  filePath: string;
  metadata?: Record<string, any>;
}

export interface CreateFileData {
  userId: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  filePath: string;
  metadata?: Record<string, any>;
}

export interface UpdateFileData {
  status?: File["status"];
  agentId?: string;
  processedAt?: Date;
  metadata?: Record<string, any>;
}
