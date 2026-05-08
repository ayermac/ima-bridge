import type { RuntimeAdapter, WebSessionProvider, ImaAccountInfo, KnowledgeBase, DuplicatePolicy } from "@core/types";

export type { RuntimeAdapter, WebSessionProvider, ImaAccountInfo, KnowledgeBase, DuplicatePolicy };

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

// ElectronRuntimeAdapter is implemented in main process and exposed via IPC
export type ElectronRuntimeApi = {
  openLoginWindow(): Promise<void>;
  closeLoginWindow(): Promise<void>;
  getAccountInfo(): Promise<ImaAccountInfo | null>;
  clearAccountInfo(): Promise<void>;
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
  onLoginWindowClosed(callback: () => void): () => void;
  onOpenApiConfigChanged(callback: () => void): () => void;
  apiFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string }): Promise<Response>;
};

declare global {
  interface Window {
    electronRuntime: ElectronRuntimeApi;
  }
}
