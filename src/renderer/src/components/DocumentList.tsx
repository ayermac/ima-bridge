import React, { useEffect, useState, useMemo } from "react";
import type { DocumentItem, KnowledgeBase, FolderPathItem } from "@core/types";

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

  const canSync = (doc: DocumentItem): boolean => {
    return canDownload(doc) && [1, 2, 3, 4, 5, 6, 7, 9, 11, 13, 14, 15].includes(Number(doc.media_type));
  };

  return (
    <div className="card" style={{ padding: "16px" }}>
      <div className="toolbar" style={{ marginBottom: 12, justifyContent: "space-between" }}>
        <div>
          <button onClick={onBack} style={{ marginRight: 10 }}>返回</button>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{base.name || "知识库文档"}</span>
          <span style={{ marginLeft: 12, fontSize: 13, color: "var(--text-secondary)" }}>
            {folderPath.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && " / "}
                <button
                  onClick={() => onOpenBreadcrumb(index)}
                  disabled={loading || index === folderPath.length - 1}
                  style={{ height: 26, padding: "0 8px" }}
                >
                  {item.name || "根目录"}
                </button>
              </React.Fragment>
            ))}
          </span>
        </div>
        <button onClick={onRefresh} disabled={loading} className="primary">
          {loading ? "加载中..." : "刷新"}
        </button>
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <input
          type="search"
          placeholder="搜索文档..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 200 }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className={filter === "all" ? "primary" : ""} onClick={() => setFilter("all")}>全部</button>
          {types.map((t) => (
            <button key={t} className={filter === String(t) ? "primary" : ""} onClick={() => setFilter(String(t))}>
              {MEDIA_TYPES[t] || `类型${t}`}
            </button>
          ))}
        </div>
        {types.includes(11) && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className={noteFormat === "md" ? "primary" : ""} onClick={() => onNoteFormatChange("md")}>MD</button>
            <button className={noteFormat === "html" ? "primary" : ""} onClick={() => onNoteFormatChange("html")}>HTML</button>
          </div>
        )}
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={downloadable.length > 0 && downloadable.every((d) => selected.has(d.media_id))}
            ref={(el) => {
              if (el) el.indeterminate = selected.size > 0 && !downloadable.every((d) => selected.has(d.media_id));
            }}
            onChange={(e) => selectAll(e.target.checked)}
          />
          全选可下载项
        </label>
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          当前层级：{filtered.filter((d) => d.is_folder).length} 个文件夹，{filtered.filter((d) => !d.is_folder).length} 个文档 · 已选 {selected.size} / {downloadable.length} 可下载
        </span>
        <button
          className="primary"
          disabled={selected.size === 0 || loading}
          onClick={handleDownloadSelected}
        >
          下载选中
        </button>
        {onSyncSelected && (
          <button
            className="primary"
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

      {filtered.length === 0 ? (
        <div className="empty">没有匹配的文档。</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>名称</th>
                <th>类型</th>
                <th>大小</th>
                <th>更新时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc, index) => {
                const ok = canDownload(doc);
                const rowKey = doc.is_folder
                  ? `folder-${doc.folder_id || doc.media_id || index}`
                  : `doc-${doc.media_id || index}`;
                return (
                  <tr key={rowKey}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(doc.media_id)}
                        disabled={!ok}
                        onChange={() => toggleSelect(doc.media_id)}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{doc.is_folder ? "📁 " : ""}{doc.title || "未命名文件"}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{doc._path || ""}</div>
                    </td>
                    <td><span className="pill">{doc.is_folder ? "文件夹" : MEDIA_TYPES[doc.media_type] || `未知${doc.media_type}`}</span></td>
                    <td>{formatSize(doc.file_size)}</td>
                    <td>{formatTime(doc.update_time)}</td>
                    <td>
                      <span className={doc.is_folder ? "status" : ok ? "status ok" : "status bad"}>{doc.is_folder ? "可进入" : ok ? "可访问" : "不支持"}</span>
                    </td>
                    <td>
                      {doc.is_folder ? (
                        <button onClick={() => onOpenFolder(doc)} disabled={loading || !doc.folder_id}>
                          打开
                        </button>
                      ) : (
                        <button onClick={() => onDownload(doc)} disabled={!ok || loading}>
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
              <button onClick={onLoadMore} disabled={loading} className="primary">
                {loading ? "加载中..." : "加载更多"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
