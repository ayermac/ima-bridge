import React from "react";
import type { QueueItem } from "@core/types";

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
  if (queue.length === 0) return null;

  const pending = queue.filter((q) => q.status === "pending" || q.status === "downloading" || q.status === "resolving" || q.status === "exporting" || q.status === "preparing" || q.status === "uploading").length;
  const failed = queue.filter((q) => q.status === "failed").length;
  const syncFailed = queue.filter((q) => q.status === "sync_failed").length;
  const skipped = queue.filter((q) => q.status === "skipped").length;

  return (
    <div className="card" style={{ padding: "16px", marginTop: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>
          下载队列 {pending > 0 && <span style={{ color: "var(--primary)" }}>({pending} 进行中)</span>}
          {failed > 0 && <span style={{ color: "var(--danger)", marginLeft: 8 }}>({failed} 下载失败)</span>}
          {syncFailed > 0 && <span style={{ color: "var(--danger)", marginLeft: 8 }}>({syncFailed} 同步失败)</span>}
          {skipped > 0 && <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>({skipped} 已跳过)</span>}
        </div>
        {onClearCompleted && queue.some((q) => q.status === "done" || q.status === "synced" || q.status === "skipped") && (
          <button onClick={() => { if (confirm("确定清空已完成/已跳过的项？")) onClearCompleted(); }}>
            清空已完成
          </button>
        )}
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>类型</th>
              <th>状态</th>
              <th>路径</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item) => (
              <tr key={item.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{item.title}</div>
                  {item.error && <div style={{ fontSize: 12, color: "var(--danger)" }}>{item.error}</div>}
                </td>
                <td><span className="pill">{MEDIA_TYPES[item.mediaType] || `类型${item.mediaType}`}</span></td>
                <td style={{ color: statusColor(item.status), fontWeight: 500 }}>{statusText(item.status)}</td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.localPath || item.sourcePath || "-"}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(item.status === "failed" || item.status === "sync_failed" || item.status === "skipped") && (
                      <button onClick={() => onRetry(item.id)}>重试</button>
                    )}
                    {item.localPath && (
                      <button onClick={() => onOpenFolder(item.localPath!)}>打开</button>
                    )}
                    <button onClick={() => onRemove(item.id)} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>移除</button>
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
