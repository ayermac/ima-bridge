import type { RuntimeAdapter, WebSessionProvider, ImaAccountInfo, KnowledgeBase, DuplicatePolicy } from "@core/types";

export type { RuntimeAdapter, WebSessionProvider, ImaAccountInfo, KnowledgeBase, DuplicatePolicy };

export type ApiFetchResult = {
  ok: boolean;
  status: number;
  data: unknown;
  text: string;
  headers: Record<string, string>;
};

export type ImaOpenApiConfigStatus = {
  configured: boolean;
  hasClientId: boolean;
  hasApiKey: boolean;
  clientIdPreview?: string;
};

export type QueuePersistedState = {
  version: 1;
  queue: Array<{
    id: string;
    sourceKnowledgeBaseId: string;
    sourceKnowledgeBaseName: string;
    mediaId: string;
    mediaType: number;
    title: string;
    sourcePath: string;
    status: string;
    localPath?: string;
    targetKnowledgeBaseId?: string;
    error?: string;
    createdAt: number;
    updatedAt: number;
  }>;
  downloadDir: string | null;
  targetKnowledgeBaseId: string | null;
};

export type ApiLogEntry = {
  time: string;
  level: "info" | "error" | "warn";
  message: string;
};

export type ElectronRuntimeApi = {
  getAccountInfo(): Promise<ImaAccountInfo | null>;
  clearAccountInfo(): Promise<void>;
  setAccountInfo(info: ImaAccountInfo): Promise<void>;
  startLoginServer(): Promise<number>;
  chooseDirectory(): Promise<string | null>;
  saveFile(path: string, data: string): Promise<void>;
  downloadUrl(url: string, path: string): Promise<void>;
  openPath(path: string): Promise<void>;
  joinPath(...segments: string[]): string;
  getOpenApiConfigStatus(): Promise<ImaOpenApiConfigStatus>;
  getOpenApiSettingsStatus(): Promise<ImaOpenApiConfigStatus>;
  saveOpenApiSettings(clientId: string, apiKey: string): Promise<{ success: boolean }>;
  clearOpenApiSettings(): Promise<{ success: boolean }>;
  getDuplicatePolicy(): Promise<DuplicatePolicy>;
  saveDuplicatePolicy(policy: DuplicatePolicy): Promise<{ success: boolean }>;
  listAddableKnowledgeBases(): Promise<KnowledgeBase[]>;
  syncFileToKnowledgeBase(params: {
    localFilePath: string;
    targetKnowledgeBaseId: string;
    title: string;
  }): Promise<{ success: boolean; mediaId?: string; skipped?: boolean }>;
  syncContentToKnowledgeBase(params: {
    targetKnowledgeBaseId: string;
    title: string;
    mediaType: number;
    url?: string;
    localFilePath?: string;
  }): Promise<{ success: boolean; mediaId?: string; skipped?: boolean }>;
  loadQueueState(): Promise<QueuePersistedState | null>;
  saveQueueState(state: QueuePersistedState): Promise<void>;
  clearQueueState(): Promise<void>;
  onAccountInfoChanged(callback: (account: ImaAccountInfo | null) => void): () => void;
  onOpenApiConfigChanged(callback: () => void): () => void;
  onApiLog(callback: (entry: ApiLogEntry) => void): () => void;
  apiFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string }): Promise<ApiFetchResult>;
  downloadBinaryBase64(url: string, headers?: Record<string, string>): Promise<{ base64: string; contentType: string }>;
};

declare global {
  interface Window {
    electronRuntime: ElectronRuntimeApi;
  }
}
