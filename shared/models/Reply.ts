// Shared Reply model

export interface Reply {
  id: string;
  fileId: string;
  agentId: string;
  message: string;
  createdAt: Date;
  updatedAt?: Date;
  isRead: boolean;
  attachments?: string[];
}

export interface CreateReplyData {
  fileId: string;
  agentId: string;
  message: string;
  attachments?: string[];
}

export interface UpdateReplyData {
  message?: string;
  isRead?: boolean;
  attachments?: string[];
}
