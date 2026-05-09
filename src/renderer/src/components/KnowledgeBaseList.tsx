import React from "react";
import type { KnowledgeBase } from "@core/types";
import { LoadingState, EmptyState } from "./AppState";

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
        <div className="section-title">知识库列表</div>
        <button onClick={onRefresh} disabled={loading} className="primary small">
          {loading ? "加载中..." : "刷新"}
        </button>
      </div>
      {loading && bases.length === 0 && (
        <LoadingState title="正在加载知识库..." description="请稍候" />
      )}
      {!loading && bases.length === 0 && (
        <EmptyState
          title="暂无知识库"
          description="请先登录 IMA 账号，然后点击刷新加载知识库列表。"
          action={<button onClick={onRefresh} className="primary small">刷新</button>}
        />
      )}
      {!loading && bases.length > 0 && (
        <div className="kb-grid">
          {bases.map((base) => (
            <div key={base.id} className="kb-tile" onClick={() => onOpenBase(base)}>
              <div className="kb-tile__cover">
                {base.cover_url ? (
                  <img src={base.cover_url} alt="" />
                ) : (
                  <div className="kb-tile__cover-fallback">KB</div>
                )}
              </div>
              <div className="kb-tile__body">
                <div className="kb-tile__name" title={base.name || "未命名知识库"}>
                  {base.name || "未命名知识库"}
                </div>
                {(base.description || base.creator_name) && (
                  <div className="kb-tile__desc" title={base.description || base.creator_name}>
                    {base.description || base.creator_name}
                  </div>
                )}
                <div className="kb-tile__meta">
                  <span className="pill">{groupName(base.type)}</span>
                  <span className="kb-tile__stat">{formatSize(base.size)}</span>
                  <span className="kb-tile__stat">{base.file_count || 0} 文件</span>
                  {base.member_count > 0 && <span className="kb-tile__stat">{base.member_count} 人</span>}
                </div>
                <div className="kb-tile__footer">
                  <span className={base.access_status >= 2 ? "status ok" : "status bad"}>
                    {base.access_status >= 2 ? "可访问" : "受限"}
                  </span>
                  <span className="kb-tile__time">{base.status_toast || formatTime(base.update_time)}</span>
                </div>
              </div>
              <div className="kb-tile__action">
                <button className="primary small" onClick={(e) => { e.stopPropagation(); onOpenBase(base); }}>
                  进入
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
