// Shared file-related types

export type FileStatus = "uploaded" | "processing" | "completed" | "failed";
export type FileType = "document" | "image" | "spreadsheet" | "presentation" | "other";

export interface FileUploadProgress {
  fileId: string;
  progress: number;
  status: "uploading" | "processing" | "completed" | "error";
  error?: string;
}

export interface FileFilter {
  status?: FileStatus[];
  userId?: string;
  agentId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}

export interface FileSort {
  field: "filename" | "uploadedAt" | "status" | "size";
  direction: "asc" | "desc";
}
