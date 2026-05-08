import React from "react";
import type { ImaAccountInfo } from "@runtime/adapter";
import { EmptyState, LoadingState } from "./AppState";

type Props = {
  account: ImaAccountInfo | null;
  onOpenLogin: () => void;
  onClearLogin: () => void;
  loading?: boolean;
};

export default function LoginPanel({ account, onOpenLogin, onClearLogin, loading }: Props) {
  if (loading) {
    return (
      <div className="card" style={{ padding: "16px", marginBottom: "16px" }}>
        <LoadingState
          title="等待扫码登录..."
          description="请在弹出的 IMA 登录窗口中完成扫码授权"
        />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="card" style={{ padding: "16px", marginBottom: "16px" }}>
        <EmptyState
          title="未登录 IMA"
          description="登录后即可浏览知识库、下载和同步文档内容。"
          action={
            <button className="primary" onClick={onOpenLogin}>
              扫码登录
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "16px", marginBottom: "16px" }}>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
            👤
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>
              IMA 用户
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4, marginTop: 2 }}>
              <span className="status ok">已登录</span>
              <span style={{ marginLeft: 8 }}>UID: {account.uid}</span>
            </div>
          </div>
        </div>
        <div className="toolbar" style={{ gap: 8 }}>
          <button className="primary small" onClick={onOpenLogin}>
            重新登录
          </button>
          <button className="small danger" onClick={onClearLogin}>
            清除登录态
          </button>
        </div>
      </div>
    </div>
  );
}
