import { contextBridge, ipcRenderer } from "electron";
import type { ImaAccountInfo, ElectronRuntimeApi } from "@runtime/adapter";

const api: ElectronRuntimeApi = {
  openLoginWindow: () => ipcRenderer.invoke("ima:openLoginWindow"),
  closeLoginWindow: () => ipcRenderer.invoke("ima:closeLoginWindow"),
  getAccountInfo: () => ipcRenderer.invoke("ima:getAccountInfo"),
  clearAccountInfo: () => ipcRenderer.invoke("ima:clearAccountInfo"),
  chooseDirectory: () => ipcRenderer.invoke("ima:chooseDirectory"),
  saveFile: (filePath: string, data: string) => ipcRenderer.invoke("ima:saveFile", filePath, data),
  downloadUrl: (url: string, filePath: string) => ipcRenderer.invoke("ima:downloadUrl", url, filePath),
  openPath: (filePath: string) => ipcRenderer.invoke("ima:openPath", filePath),
  getOpenApiConfigStatus: () => ipcRenderer.invoke("ima:getOpenApiConfigStatus"),
  getOpenApiSettingsStatus: () => ipcRenderer.invoke("ima:getOpenApiSettingsStatus"),
  saveOpenApiSettings: (clientId: string, apiKey: string) => ipcRenderer.invoke("ima:saveOpenApiSettings", clientId, apiKey),
  clearOpenApiSettings: () => ipcRenderer.invoke("ima:clearOpenApiSettings"),
  getDuplicatePolicy: () => ipcRenderer.invoke("ima:getDuplicatePolicy"),
  saveDuplicatePolicy: (policy: string) => ipcRenderer.invoke("ima:saveDuplicatePolicy", policy),
  listAddableKnowledgeBases: () => ipcRenderer.invoke("ima:listAddableKnowledgeBases"),
  syncFileToKnowledgeBase: (params: { localFilePath: string; targetKnowledgeBaseId: string; title: string }) =>
    ipcRenderer.invoke("ima:syncFileToKnowledgeBase", params),
  syncContentToKnowledgeBase: (params: { targetKnowledgeBaseId: string; title: string; mediaType: number; url?: string; localFilePath?: string }) =>
    ipcRenderer.invoke("ima:syncContentToKnowledgeBase", params),
  loadQueueState: () => ipcRenderer.invoke("ima:loadQueueState"),
  saveQueueState: (state: { version: 1; queue: unknown[]; downloadDir: string | null; targetKnowledgeBaseId: string | null }) =>
    ipcRenderer.invoke("ima:saveQueueState", state),
  clearQueueState: () => ipcRenderer.invoke("ima:clearQueueState"),
  onAccountInfoChanged: (callback) => {
    const handler = (_event: unknown, account: ImaAccountInfo | null) => callback(account);
    ipcRenderer.on("ima:accountInfoChanged", handler);
    return () => ipcRenderer.removeListener("ima:accountInfoChanged", handler);
  },
  onLoginWindowClosed: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("ima:loginWindowClosed", handler);
    return () => ipcRenderer.removeListener("ima:loginWindowClosed", handler);
  },
  onOpenApiConfigChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("ima:openApiConfigChanged", handler);
    return () => ipcRenderer.removeListener("ima:openApiConfigChanged", handler);
  },
  apiFetch: async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const result = await ipcRenderer.invoke("ima:apiFetch", url, init);
    return {
      ok: result.ok,
      status: result.status,
      json: async () => result.data,
      text: async () => result.text,
      headers: new Map(Object.entries(result.headers)),
    } as unknown as Response;
  },
};

contextBridge.exposeInMainWorld("electronRuntime", api);
