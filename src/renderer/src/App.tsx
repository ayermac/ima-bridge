import { useState, useCallback, useRef, useEffect } from "react";
import type { KnowledgeBase, DocumentItem, QueueItem, FolderPathItem } from "@core/types";
import { useAccountInfo, useRuntime, useOpenApiConfigStatus, useOpenApiSettings, useDuplicatePolicy, useSyncApi, createImaWebApi } from "./hooks/useIpc";
import LoginPanel from "./components/LoginPanel";
import KnowledgeBaseList from "./components/KnowledgeBaseList";
import DocumentList from "./components/DocumentList";
import DownloadQueue from "./components/DownloadQueue";
import TargetKbSelector from "./components/TargetKbSelector";
import SettingsPanel from "./components/SettingsPanel";

function cleanPathPart(part: string): string {
  return (
    part
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "未命名"
  );
}

function pathParts(path: string): string[] {
  return String(path || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .map(cleanPathPart);
}

function filenameFor(doc: DocumentItem, media: Record<string, unknown>): string {
  const title = cleanPathPart(String(media?.title || doc.title || "ima-file"));
  const sourcePath = String(media?.source_path || media?.raw_file_url || "");
  let ext = "";
  if (sourcePath.includes(".")) {
    const candidate = sourcePath.slice(sourcePath.lastIndexOf("."));
    if (/^\.[a-z0-9]{1,8}$/i.test(candidate)) ext = candidate;
  }
  const filename = ext && !title.toLowerCase().endsWith(ext.toLowerCase()) ? `${title}${ext}` : title;
  return [...pathParts(doc._path), filename].join("/");
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const FOLDER_PAGE_SIZE = 50;

export default function App() {
  const { account, openLogin, clearLogin } = useAccountInfo();
  const [loginPending, setLoginPending] = useState(false);
  const runtime = useRuntime();
  const { configStatus, refreshOpenApiConfigStatus } = useOpenApiConfigStatus();
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
  const processingRef = useRef(false);
  const loadedRef = useRef(false);

  const getApi = useCallback(async () => {
    if (!account) throw new Error("未登录");
    return createImaWebApi(account);
  }, [account]);

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
    processingRef.current = true;

    let targetItem: QueueItem | undefined;

    setQueue((prev) => {
      targetItem = prev.find((q) => q.status === "pending");
      if (!targetItem) return prev;
      return prev.map((q) =>
        q.id === targetItem!.id ? { ...q, status: "resolving" as const, updatedAt: Date.now() } : q
      );
    });

    if (!targetItem) {
      processingRef.current = false;
      setStatus("队列处理完成");
      return;
    }

    setStatus(`处理中: ${targetItem.title}`);

    try {
      if (!downloadDir) throw new Error("未选择下载目录");
      const api = await getApi();

      const setStatusInQueue = (status: QueueItem["status"]) => {
        setQueue((prev) =>
          prev.map((q) => (q.id === targetItem!.id ? { ...q, status, updatedAt: Date.now() } : q))
        );
      };

      const markDone = (localPath: string) => {
        setQueue((prev) =>
          prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "done" as const, localPath, updatedAt: Date.now() } : q))
        );
      };

      const markFailed = (error: string) => {
        setQueue((prev) =>
          prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "failed" as const, error, updatedAt: Date.now() } : q))
        );
      };

      const markSyncFailed = (error: string) => {
        setQueue((prev) =>
          prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "sync_failed" as const, error, updatedAt: Date.now() } : q))
        );
      };

      const markSkipped = (reason: string) => {
        setQueue((prev) =>
          prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "skipped" as const, error: reason, updatedAt: Date.now() } : q))
        );
      };

      let localPath = "";

      if (targetItem.mediaType === 2) {
        const media = await api.resolveMedia(targetItem.mediaId);
        const title = cleanPathPart(targetItem.title || "ima-link");
        const rel = [...pathParts(targetItem.sourcePath), `${title}.txt`].join("/");
        localPath = runtime.joinPath(downloadDir, rel);
        await runtime.saveFile(localPath, String(media.url));
      } else if (targetItem.mediaType === 6) {
        const exported = await api.exportWechat(targetItem.mediaId);
        const rel = [...pathParts(targetItem.sourcePath), `${cleanPathPart(exported.title)}.html`].join("/");
        localPath = runtime.joinPath(downloadDir, rel);
        await runtime.saveFile(localPath, exported.content);
      } else if (targetItem.mediaType === 11) {
        setStatusInQueue("exporting");
        const exported = await api.exportNote(targetItem.mediaId, noteFormat);
        const rel = [...pathParts(targetItem.sourcePath), `${cleanPathPart(exported.title)}.${noteFormat}`].join("/");
        localPath = runtime.joinPath(downloadDir, rel);
        await runtime.saveFile(localPath, exported.content);
      } else {
        const media = await api.resolveMedia(targetItem.mediaId);
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

      setQueue((prev) =>
        prev.map((q) => (q.id === targetItem!.id ? { ...q, localPath, updatedAt: Date.now() } : q))
      );

      if (targetItem.targetKnowledgeBaseId) {
        setStatusInQueue("preparing");

        let result: { success: boolean; mediaId?: string; skipped?: boolean } | null = null;

        if (targetItem.mediaType === 2 || targetItem.mediaType === 6) {
          // 链接 / 微信文章：尝试 import_urls（需要 resolved url）
          let url = "";
          if (targetItem.mediaType === 2) {
            const media = await api.resolveMedia(targetItem.mediaId);
            url = media.url;
          } else {
            const media = await api.resolveMedia(targetItem.mediaId);
            url = media.url;
          }
          if (!url) {
            markSyncFailed("无法获取内容 URL");
            processingRef.current = false;
            return;
          }
          result = await syncApi.syncContentToKnowledgeBase({
            targetKnowledgeBaseId: targetItem.targetKnowledgeBaseId,
            title: targetItem.title,
            mediaType: targetItem.mediaType,
            url,
            localFilePath: targetItem.mediaType === 6 ? localPath : undefined,
          });
        } else if (targetItem.mediaType === 11) {
          // 笔记：导出后按文件上传
          if (!localPath) {
            markSyncFailed("笔记导出失败");
            processingRef.current = false;
            return;
          }
          result = await syncApi.syncContentToKnowledgeBase({
            targetKnowledgeBaseId: targetItem.targetKnowledgeBaseId,
            title: targetItem.title,
            mediaType: targetItem.mediaType,
            localFilePath: localPath,
          });
        } else {
          // 普通文件：直接上传
          if (!localPath) {
            markSyncFailed("文件下载失败");
            processingRef.current = false;
            return;
          }
          result = await syncApi.syncFileToKnowledgeBase({
            localFilePath: localPath,
            targetKnowledgeBaseId: targetItem.targetKnowledgeBaseId,
            title: targetItem.title,
          });
        }

        if (result?.skipped) {
          markSkipped("目标知识库已有同名文件，已跳过");
        } else if (result?.success) {
          setQueue((prev) =>
            prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "synced" as const, updatedAt: Date.now() } : q))
          );
        } else {
          markSyncFailed("同步失败");
        }
      } else {
        markDone(localPath);
      }
    } catch (err) {
      const msg = (err as Error).message || "未知错误";
      if (targetItem.targetKnowledgeBaseId) {
        setQueue((prev) =>
          prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "sync_failed" as const, error: msg, updatedAt: Date.now() } : q))
        );
      } else {
        setQueue((prev) =>
          prev.map((q) => (q.id === targetItem!.id ? { ...q, status: "failed" as const, error: msg, updatedAt: Date.now() } : q))
        );
      }
    } finally {
      processingRef.current = false;
    }
  }, [downloadDir, getApi, noteFormat, runtime, syncApi]);

  useEffect(() => {
    if (queue.some((q) => q.status === "pending")) {
      processQueue();
    }
  }, [queue, processQueue]);

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

  const onTargetKbLoad = useCallback(
    (_bases: KnowledgeBase[]) => {
      // no-op; TargetKbSelector manages its own list
    },
    []
  );

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

  const handleOpenLogin = useCallback(() => {
    setLoginPending(true);
    openLogin();
  }, [openLogin]);

  useEffect(() => {
    if (account && loginPending) {
      setLoginPending(false);
    }
  }, [account, loginPending]);

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

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>
      <div className="toolbar" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", flexShrink: 0 }}>IMA Bridge</div>
        <div className="toolbar" style={{ gap: 10, justifyContent: "flex-end" }}>
          <span
            className={configStatus.configured ? "status ok" : "status"}
            title="IMA OpenAPI ClientID / APIKey 配置状态"
          >
            OpenAPI {configStatus.configured ? "已配置" : "未配置"}
          </span>
          <SettingsPanel
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
          <span
            className="path-text"
            title={downloadDir || ""}
            style={{ maxWidth: 280 }}
          >
            {downloadDir ? `下载目录: ${downloadDir}` : "未选择下载目录"}
          </span>
          <button onClick={handleChooseDir} className="primary small">
            选择目录
          </button>
        </div>
      </div>

      <LoginPanel account={account} onOpenLogin={handleOpenLogin} onClearLogin={clearLogin} loading={loginPending} />

      {view === "kb" && (
        <KnowledgeBaseList
          bases={bases}
          loading={loadingKb}
          onRefresh={loadBases}
          onOpenBase={openBase}
        />
      )}

      {view === "doc" && currentBase && (
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

      <DownloadQueue
        queue={queue}
        onRetry={retryItem}
        onRemove={removeQueueItem}
        onOpenFolder={openLocalFolder}
        onClearCompleted={clearCompleted}
      />

      {status && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 8,
            background: "#eff6ff",
            color: "var(--primary)",
            fontSize: 14,
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
}
