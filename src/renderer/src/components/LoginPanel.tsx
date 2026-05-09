import { useState } from "react";
import type { ImaAccountInfo } from "@runtime/adapter";
import { parseAccountInfo } from "@core/ima-web-auth";
import { EmptyState, LoadingState } from "./AppState";

type Props = {
  account: ImaAccountInfo | null;
  onOpenLogin: () => void;
  onClearLogin: () => void;
  onCheckLoginStatus?: () => void;
  onManualLogin?: (info: ImaAccountInfo) => void;
  loading?: boolean;
};

export default function LoginPanel({ account, onOpenLogin, onClearLogin, onCheckLoginStatus, onManualLogin, loading }: Props) {
  const [showManual, setShowManual] = useState(true);
  const [jsonText, setJsonText] = useState("");
  const [parsedInfo, setParsedInfo] = useState<ImaAccountInfo | null>(null);
  const [parseError, setParseError] = useState("");

  if (loading) {
    return (
      <div className="card" style={{ padding: "12px" }}>
        <LoadingState
          title="等待扫码登录..."
          description="请在弹出的 IMA 登录窗口中完成扫码授权"
          action={
            onCheckLoginStatus ? (
              <button className="small" onClick={onCheckLoginStatus}>
                检测登录状态
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="card" style={{ padding: "12px" }}>
        {showManual ? (
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>手动粘贴登录凭证</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
              在浏览器打开 <a href="https://ima.qq.com/login" target="_blank" rel="noreferrer">https://ima.qq.com/login</a> 扫码登录，然后在 DevTools 的 Application &gt; Local Storage 中复制完整的 accountInfo JSON，粘贴到下方。注意：登录凭证会定期失效，失效后需要重新操作。
            </div>
            <div style={{ marginBottom: 8 }}>
              <textarea
                placeholder="粘贴完整的 accountInfo JSON..."
                value={jsonText}
                onChange={(e) => { setJsonText(e.target.value); setParsedInfo(null); setParseError(""); }}
                style={{ width: "100%", height: 120, padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", resize: "vertical", fontFamily: "monospace" }}
              />
            </div>
            <div className="toolbar" style={{ gap: 8, marginBottom: 8 }}>
              <button className="small" onClick={() => {
                setParseError("");
                setParsedInfo(null);
                try {
                  const info = parseAccountInfo(jsonText.trim());
                  setParsedInfo(info);
                } catch (err) {
                  setParseError((err as Error).message);
                }
              }}>
                解析
              </button>
              <button className="small" onClick={() => setShowManual(false)}>
                返回
              </button>
            </div>
            {parseError && (
              <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>解析失败: {parseError}</div>
            )}
            {parsedInfo && (
              <div style={{ fontSize: 12, background: "var(--primary-soft)", padding: "8px 10px", borderRadius: 6, marginBottom: 8 }}>
                <div><b>Token:</b> {parsedInfo.token.slice(0, 16)}...{parsedInfo.token.slice(-8)}</div>
                <div><b>UID:</b> {parsedInfo.uid}</div>
                <div><b>GUID:</b> {parsedInfo.guid.slice(0, 16)}...</div>
                <div style={{ marginTop: 6 }}>
                  <button className="primary small" onClick={() => { if (onManualLogin) onManualLogin(parsedInfo); }}>
                    确认登录
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="未登录 IMA"
            description="登录后即可浏览知识库、下载和同步文档内容。"
            action={
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                <button className="primary" onClick={onOpenLogin}>
                  扫码登录
                </button>
                <button className="small" onClick={() => setShowManual(true)}>
                  手动粘贴 JSON
                </button>
              </div>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "12px" }}>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "var(--primary)", flexShrink: 0 }}>
            U
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
