import { useState, useCallback, useRef, useEffect } from "react";
import type { KnowledgeBase, DocumentItem, QueueItem, FolderPathItem } from "@core/types";
import { filenameFor, pathParts, cleanPathPart } from "@core/path-utils";
import type { ApiLogEntry } from "@runtime/adapter";
import { useAccountInfo, useRuntime, useOpenApiConfigStatus, useOpenApiSettings, useDuplicatePolicy, useSyncApi, createImaWebApi } from "./hooks/useIpc";
import LoginPanel from "./components/LoginPanel";
import KnowledgeBaseList from "./components/KnowledgeBaseList";
import DocumentList from "./components/DocumentList";
import DownloadQueue from "./components/DownloadQueue";
import TargetKbSelector from "./components/TargetKbSelector";
import SettingsPanel from "./components/SettingsPanel";

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const FOLDER_PAGE_SIZE = 50;
type AppSection = "library" | "queue" | "settings" | "logs";

export default function App() {
  const { account, openLogin, clearLogin, checkLoginStatus, manualLogin, loginWindowClosedCount } = useAccountInfo();
  const [loginPending, setLoginPending] = useState(false);
  const runtime = useRuntime();
  const { configStatus } = useOpenApiConfigStatus();
  const { settingsStatus, saving: savingSettings, saveSettings, clearSettings } = useOpenApiSettings();
  const { policy: duplicatePolicy, savePolicy: saveDuplicatePolicy } = useDuplicatePolicy();
  const syncApi = useSyncApi();
  const [downloadDir, setDownloadDir] = useState<string | null>(null);
  const [view, setView] = useState<"kb" | "doc">("kb");
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [currentBase, setCurrentBase] = useState<KnowledgeBase | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>("");
  const [folderPath, setFolderPath] = useState<FolderPathItem[]>([]);
  const [folderCursor, setFolderCursor] = useState("");
  const [folderHasMore, setFolderHasMore] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingKb, setLoadingKb] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [noteFormat, setNoteFormat] = useState<"md" | "html">("md");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [status, setStatus] = useState("");
  const [targetKbId, setTargetKbId] = useState<string | null>(null);
  const [section, setSection] = useState<AppSection>("library");
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const processingRef = useRef(false);
  const loadedRef = useRef(false);
  const queueTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountRef = useRef(account);
  accountRef.current = account;
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const startQueueWatchdog = useCallback(() => {
    if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
    queueTimeoutRef.current = setTimeout(() => {
      console.error("[queueWatchdog] 触发：队列处理超时，强制重置");
      processingRef.current = false;
      setQueue((prev) =>
        prev.map((q) => {
          if (["resolving", "downloading", "exporting", "preparing", "uploading"].includes(q.status)) {
            return { ...q, status: "failed" as const, error: "处理超时，请重试", updatedAt: Date.now() };
          }
          return q;
        })
      );
      setStatus("队列处理超时，已自动重置");
    }, 45000);
  }, []);

  const clearQueueWatchdog = useCallback(() => {
    if (queueTimeoutRef.current) {
      clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const api = (window as unknown as { electronRuntime?: { onApiLog?: (cb: (entry: ApiLogEntry) => void) => () => void } }).electronRuntime;
    if (!api || !api.onApiLog) return;
    return api.onApiLog((entry) => {
      setLogs((prev) => {
        const next = [...prev, entry];
        return next.length > 500 ? next.slice(next.length - 500) : next;
      });
    });
  }, []);

  const getApi = useCallback(async () => {
    const currentAccount = accountRef.current;
    if (!currentAccount) throw new Error("未登录");
    return createImaWebApi(currentAccount);
  }, []);

  const loadBases = useCallback(async () => {
    if (!account) {
      setStatus("请先登录");
      return;
    }
    setLoadingKb(true);
    setStatus("正在加载知识库列表...");
    try {
      const api = await getApi();
      const list = await api.listKnowledgeBases();
      setBases(list);
      setStatus(`已加载 ${list.length} 个知识库`);
    } catch (err) {
      setStatus(String((err as Error).message));
    } finally {
      setLoadingKb(false);
    }
  }, [account, getApi]);

  const loadFolder = useCallback(
    async (
      base: KnowledgeBase,
      folderId: string,
      path: string,
      nextPath: FolderPathItem[],
      cursor = "",
      append = false
    ) => {
      if (!account) return;
      setCurrentBase(base);
      setCurrentFolderId(folderId);
      setFolderPath(nextPath);
      setView("doc");
      setLoadingDoc(true);
      setStatus(`${append ? "正在继续加载" : "正在加载"}「${nextPath[nextPath.length - 1]?.name || base.name}」...`);
      try {
        const api = await getApi();
        const page = await api.listFolder(base.id, folderId, path, cursor, FOLDER_PAGE_SIZE);
        setDocuments((prev) => (append ? [...prev, ...page.items] : page.items));
        setFolderCursor(page.nextCursor);
        setFolderHasMore(!page.isEnd && !!page.nextCursor);
        const loadedCount = append ? documents.length + page.items.length : page.items.length;
        const totalText = page.totalSize ? ` / 共 ${page.totalSize} 项` : "";
        setStatus(`当前层级已加载 ${loadedCount}${totalText}，本页 ${page.folders.length} 个文件夹，${page.documents.length} 个文档`);
      } catch (err) {
        setStatus(String((err as Error).message));
      } finally {
        setLoadingDoc(false);
      }
    },
    [account, documents.length, getApi]
  );

  const openBase = useCallback(
    async (base: KnowledgeBase) => {
      await loadFolder(base, base.id, "", [{ id: base.id, name: base.name || "根目录", path: "" }]);
    },
    [loadFolder]
  );

  const openKnowledgeFolder = useCallback(
    async (folder: DocumentItem) => {
      if (!currentBase || !folder.folder_id) return;
      const nextPathValue = folder._path ? `${folder._path}/${folder.title}` : folder.title;
      await loadFolder(currentBase, folder.folder_id, nextPathValue, [
        ...folderPath,
        { id: folder.folder_id, name: folder.title || "未命名文件夹", path: nextPathValue },
      ]);
    },
    [currentBase, folderPath, loadFolder]
  );

  const openBreadcrumb = useCallback(
    async (index: number) => {
      if (!currentBase) return;
      const target = folderPath[index];
      if (!target) return;
      await loadFolder(currentBase, target.id, target.path, folderPath.slice(0, index + 1));
    },
    [currentBase, folderPath, loadFolder]
  );

  const loadMoreFolder = useCallback(async () => {
    if (!currentBase || !folderHasMore || loadingDoc) return;
    const currentPath = folderPath[folderPath.length - 1];
    await loadFolder(currentBase, currentFolderId || currentBase.id, currentPath?.path || "", folderPath, folderCursor, true);
  }, [currentBase, currentFolderId, folderCursor, folderHasMore, folderPath, loadFolder, loadingDoc]);

  const addQueueItem = useCallback((item: Omit<QueueItem, "id" | "createdAt" | "updatedAt">) => {
    const full: QueueItem = {
      ...item,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setQueue((prev) => [...prev, full]);
    return full.id;
  }, []);

  const updateQueueItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch, updatedAt: Date.now() } : q)));
  }, []);

  const removeQueueItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    // 同步设置锁，防止 React 重渲染时 useEffect 再次触发 processQueue
    processingRef.current = true;

    const pushLog = (level: "info" | "error" | "warn", message: string) => {
      setLogs((prev) => {
        const next = [...prev, { time: new Date().toLocaleTimeString(), level, message }];
        return next.length > 500 ? next.slice(next.length - 500) : next;
      });
    };

    // Step 1: 认领一个 pending item → resolving
    // 读取当前快照找 pending item
    const snapshot = queueRef.current;
    const pending = snapshot.filter((q) => q.status === "pending");
    const targetItem = pending[0];

    if (!targetItem) {
      processingRef.current = false;
      return;
    }

    // 标记为 resolving
    setQueue((prev) =>
      prev.map((q) =>
        q.id === targetItem.id ? { ...q, status: "resolving" as const, updatedAt: Date.now() } : q
      )
    );

    pushLog("info", `[队列] 开始处理: ${targetItem.title} (类型 ${targetItem.mediaType})`);
    setStatus(`处理中: ${targetItem.title}`);
    startQueueWatchdog();

    const setStatusInQueue = (status: QueueItem["status"]) => {
      setQueue((prev) => prev.map((q) => (q.id === targetItem!.id ? { ...q, status, updatedAt: Date.now() } : q)));
    };
    const markDone = (localPath: string) => {
      setQueue((prev) => prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "done" as const, localPath, updatedAt: Date.now() } : q)));
    };
    const markFailed = (error: string) => {
      setQueue((prev) => prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "failed" as const, error, updatedAt: Date.now() } : q)));
    };
    const markSyncFailed = (error: string) => {
      setQueue((prev) => prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "sync_failed" as const, error, updatedAt: Date.now() } : q)));
    };
    const markSkipped = (reason: string) => {
      setQueue((prev) => prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "skipped" as const, error: reason, updatedAt: Date.now() } : q)));
    };

    try {
      if (!downloadDir) throw new Error("未选择下载目录");
      const api = await getApi();
      let localPath = "";

      // Step 2: 根据类型处理
      if (targetItem.mediaType === 2) {
        pushLog("info", `[解析] 获取链接: ${targetItem.title}`);
        const media = await api.resolveMedia(targetItem.mediaId);
        pushLog("info", `[解析] 链接获取成功`);
        const title = cleanPathPart(targetItem.title || "ima-link");
        const rel = [...pathParts(targetItem.sourcePath), `${title}.txt`].join("/");
        localPath = runtime.joinPath(downloadDir, rel);
        await runtime.saveFile(localPath, String(media.url));
      } else if (targetItem.mediaType === 6) {
        pushLog("info", `[导出] 微信文章: ${targetItem.title}`);
        const exported = await api.exportWechat(targetItem.mediaId);
        pushLog("info", `[导出] 微信文章导出完成`);
        const rel = [...pathParts(targetItem.sourcePath), `${cleanPathPart(exported.title)}.html`].join("/");
        localPath = runtime.joinPath(downloadDir, rel);
        await runtime.saveFile(localPath, exported.content);
      } else if (targetItem.mediaType === 11) {
        setStatusInQueue("exporting");
        pushLog("info", `[导出] 笔记: ${targetItem.title}`);
        const exported = await api.exportNote(targetItem.mediaId, noteFormat);
        pushLog("info", `[导出] 笔记导出完成`);
        const rel = [...pathParts(targetItem.sourcePath), `${cleanPathPart(exported.title)}.${noteFormat}`].join("/");
        localPath = runtime.joinPath(downloadDir, rel);
        await runtime.saveFile(localPath, exported.content);
      } else {
        pushLog("info", `[解析] 获取下载链接: ${targetItem.title}`);
        const media = await api.resolveMedia(targetItem.mediaId);
        pushLog("info", `[下载] 开始下载文件`);
        setStatusInQueue("downloading");
        const rel = filenameFor(
          {
            title: targetItem.title,
            media_id: targetItem.mediaId,
            media_type: targetItem.mediaType,
            file_size: "",
            create_time: "",
            update_time: "",
            parent_folder_id: "",
            folder_info: null,
            access_status: 2,
            _path: targetItem.sourcePath,
          } as DocumentItem,
          media.data
        );
        localPath = runtime.joinPath(downloadDir, rel);
        await runtime.downloadUrl(media.url, localPath);
      }

      setQueue((prev) => prev.map((q) => (q.id === targetItem!.id ? { ...q, localPath, updatedAt: Date.now() } : q)));
      pushLog("info", `[完成] ${targetItem.title} → ${localPath}`);

      // Step 3: 同步到目标知识库（如有）
      if (targetItem.targetKnowledgeBaseId) {
        setStatusInQueue("uploading");
        pushLog("info", `[同步] 上传到目标知识库...`);

        let result: { success: boolean; mediaId?: string; skipped?: boolean } | null = null;

        if (targetItem.mediaType === 2 || targetItem.mediaType === 6) {
          const media = await api.resolveMedia(targetItem.mediaId);
          if (!media.url) { markSyncFailed("无法获取内容 URL"); return; }
          result = await syncApi.syncContentToKnowledgeBase({
            targetKnowledgeBaseId: targetItem.targetKnowledgeBaseId,
            title: targetItem.title,
            mediaType: targetItem.mediaType,
            url: media.url,
            localFilePath: targetItem.mediaType === 6 ? localPath : undefined,
          });
        } else if (targetItem.mediaType === 11) {
          if (!localPath) { markSyncFailed("笔记导出失败"); return; }
          result = await syncApi.syncContentToKnowledgeBase({
            targetKnowledgeBaseId: targetItem.targetKnowledgeBaseId,
            title: targetItem.title,
            mediaType: targetItem.mediaType,
            localFilePath: localPath,
          });
        } else {
          if (!localPath) { markSyncFailed("文件下载失败"); return; }
          result = await syncApi.syncFileToKnowledgeBase({
            localFilePath: localPath,
            targetKnowledgeBaseId: targetItem.targetKnowledgeBaseId,
            title: targetItem.title,
          });
        }

        if (result?.skipped) {
          markSkipped("目标知识库已有同名文件，已跳过");
        } else if (result?.success) {
          setQueue((prev) => prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "synced" as const, updatedAt: Date.now() } : q)));
          pushLog("info", `[同步] 同步成功`);
        } else {
          markSyncFailed("同步失败");
        }
      } else {
        markDone(localPath);
      }
    } catch (err) {
      const msg = (err as Error).message || "未知错误";
      pushLog("error", `[失败] ${targetItem.title}: ${msg}`);
      if (targetItem.targetKnowledgeBaseId) {
        markSyncFailed(msg);
      } else {
        markFailed(msg);
      }
    } finally {
      clearQueueWatchdog();
      processingRef.current = false;
      // 强制触发重渲染，让 useEffect 检查是否还有 pending items
      setQueue((prev) => [...prev]);
    }
  }, [downloadDir, getApi, noteFormat, runtime, syncApi, startQueueWatchdog, clearQueueWatchdog]);

  useEffect(() => {
    const pendingCount = queue.filter((q) => q.status === "pending").length;
    if (pendingCount === 0) return;
    if (!account) return;
    if (processingRef.current) return;
    processQueue();
  }, [queue, processQueue, account]);

  const enqueueDownload = useCallback(
    (doc: DocumentItem) => {
      if (!currentBase) return;
      addQueueItem({
        sourceKnowledgeBaseId: currentBase.id,
        sourceKnowledgeBaseName: currentBase.name,
        mediaId: doc.media_id,
        mediaType: doc.media_type,
        title: doc.title,
        sourcePath: doc._path,
        status: "pending",
      });
      setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), level: "info", message: `[入队] ${doc.title} (类型: ${doc.media_type})` }]);
      setStatus(`已加入队列: ${doc.title}`);
    },
    [currentBase, addQueueItem]
  );

  const enqueueSelected = useCallback(
    (docs: DocumentItem[]) => {
      for (const doc of docs) {
        enqueueDownload(doc);
      }
      setStatus(`已加入 ${docs.length} 项到下载队列`);
    },
    [enqueueDownload]
  );

  const enqueueSync = useCallback(
    (docs: DocumentItem[]) => {
      if (!currentBase || !targetKbId) return;
      for (const doc of docs) {
        addQueueItem({
          sourceKnowledgeBaseId: currentBase.id,
          sourceKnowledgeBaseName: currentBase.name,
          mediaId: doc.media_id,
          mediaType: doc.media_type,
          title: doc.title,
          sourcePath: doc._path,
          status: "pending",
          targetKnowledgeBaseId: targetKbId,
        });
      }
      setStatus(`已加入 ${docs.length} 项到同步队列`);
    },
    [currentBase, targetKbId, addQueueItem]
  );

  const retryItem = useCallback(
    (id: string) => {
      setQueue((prev) =>
        prev.map((q) => {
          if (q.id !== id) return q;
          // sync_failed / skipped 重试需要保留 targetKnowledgeBaseId 并重新走完整流程
          if (q.status === "sync_failed" || q.status === "skipped") {
            return { ...q, status: "pending" as const, error: undefined, updatedAt: Date.now() };
          }
          // failed 重试也重置为 pending
          return { ...q, status: "pending" as const, error: undefined, updatedAt: Date.now() };
        })
      );
    },
    []
  );

  const clearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((q) => q.status !== "done" && q.status !== "synced" && q.status !== "skipped"));
  }, []);

  const openLocalFolder = useCallback(
    async (filePath: string) => {
      const dir = filePath.substring(0, filePath.lastIndexOf("/")) || filePath;
      await runtime.openPath(dir);
    },
    [runtime]
  );

  const handleChooseDir = useCallback(async () => {
    const dir = await runtime.chooseDirectory();
    if (dir) setDownloadDir(dir);
  }, [runtime]);

  const handleOpenLogin = useCallback(async () => {
    setLoginPending(true);
    try {
      await openLogin();
    } catch (err) {
      setLoginPending(false);
      setStatus(`打开登录窗口失败: ${(err as Error).message}`);
    }
  }, [openLogin]);

  const handleCheckLoginStatus = useCallback(async () => {
    try {
      const probe = await checkLoginStatus();
      if (!probe) {
        setStatus("检测结果：运行时不可用");
        return;
      }

      if (probe.hasAccount) {
        setLoginPending(false);
        setStatus("检测结果：已识别 IMA 登录态");
        return;
      }

      const storageCount = probe.localStorageKeys.length + probe.sessionStorageKeys.length;
      const cookieHint = probe.cookieNames.length ? `cookie: ${probe.cookieNames.join(", ")}` : "未发现 IMA cookie";
      let stage = "未识别到账号字段";
      if (!probe.windowOpen) stage = "登录窗口未打开";
      else if (probe.pageSignals.allowOnPhone || probe.pageSignals.scanSuccess) stage = "扫码已成功，仍在等待手机端允许登录或页面写入登录态";
      else if (probe.pageSignals.expired) stage = "二维码可能已过期";
      else if (probe.pageSignals.qrVisible) stage = "二维码页面可见，等待扫码";

      setStatus(`检测结果：${stage}；storage keys ${storageCount} 个；${cookieHint}`);
    } catch (err) {
      setStatus(`检测登录状态失败: ${(err as Error).message}`);
    }
  }, [checkLoginStatus]);

  useEffect(() => {
    if (account && loginPending) {
      setLoginPending(false);
    }
  }, [account, loginPending]);

  useEffect(() => {
    if (loginPending) {
      setLoginPending(false);
    }
  }, [loginWindowClosedCount]);

  // Load persisted queue state on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    syncApi.loadQueueState().then((state) => {
      if (!state) return;
      if (state.downloadDir) setDownloadDir(state.downloadDir);
      if (state.targetKnowledgeBaseId) setTargetKbId(state.targetKnowledgeBaseId);
      if (state.queue && state.queue.length > 0) {
        const restored = state.queue.map((q) => ({
          ...q,
          status: (q.status as QueueItem["status"]) || "pending",
          createdAt: q.createdAt || Date.now(),
          updatedAt: q.updatedAt || Date.now(),
        }));
        // Reset in-progress items to pending so they can be retried
        const resettable = new Set<QueueItem["status"]>(["resolving", "downloading", "exporting", "preparing", "uploading"]);
        setQueue(restored.map((q) => (resettable.has(q.status) ? { ...q, status: "pending" as const, error: undefined } : q)));
      }
    }).catch(() => {
      // ignore load errors
    });
  }, [syncApi]);

  // Debounced save queue state
  useEffect(() => {
    if (!loadedRef.current) return;
    const timer = setTimeout(() => {
      syncApi.saveQueueState({
        version: 1,
        queue: queue.map((q) => ({
          id: q.id,
          sourceKnowledgeBaseId: q.sourceKnowledgeBaseId,
          sourceKnowledgeBaseName: q.sourceKnowledgeBaseName,
          mediaId: q.mediaId,
          mediaType: q.mediaType,
          title: q.title,
          sourcePath: q.sourcePath,
          status: q.status,
          localPath: q.localPath,
          targetKnowledgeBaseId: q.targetKnowledgeBaseId,
          error: q.error,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
        })),
        downloadDir,
        targetKnowledgeBaseId: targetKbId,
      }).catch(() => {
        // ignore save errors
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [queue, downloadDir, targetKbId, syncApi]);

  const activeQueueCount = queue.filter((q) =>
    ["pending", "resolving", "downloading", "exporting", "preparing", "uploading"].includes(q.status)
  ).length;
  const completedQueueCount = queue.filter((q) => q.status === "done" || q.status === "synced" || q.status === "skipped").length;
  const failedQueueCount = queue.filter((q) => q.status === "failed" || q.status === "sync_failed").length;

  const sectionTitle =
    section === "library" ? "知识库" : section === "queue" ? "任务队列" : section === "logs" ? "日志" : "设置与同步";
  const sectionDesc =
    section === "library"
      ? currentBase && view === "doc"
        ? currentBase.name
        : "浏览已订阅知识库，按文件夹分页查看内容"
      : section === "queue"
        ? "查看下载、导出和同步任务的进度"
        : section === "logs"
          ? "查看主进程网络请求日志"
          : "配置 OpenAPI、重名策略和本地下载位置";

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <div className="brand-mark">IB</div>
          <div>
            <div className="brand-title">IMA Bridge</div>
            <div className="brand-subtitle">知识库同步客户端</div>
          </div>
        </div>

        <div className="sidebar-section">
          <button className={`nav-item${section === "library" ? " nav-item--active" : ""}`} onClick={() => setSection("library")}>
            <span>知识库</span>
            {bases.length > 0 && <span className="nav-badge">{bases.length}</span>}
          </button>
          <button className={`nav-item${section === "queue" ? " nav-item--active" : ""}`} onClick={() => setSection("queue")}>
            <span>任务队列</span>
            {queue.length > 0 && <span className="nav-badge">{queue.length}</span>}
          </button>
          <button className={`nav-item${section === "settings" ? " nav-item--active" : ""}`} onClick={() => setSection("settings")}>
            <span>设置与同步</span>
            <span className={configStatus.configured ? "nav-dot nav-dot--ok" : "nav-dot"} />
          </button>
          <button className={`nav-item${section === "logs" ? " nav-item--active" : ""}`} onClick={() => setSection("logs")}>
            <span>日志</span>
            {logs.length > 0 && <span className="nav-badge">{logs.length}</span>}
          </button>
        </div>

        <div className="sidebar-panel">
          <div className="sidebar-label">账号</div>
          <div className="account-chip">
            <div className={account ? "account-dot account-dot--ok" : "account-dot"} />
            <div className="truncate">
              <div className="account-title">{account ? "已登录 IMA" : "未登录"}</div>
              <div className="account-meta truncate">{account ? `UID ${account.uid}` : "需要扫码登录"}</div>
            </div>
          </div>
          <button className={account ? "small" : "primary small"} onClick={handleOpenLogin} disabled={loginPending}>
            {loginPending ? "等待扫码..." : account ? "重新登录" : "扫码登录"}
          </button>
          {loginPending && (
            <button className="small" onClick={handleCheckLoginStatus}>
              检测登录状态
            </button>
          )}
        </div>

        <div className="sidebar-panel">
          <div className="sidebar-label">队列概览</div>
          <div className="mini-stats">
            <div><strong>{activeQueueCount}</strong><span>进行中</span></div>
            <div><strong>{completedQueueCount}</strong><span>完成</span></div>
            <div><strong>{failedQueueCount}</strong><span>失败</span></div>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-header">
          <div className="header-copy">
            <h1>{sectionTitle}</h1>
            <p>{sectionDesc}</p>
          </div>
          <div className="header-actions">
            {section === "queue" && (
              <button className="small" onClick={clearCompleted} disabled={completedQueueCount === 0}>
                清空已完成
              </button>
            )}
            {section === "settings" && (
              <span className={configStatus.configured ? "status ok" : "status warn"}>
                OpenAPI {configStatus.configured ? "已配置" : "未配置"}
              </span>
            )}
            {section === "logs" && (
              <button className="small danger" onClick={() => setLogs([])} disabled={logs.length === 0}>
                清空日志
              </button>
            )}
          </div>
        </header>

        <section className="app-content">
          {section === "library" && !account && (
            <div className="content-narrow">
              <LoginPanel
                account={account}
                onOpenLogin={handleOpenLogin}
                onClearLogin={clearLogin}
                onCheckLoginStatus={handleCheckLoginStatus}
                onManualLogin={manualLogin}
                loading={loginPending}
              />
            </div>
          )}

          {section === "library" && account && view === "kb" && (
            <KnowledgeBaseList
              bases={bases}
              loading={loadingKb}
              onRefresh={loadBases}
              onOpenBase={openBase}
            />
          )}

          {section === "library" && account && view === "doc" && currentBase && (
            <DocumentList
              base={currentBase}
              documents={documents}
              loading={loadingDoc}
              onBack={() => setView("kb")}
              onRefresh={() => loadFolder(currentBase, currentFolderId || currentBase.id, folderPath[folderPath.length - 1]?.path || "", folderPath)}
              onLoadMore={loadMoreFolder}
              onOpenFolder={openKnowledgeFolder}
              onOpenBreadcrumb={openBreadcrumb}
              onDownload={enqueueDownload}
              onDownloadSelected={enqueueSelected}
              onSyncSelected={enqueueSync}
              syncEnabled={!!targetKbId}
              folderPath={folderPath}
              hasMore={folderHasMore}
              noteFormat={noteFormat}
              onNoteFormatChange={setNoteFormat}
            />
          )}

          {section === "queue" && (
            <DownloadQueue
              queue={queue}
              onRetry={retryItem}
              onRemove={removeQueueItem}
              onOpenFolder={openLocalFolder}
              onClearCompleted={clearCompleted}
            />
          )}

          {section === "settings" && (
            <div className="settings-grid">
              <div className="card settings-card">
                <div className="section-title">OpenAPI 与同步</div>
                <p className="muted-copy">
                  配置你的 IMA OpenAPI 凭证、目标知识库和重名处理策略。凭证只保存在本机，不会进入队列状态。
                </p>
                <div className="settings-actions">
                  <SettingsPanel
                    inline
                    status={settingsStatus}
                    saving={savingSettings}
                    onSave={saveSettings}
                    onClear={clearSettings}
                    duplicatePolicy={duplicatePolicy}
                    onSaveDuplicatePolicy={saveDuplicatePolicy}
                  />
                  <TargetKbSelector
                    configured={configStatus.configured}
                    selectedId={targetKbId}
                    onSelect={setTargetKbId}
                    onLoad={() => {}}
                    listAddableKnowledgeBases={syncApi.listAddableKnowledgeBases}
                  />
                </div>
              </div>

              <div className="card settings-card">
                <div className="section-title">本地下载目录</div>
                <p className="muted-copy">下载和导出的内容会保存到这里，同步任务也会复用这些本地文件。</p>
                <div className="directory-row">
                  <span className="path-text" title={downloadDir || ""}>
                    {downloadDir || "未选择下载目录"}
                  </span>
                  <button onClick={handleChooseDir} className="primary small">选择目录</button>
                </div>
              </div>

              <div className="card settings-card">
                <div className="section-title">登录状态</div>
                <p className="muted-copy">{account ? "当前已经连接 IMA Web 登录态。" : "登录后才能浏览知识库和解析下载链接。"}</p>
                <div className="settings-actions">
                  <button className={account ? "small" : "primary small"} onClick={handleOpenLogin} disabled={loginPending}>
                    {loginPending ? "等待扫码..." : account ? "重新登录" : "扫码登录"}
                  </button>
                  {account && <button className="small danger" onClick={clearLogin}>清除登录态</button>}
                </div>
              </div>
            </div>
          )}

          {section === "logs" && (
            <div className="card" style={{ padding: "16px", height: "calc(100vh - 200px)", display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, overflow: "auto", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6 }}>
                {logs.length === 0 ? (
                  <div style={{ color: "var(--text-secondary)", paddingTop: 40, textAlign: "center" }}>暂无日志</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} style={{ marginBottom: 2, color: log.level === "error" ? "var(--danger)" : log.level === "warn" ? "var(--warning, #e6a23c)" : "var(--text)" }}>
                      <span style={{ color: "var(--text-secondary)", marginRight: 8 }}>{log.time}</span>
                      <span style={{ fontWeight: 600, marginRight: 8 }}>[{log.level.toUpperCase()}]</span>
                      {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>

        {status && <div className="app-status-bar">{status}</div>}
      </main>
    </div>
  );
}
