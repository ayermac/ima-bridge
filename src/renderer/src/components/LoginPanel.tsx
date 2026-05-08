import React from "react";
import type { ImaAccountInfo } from "@runtime/adapter";

type Props = {
  account: ImaAccountInfo | null;
  onOpenLogin: () => void;
  onClearLogin: () => void;
};

export default function LoginPanel({ account, onOpenLogin, onClearLogin }: Props) {
  return (
    <div className="card" style={{ padding: "20px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>IMA 登录状态</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {account ? (
              <span className="status ok">已登录 · UID: {account.uid}</span>
            ) : (
              <span className="status bad">未登录</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="primary" onClick={onOpenLogin}>
            {account ? "重新登录" : "扫码登录"}
          </button>
          {account && (
            <button onClick={onClearLogin} style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
              清除登录态
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
