import { contextBridge, ipcRenderer } from "electron";
import path from "path";
import type { ImaAccountInfo, ElectronRuntimeApi, ApiLogEntry } from "@runtime/adapter";

const api: ElectronRuntimeApi = {
  getAccountInfo: () => ipcRenderer.invoke("ima:getAccountInfo"),
  clearAccountInfo: () => ipcRenderer.invoke("ima:clearAccountInfo"),
  setAccountInfo: (info: ImaAccountInfo) => ipcRenderer.invoke("ima:setAccountInfo", info),
  startLoginServer: () => ipcRenderer.invoke("ima:startLoginServer"),
  chooseDirectory: () => ipcRenderer.invoke("ima:chooseDirectory"),
  saveFile: (filePath: string, data: string) => ipcRenderer.invoke("ima:saveFile", filePath, data),
  downloadUrl: (url: string, filePath: string) => ipcRenderer.invoke("ima:downloadUrl", url, filePath),
  openPath: (filePath: string) => ipcRenderer.invoke("ima:openPath", filePath),
  joinPath: (...segments: string[]) => path.join(...segments),
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
  onOpenApiConfigChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("ima:openApiConfigChanged", handler);
    return () => ipcRenderer.removeListener("ima:openApiConfigChanged", handler);
  },
  onApiLog: (callback) => {
    const handler = (_event: unknown, entry: ApiLogEntry) => callback(entry);
    ipcRenderer.on("ima:apiLog", handler);
    return () => ipcRenderer.removeListener("ima:apiLog", handler);
  },
  apiFetch: async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const result = await ipcRenderer.invoke("ima:apiFetch", url, init);
    return {
      ok: result.ok,
      status: result.status,
      data: result.data,
      text: result.text,
      headers: result.headers as Record<string, string>,
    };
  },
  downloadBinaryBase64: (url: string, headers?: Record<string, string>) => ipcRenderer.invoke("ima:downloadBinaryBase64", url, headers),
};

contextBridge.exposeInMainWorld("electronRuntime", api);
