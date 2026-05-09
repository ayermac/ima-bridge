import React from "react";
import type { QueueItem } from "@core/types";
import { EmptyState } from "./AppState";

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

function statusText(status: string): string {
  const map: Record<string, string> = {
    pending: "等待中",
    resolving: "解析中",
    downloading: "下载中",
    exporting: "导出中",
    preparing: "准备同步",
    uploading: "上传中",
    done: "已完成",
    synced: "已同步",
    failed: "失败",
    sync_failed: "同步失败",
    skipped: "已跳过",
  };
  return map[status] || status;
}

function statusClass(status: string): string {
  if (status === "done" || status === "synced") return "status ok";
  if (status === "failed" || status === "sync_failed") return "status bad";
  if (status === "skipped") return "status";
  if (["downloading", "exporting", "uploading", "resolving", "preparing"].includes(status)) return "status info";
  return "status";
}

function statusColor(status: string): string {
  if (status === "done" || status === "synced") return "var(--success)";
  if (status === "failed" || status === "sync_failed") return "var(--danger)";
  if (status === "skipped") return "var(--text-secondary)";
  if (["downloading", "exporting", "uploading", "resolving", "preparing"].includes(status)) return "var(--primary)";
  return "var(--text-secondary)";
}

type Props = {
  queue: QueueItem[];
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenFolder: (path: string) => void;
  onClearCompleted?: () => void;
};

export default function DownloadQueue({ queue, onRetry, onRemove, onOpenFolder, onClearCompleted }: Props) {
  if (queue.length === 0) {
    return (
      <div className="card" style={{ padding: "16px" }}>
        <EmptyState
          title="队列为空"
          description="选择文档并点击「下载」或「同步」即可加入队列。"
        />
      </div>
    );
  }

  const pending = queue.filter((q) => q.status === "pending" || q.status === "downloading" || q.status === "resolving" || q.status === "exporting" || q.status === "preparing" || q.status === "uploading").length;
  const done = queue.filter((q) => q.status === "done" || q.status === "synced").length;
  const failed = queue.filter((q) => q.status === "failed").length;
  const syncFailed = queue.filter((q) => q.status === "sync_failed").length;
  const skipped = queue.filter((q) => q.status === "skipped").length;

  return (
    <div className="card" style={{ padding: "16px" }}>
      <div className="doc-toolbar doc-toolbar--primary" style={{ marginBottom: 12 }}>
        <div className="stats-row" style={{ fontSize: 14, fontWeight: 600 }}>
          <span style={{ color: "var(--text)" }}>下载队列</span>
          {pending > 0 && <span className="status info" style={{ fontSize: 11 }}>{pending} 进行中</span>}
          {done > 0 && <span className="status ok" style={{ fontSize: 11 }}>{done} 已完成</span>}
          {failed > 0 && <span className="status bad" style={{ fontSize: 11 }}>{failed} 下载失败</span>}
          {syncFailed > 0 && <span className="status bad" style={{ fontSize: 11 }}>{syncFailed} 同步失败</span>}
          {skipped > 0 && <span className="status" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{skipped} 已跳过</span>}
        </div>
        {onClearCompleted && queue.some((q) => q.status === "done" || q.status === "synced" || q.status === "skipped") && (
          <button className="small" onClick={() => { if (confirm("确定清空已完成/已跳过的项？")) onClearCompleted(); }}>
            清空已完成
          </button>
        )}
      </div>
      <div className="table-wrap">
        <table style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: "40%" }}>名称</th>
              <th style={{ width: 60 }}>类型</th>
              <th style={{ width: 80 }}>状态</th>
              <th style={{ width: "25%" }}>路径</th>
              <th style={{ width: 160, minWidth: 140 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="truncate" style={{ fontWeight: 500, fontSize: 12 }} title={item.title}>{item.title}</div>
                  {item.error && (
                    <div className="truncate" style={{ fontSize: 11, color: "var(--danger)", marginTop: 2 }} title={item.error}>
                      {item.error}
                    </div>
                  )}
                </td>
                <td><span className="pill" style={{ fontSize: 10 }}>{MEDIA_TYPES[item.mediaType] || `类型${item.mediaType}`}</span></td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className={statusClass(item.status)} style={{ fontSize: 11, padding: "2px 6px", whiteSpace: "nowrap" }}>
                      {statusText(item.status)}
                    </span>
                    {item.progress !== undefined && item.progress >= 0 && (
                      <div style={{ width: 60, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, item.progress)}%`, height: "100%", background: "var(--primary)", borderRadius: 2, transition: "width 0.3s ease" }} />
                      </div>
                    )}
                    {item.progress === undefined && ["downloading", "uploading", "exporting", "resolving", "preparing"].includes(item.status) && (
                      <div style={{ width: 60, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                        <div className="progress-bar-indeterminate" style={{ height: "100%", background: "var(--primary)", borderRadius: 2, width: "40%" }} />
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="truncate" style={{ fontSize: 11, color: "var(--text-secondary)" }} title={item.localPath || item.sourcePath || "-"}>
                    {item.localPath || item.sourcePath || "-"}
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(item.status === "failed" || item.status === "sync_failed" || item.status === "skipped") && (
                      <button className="small" onClick={() => onRetry(item.id)}>重试</button>
                    )}
                    {item.localPath && (
                      <button className="small" onClick={() => onOpenFolder(item.localPath!)}>打开</button>
                    )}
                    <button className="small danger" onClick={() => onRemove(item.id)}>移除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
