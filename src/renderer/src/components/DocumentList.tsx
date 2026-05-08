import React, { useEffect, useState, useMemo } from "react";
import type { DocumentItem, KnowledgeBase, FolderPathItem } from "@core/types";
import { LoadingState, EmptyState } from "./AppState";

const MEDIA_TYPES: Record<number, string> = {
  1: "PDF",
  2: "链接",
  3: "文档",
  4: "图片",
  6: "微信文章",
  7: "幻灯片",
  9: "音频",
  11: "笔记",
  13: "视频",
  15: "表格",
};

const DOWNLOADABLE_TYPES = new Set([1, 2, 3, 4, 6, 7, 9, 11, 13, 15]);

function formatSize(value: string | number): string {
  const bytes = Number(value || 0);
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const shown = size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1);
  return `${shown} ${units[index]}`;
}

function formatTime(value: string | number): string {
  const n = Number(value);
  if (!n) return "-";
  const ms = n > 1e12 ? n : n * 1000;
  const date = new Date(ms);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function canDownload(doc: DocumentItem): boolean {
  return !doc.is_folder && (doc.access_status ?? 0) >= 2 && DOWNLOADABLE_TYPES.has(Number(doc.media_type));
}

type Props = {
  base: KnowledgeBase;
  documents: DocumentItem[];
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenFolder: (folder: DocumentItem) => void;
  onOpenBreadcrumb: (index: number) => void;
  onDownload: (doc: DocumentItem) => void;
  onDownloadSelected: (docs: DocumentItem[]) => void;
  onSyncSelected?: (docs: DocumentItem[]) => void;
  syncEnabled?: boolean;
  folderPath: FolderPathItem[];
  hasMore: boolean;
  noteFormat: "md" | "html";
  onNoteFormatChange: (f: "md" | "html") => void;
};

export default function DocumentList({
  base,
  documents,
  loading,
  onBack,
  onRefresh,
  onLoadMore,
  onOpenFolder,
  onOpenBreadcrumb,
  onDownload,
  onDownloadSelected,
  onSyncSelected,
  syncEnabled,
  folderPath,
  hasMore,
  noteFormat,
  onNoteFormatChange,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const types = useMemo(
    () => Array.from(new Set(documents.filter((d) => !d.is_folder).map((d) => Number(d.media_type)))).sort((a, b) => a - b),
    [documents]
  );

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = !search || doc.title.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "all" || (!doc.is_folder && String(doc.media_type) === filter);
      return matchesSearch && matchesFilter;
    });
  }, [documents, search, filter]);

  const downloadable = useMemo(() => filtered.filter(canDownload), [filtered]);

  useEffect(() => {
    setSelected(new Set());
  }, [documents]);

  const toggleSelect = (mediaId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  };

  const selectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(downloadable.map((d) => d.media_id)));
    } else {
      setSelected(new Set());
    }
  };

  const handleDownloadSelected = () => {
    const docs = documents.filter((d) => selected.has(d.media_id) && canDownload(d));
    onDownloadSelected(docs);
  };

  const handleSyncSelected = () => {
    if (!onSyncSelected) return;
    const docs = documents.filter((d) => selected.has(d.media_id) && canDownload(d));
    onSyncSelected(docs);
  };

  return (
    <div className="card" style={{ padding: "16px" }}>
      {/* Header */}
      <div className="toolbar" style={{ marginBottom: 12, justifyContent: "space-between" }}>
        <div className="toolbar" style={{ gap: 10, flexWrap: "wrap" }}>
          <button onClick={onBack} className="small">← 返回</button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span className="section-title" style={{ fontSize: 14 }}>{base.name || "知识库文档"}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              {folderPath.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <span style={{ color: "var(--border)", margin: "0 2px" }}>/</span>}
                  <button
                    onClick={() => onOpenBreadcrumb(index)}
                    disabled={loading || index === folderPath.length - 1}
                    className="small"
                    style={{ padding: "2px 8px", fontWeight: index === folderPath.length - 1 ? 600 : 400, background: index === folderPath.length - 1 ? "var(--primary-soft)" : undefined, color: index === folderPath.length - 1 ? "var(--primary)" : undefined, borderColor: index === folderPath.length - 1 ? "transparent" : undefined }}
                    title={item.name || "根目录"}
                  >
                    <span className="truncate" style={{ maxWidth: 120, display: "inline-block" }}>{item.name || "根目录"}</span>
                  </button>
                </React.Fragment>
              ))}
            </span>
          </div>
        </div>
        <button onClick={onRefresh} disabled={loading} className="primary small">
          {loading ? "加载中..." : "刷新"}
        </button>
      </div>

      {/* Search & Filter */}
      <div className="toolbar" style={{ marginBottom: 12, padding: "10px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
        <input
          type="search"
          placeholder="搜索文档..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 180, maxWidth: 260, flexShrink: 0 }}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button className={filter === "all" ? "primary small" : "small"} onClick={() => setFilter("all")}>全部</button>
          {types.map((t) => (
            <button key={t} className={filter === String(t) ? "primary small" : "small"} onClick={() => setFilter(String(t))}>
              {MEDIA_TYPES[t] || `类型${t}`}
            </button>
          ))}
        </div>
        {types.includes(11) && (
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            <button className={noteFormat === "md" ? "primary small" : "small"} onClick={() => onNoteFormatChange("md")}>MD</button>
            <button className={noteFormat === "html" ? "primary small" : "small"} onClick={() => onNoteFormatChange("html")}>HTML</button>
          </div>
        )}
      </div>

      {/* Selection bar */}
      <div className="toolbar" style={{ marginBottom: 12, padding: "8px 12px", background: "var(--border-light)", borderRadius: "var(--radius-sm)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
          <input
            type="checkbox"
            checked={downloadable.length > 0 && downloadable.every((d) => selected.has(d.media_id))}
            ref={(el) => {
              if (el) el.indeterminate = selected.size > 0 && !downloadable.every((d) => selected.has(d.media_id));
            }}
            onChange={(e) => selectAll(e.target.checked)}
          />
          全选
        </label>
        <span className="stats-row" style={{ flex: 1 }}>
          <span>📁 {filtered.filter((d) => d.is_folder).length} 文件夹</span>
          <span>📄 {filtered.filter((d) => !d.is_folder).length} 文档</span>
          <span>✓ {selected.size}/{downloadable.length} 已选</span>
        </span>
        <button
          className="primary small"
          disabled={selected.size === 0 || loading}
          onClick={handleDownloadSelected}
        >
          下载选中
        </button>
        {onSyncSelected && (
          <button
            className="primary small"
            disabled={selected.size === 0 || loading || !syncEnabled}
            onClick={() => {
              if (!syncEnabled) {
                alert("OpenAPI 未配置，请点击顶部「设置」按钮配置 Client ID 和 API Key");
                return;
              }
              handleSyncSelected();
            }}
            title={syncEnabled ? "同步选中的普通文件到目标知识库" : "OpenAPI 未配置，无法同步"}
          >
            同步选中
          </button>
        )}
      </div>

      {loading && documents.length === 0 && (
        <LoadingState title="正在加载文档..." description={`加载「${base.name}」内容中，请稍候`} />
      )}
      {!loading && documents.length === 0 && (
        <EmptyState
          title="当前层级没有文档"
          description="该知识库或文件夹中尚未添加任何内容，或请尝试刷新。"
          action={<button onClick={onRefresh} className="primary small">刷新</button>}
        />
      )}
      {!loading && documents.length > 0 && filtered.length === 0 && (
        <EmptyState title="没有匹配的文档" description="尝试调整搜索关键词或筛选条件。" />
      )}
      {!loading && documents.length > 0 && filtered.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>名称</th>
                <th style={{ width: 80 }}>类型</th>
                <th style={{ width: 80 }}>大小</th>
                <th style={{ width: 110 }}>更新时间</th>
                <th style={{ width: 70 }}>状态</th>
                <th style={{ width: 80 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc, index) => {
                const ok = canDownload(doc);
                const rowKey = doc.is_folder
                  ? `folder-${doc.folder_id || doc.media_id || index}`
                  : `doc-${doc.media_id || index}`;
                const isFolder = doc.is_folder;
                return (
                  <tr key={rowKey} style={{ background: isFolder ? "var(--border-light)" : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(doc.media_id)}
                        disabled={!ok}
                        onChange={() => toggleSelect(doc.media_id)}
                        style={{ display: "block" }}
                      />
                    </td>
                    <td>
                      <div style={{ minWidth: 140, maxWidth: 320 }}>
                        <div className="truncate" style={{ fontWeight: isFolder ? 600 : 500, fontSize: 13 }} title={doc.title || "未命名文件"}>
                          {isFolder ? "📁 " : ""}{doc.title || "未命名文件"}
                        </div>
                        {doc._path && (
                          <div className="truncate" style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }} title={doc._path}>
                            {doc._path}
                          </div>
                        )}
                      </div>
                    </td>
                    <td><span className="pill">{isFolder ? "文件夹" : MEDIA_TYPES[doc.media_type] || `未知${doc.media_type}`}</span></td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatSize(doc.file_size)}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatTime(doc.update_time)}</td>
                    <td>
                      <span className={isFolder ? "status info" : ok ? "status ok" : "status bad"}>
                        {isFolder ? "可进入" : ok ? "可访问" : "不支持"}
                      </span>
                    </td>
                    <td>
                      {isFolder ? (
                        <button onClick={() => onOpenFolder(doc)} disabled={loading || !doc.folder_id} className="small">
                          打开
                        </button>
                      ) : (
                        <button onClick={() => onDownload(doc)} disabled={!ok || loading} className="small">
                          下载
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 14 }}>
              <button onClick={onLoadMore} disabled={loading} className="primary small">
                {loading ? "加载中..." : "加载更多"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
