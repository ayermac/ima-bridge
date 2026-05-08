import { useEffect, useState, useCallback } from "react";
import type { ImaAccountInfo, ElectronRuntimeApi, ImaOpenApiConfigStatus, DuplicatePolicy } from "@runtime/adapter";

const api: ElectronRuntimeApi = (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).electronRuntime)
  ? ((window as unknown as Record<string, unknown>).electronRuntime as ElectronRuntimeApi)
  : (null as unknown as ElectronRuntimeApi);

export function useAccountInfo() {
  const [account, setAccount] = useState<ImaAccountInfo | null>(null);

  useEffect(() => {
    if (!api) return;
    api.getAccountInfo().then(setAccount).catch(() => setAccount(null));
    const unsub = api.onAccountInfoChanged((info) => setAccount(info));
    return unsub;
  }, []);

  const openLogin = useCallback(() => {
    if (!api) return;
    api.openLoginWindow();
  }, []);

  const closeLogin = useCallback(() => {
    if (!api) return;
    api.closeLoginWindow();
  }, []);

  const clearLogin = useCallback(() => {
    if (!api) return;
    api.clearAccountInfo().then(() => setAccount(null));
  }, []);

  return { account, openLogin, closeLogin, clearLogin };
}

export async function createImaWebApi(account: ImaAccountInfo) {
  const fetchViaMain: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const result = await api.apiFetch(url, {
      method: init?.method,
      headers: init?.headers as Record<string, string> | undefined,
      body: init?.body as string | undefined,
    });
    return result;
  };
  const { ImaWebApi } = await import("@core/ima-web-api");
  return new ImaWebApi(account, fetchViaMain);
}

export function useRuntime() {
  const chooseDirectory = useCallback(async () => {
    if (!api) return null;
    return api.chooseDirectory();
  }, []);

  const saveFile = useCallback(async (filePath: string, data: string) => {
    if (!api) throw new Error("Runtime not available");
    return api.saveFile(filePath, data);
  }, []);

  const downloadUrl = useCallback(async (url: string, filePath: string) => {
    if (!api) throw new Error("Runtime not available");
    return api.downloadUrl(url, filePath);
  }, []);

  const openPath = useCallback(async (filePath: string) => {
    if (!api) return;
    return api.openPath(filePath);
  }, []);

  const joinPath = useCallback((...segments: string[]) => {
    if (!api) return segments.join("/");
    return api.joinPath(...segments);
  }, []);

  return { chooseDirectory, saveFile, downloadUrl, openPath, joinPath };
}

export function useOpenApiConfigStatus() {
  const [configStatus, setConfigStatus] = useState<ImaOpenApiConfigStatus>({
    configured: false,
    hasClientId: false,
    hasApiKey: false,
  });

  const refreshOpenApiConfigStatus = useCallback(async () => {
    if (!api) return;
    const status = await api.getOpenApiConfigStatus();
    setConfigStatus(status);
  }, []);

  useEffect(() => {
    refreshOpenApiConfigStatus().catch(() => {
      setConfigStatus({ configured: false, hasClientId: false, hasApiKey: false });
    });
  }, [refreshOpenApiConfigStatus]);

  useEffect(() => {
    if (!api) return;
    const unsub = api.onOpenApiConfigChanged(() => {
      refreshOpenApiConfigStatus().catch(() => {
        setConfigStatus({ configured: false, hasClientId: false, hasApiKey: false });
      });
    });
    return unsub;
  }, [refreshOpenApiConfigStatus]);

  return { configStatus, refreshOpenApiConfigStatus };
}

export function useOpenApiSettings() {
  const [settingsStatus, setSettingsStatus] = useState<ImaOpenApiConfigStatus>({
    configured: false,
    hasClientId: false,
    hasApiKey: false,
  });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!api) return;
    const status = await api.getOpenApiSettingsStatus();
    setSettingsStatus(status);
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      setSettingsStatus({ configured: false, hasClientId: false, hasApiKey: false });
    });
  }, [refresh]);

  useEffect(() => {
    if (!api) return;
    const unsub = api.onOpenApiConfigChanged(() => {
      refresh().catch(() => {
        setSettingsStatus({ configured: false, hasClientId: false, hasApiKey: false });
      });
    });
    return unsub;
  }, [refresh]);

  const saveSettings = useCallback(async (clientId: string, apiKey: string) => {
    if (!api) throw new Error("Runtime not available");
    setSaving(true);
    try {
      const result = await api.saveOpenApiSettings(clientId, apiKey);
      await refresh();
      return result;
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const clearSettings = useCallback(async () => {
    if (!api) throw new Error("Runtime not available");
    setSaving(true);
    try {
      const result = await api.clearOpenApiSettings();
      await refresh();
      return result;
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  return { settingsStatus, saving, saveSettings, clearSettings, refresh };
}

export function useDuplicatePolicy() {
  const [policy, setPolicy] = useState<DuplicatePolicy>("reject");

  const refresh = useCallback(async () => {
    if (!api) return;
    const p = await api.getDuplicatePolicy();
    setPolicy(p);
  }, []);

  useEffect(() => {
    refresh().catch(() => setPolicy("reject"));
  }, [refresh]);

  const savePolicy = useCallback(async (newPolicy: DuplicatePolicy) => {
    if (!api) throw new Error("Runtime not available");
    await api.saveDuplicatePolicy(newPolicy);
    setPolicy(newPolicy);
  }, []);

  return { policy, savePolicy, refresh };
}

export function useSyncApi() {
  const listAddableKnowledgeBases = useCallback(async () => {
    if (!api) throw new Error("Runtime not available");
    return api.listAddableKnowledgeBases();
  }, []);

  const syncFileToKnowledgeBase = useCallback(
    (params: Parameters<ElectronRuntimeApi["syncFileToKnowledgeBase"]>[0]) => {
      if (!api) throw new Error("Runtime not available");
      return api.syncFileToKnowledgeBase(params);
    },
    []
  );

  const syncContentToKnowledgeBase = useCallback(
    (params: Parameters<ElectronRuntimeApi["syncContentToKnowledgeBase"]>[0]) => {
      if (!api) throw new Error("Runtime not available");
      return api.syncContentToKnowledgeBase(params);
    },
    []
  );

  const loadQueueState = useCallback(async () => {
    if (!api) return null;
    return api.loadQueueState();
  }, []);

  const saveQueueState = useCallback(async (state: { version: 1; queue: Array<Record<string, unknown>>; downloadDir: string | null; targetKnowledgeBaseId: string | null }) => {
    if (!api) return;
    return api.saveQueueState(state as Parameters<ElectronRuntimeApi["saveQueueState"]>[0]);
  }, []);

  const clearQueueState = useCallback(async () => {
    if (!api) return;
    return api.clearQueueState();
  }, []);

  return { listAddableKnowledgeBases, syncFileToKnowledgeBase, syncContentToKnowledgeBase, loadQueueState, saveQueueState, clearQueueState };
}
