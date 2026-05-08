import React from "react";
import type { KnowledgeBase } from "@core/types";

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

function groupName(type: number): string {
  return type === 0 ? "个人知识库" : type === 1 ? "我创建的" : "我加入的";
}

type Props = {
  bases: KnowledgeBase[];
  loading: boolean;
  onRefresh: () => void;
  onOpenBase: (base: KnowledgeBase) => void;
};

export default function KnowledgeBaseList({ bases, loading, onRefresh, onOpenBase }: Props) {
  return (
    <div className="card" style={{ padding: "16px" }}>
      <div className="toolbar" style={{ marginBottom: 12, justifyContent: "space-between" }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>知识库列表</div>
        <button onClick={onRefresh} disabled={loading} className="primary">
          {loading ? "加载中..." : "刷新"}
        </button>
      </div>
      {bases.length === 0 ? (
        <div className="empty">暂无知识库，请先登录 IMA。</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>分组</th>
                <th>名称</th>
                <th>大小</th>
                <th>文件数</th>
                <th>成员</th>
                <th>更新时间</th>
                <th>权限</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {bases.map((base) => (
                <tr key={base.id} className="clickableRow" onClick={() => onOpenBase(base)}>
                  <td><span className="pill">{groupName(base.type)}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {base.cover_url ? (
                        <img src={base.cover_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: "#e5e7eb" }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 500 }}>{base.name || "未命名知识库"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{base.description || base.creator_name || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td>{formatSize(base.size)}</td>
                  <td>{base.file_count || "-"}</td>
                  <td>{base.member_count || "-"}</td>
                  <td>{base.status_toast || formatTime(base.update_time)}</td>
                  <td>
                    <span className={base.access_status >= 2 ? "status ok" : "status bad"}>
                      {base.access_status >= 2 ? "可访问" : "受限"}
                    </span>
                  </td>
                  <td>
                    <button className="primary" onClick={(e) => { e.stopPropagation(); onOpenBase(base); }}>
                      进入
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
