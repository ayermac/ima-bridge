export type ImaAccountInfo = {
  guid: string;
  token: string;
  refreshToken: string;
  uid: string;
};

export interface WebSessionProvider {
  getAccountInfo(): Promise<ImaAccountInfo | null>;
  ensureLoggedIn(): Promise<ImaAccountInfo>;
  clearLogin(): Promise<void>;
}

export type KnowledgeBase = {
  id: string;
  name: string;
  type: number;
  member_count: number;
  cover_url: string;
  size: string;
  description: string;
  update_time: string;
  status_toast: string;
  access_status: number;
  creator_name: string;
  creator_avatar: string;
  file_count: number;
};

export type DocumentItem = {
  title: string;
  media_id: string;
  media_type: number;
  file_size: string;
  create_time: string;
  update_time: string;
  parent_folder_id: string;
  folder_info: unknown;
  access_status: number;
  _path: string;
  is_folder?: boolean;
  folder_id?: string;
};

export type FolderPathItem = {
  id: string;
  name: string;
  path: string;
};

export type KnowledgeFolderPage = {
  folderId: string;
  path: string;
  items: DocumentItem[];
  folders: DocumentItem[];
  documents: DocumentItem[];
  totalItems: number;
  nextCursor: string;
  isEnd: boolean;
  totalSize: number;
};

export type KnowledgeCollection = {
  folders: DocumentItem[];
  documents: DocumentItem[];
  totalFolders: number;
  totalDocuments: number;
};

export type ResolvedMedia = {
  data: Record<string, unknown>;
  url: string;
};

export type ExportedContent = {
  title: string;
  content: string;
  mimeType: string;
  extension: string;
};

export interface KnowledgeSource {
  listKnowledgeBases(): Promise<KnowledgeBase[]>;
  listFolder(knowledgeBaseId: string, folderId?: string, path?: string, cursor?: string, limit?: number): Promise<KnowledgeFolderPage>;
  collectDocuments(knowledgeBaseId: string): Promise<KnowledgeCollection>;
  resolveMedia(mediaId: string): Promise<ResolvedMedia>;
  exportNote(mediaId: string, format: "md" | "html"): Promise<ExportedContent>;
  exportWechat(mediaId: string): Promise<ExportedContent>;
}

export type UploadFileInput = {
  filePath: string;
  title: string;
  knowledgeBaseId: string;
};

export type UploadResult = {
  success: boolean;
  mediaId?: string;
  error?: string;
};

export type ImportUrlsInput = {
  urls: string[];
  knowledgeBaseId: string;
};

export type ImportUrlsResult = {
  success: boolean;
  results?: unknown[];
  error?: string;
};

export type CreateNoteInput = {
  title: string;
  content: string;
};

export type CreateNoteResult = {
  success: boolean;
  noteId?: string;
  error?: string;
};

export type AddNoteInput = {
  noteId: string;
  knowledgeBaseId: string;
};

export interface KnowledgeTarget {
  listAddableKnowledgeBases(): Promise<KnowledgeBase[]>;
  uploadFile(input: UploadFileInput): Promise<UploadResult>;
  importUrls(input: ImportUrlsInput): Promise<ImportUrlsResult>;
  createNote(input: CreateNoteInput): Promise<CreateNoteResult>;
  addNoteToKnowledgeBase(input: AddNoteInput): Promise<void>;
}

export interface RuntimeAdapter {
  chooseDirectory(): Promise<string | null>;
  saveFile(path: string, data: ArrayBuffer | string): Promise<void>;
  downloadUrl(url: string, path: string, headers?: Record<string, string>): Promise<void>;
  openPath(path: string): Promise<void>;
  storeSecret(key: string, value: string): Promise<void>;
  readSecret(key: string): Promise<string | null>;
}

export type QueueItemStatus =
  | "pending"
  | "resolving"
  | "downloading"
  | "exporting"
  | "preparing"
  | "uploading"
  | "done"
  | "synced"
  | "failed"
  | "sync_failed"
  | "skipped";

export type QueueItem = {
  id: string;
  sourceKnowledgeBaseId: string;
  sourceKnowledgeBaseName: string;
  mediaId: string;
  mediaType: number;
  title: string;
  sourcePath: string;
  status: QueueItemStatus;
  localPath?: string;
  targetKnowledgeBaseId?: string;
  error?: string;
  progress?: number;
  createdAt: number;
  updatedAt: number;
};

export type DuplicatePolicy = "reject" | "rename" | "skip";

export type MediaTypeMap = Record<number, string>;
