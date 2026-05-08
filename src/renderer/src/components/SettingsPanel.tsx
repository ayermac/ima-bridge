import React, { useState } from "react";
import type { ImaOpenApiConfigStatus, DuplicatePolicy } from "@runtime/adapter";

type Props = {
  status: ImaOpenApiConfigStatus;
  saving: boolean;
  onSave: (clientId: string, apiKey: string) => Promise<unknown>;
  onClear: () => Promise<unknown>;
  duplicatePolicy: DuplicatePolicy;
  onSaveDuplicatePolicy: (policy: DuplicatePolicy) => Promise<unknown>;
};

const POLICY_LABELS: Record<DuplicatePolicy, string> = {
  reject: "拒绝并提示",
  rename: "自动重命名",
  skip: "跳过已有",
};

const POLICY_DESC: Record<DuplicatePolicy, string> = {
  reject: "遇到同名文件时拒绝同步，并提示用户手动处理。",
  rename: "遇到同名文件时自动为新文件追加时间戳，保留两者。",
  skip: "遇到同名文件时跳过上传，标记为已跳过。",
};

export default function SettingsPanel({ status, saving, onSave, onClear, duplicatePolicy, onSaveDuplicatePolicy }: Props) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState<DuplicatePolicy>(duplicatePolicy);

  const handleSave = async () => {
    setError("");
    try {
      await onSave(clientId, apiKey);
      setClientId("");
      setApiKey("");
      setOpen(false);
    } catch (err) {
      setError(String((err as Error).message));
    }
  };

  const handleClear = async () => {
    if (!confirm("确定清除已保存的 OpenAPI 配置？")) return;
    setError("");
    try {
      await onClear();
      setClientId("");
      setApiKey("");
      setOpen(false);
    } catch (err) {
      setError(String((err as Error).message));
    }
  };

  const handlePolicyChange = async (newPolicy: DuplicatePolicy) => {
    setPolicy(newPolicy);
    try {
      await onSaveDuplicatePolicy(newPolicy);
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="primary small"
        title="OpenAPI 设置"
      >
        ⚙️ 设置
      </button>
      {open && (
        <div
          className="dropdown"
          style={{ top: 36, right: 0, padding: 16 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>OpenAPI 设置</div>

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
            配置 IMA OpenAPI Client ID 和 API Key，用于将内容同步到个人知识库。
            信息仅保存在本机，不上传任何第三方。
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              Client ID
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={status.clientIdPreview || "请输入 Client ID"}
            />
            {status.clientIdPreview && (
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                当前已保存: {status.clientIdPreview}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="请输入 API Key"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              重名处理策略
            </label>
            <select
              value={policy}
              onChange={(e) => handlePolicyChange(e.target.value as DuplicatePolicy)}
            >
              {(Object.keys(POLICY_LABELS) as DuplicatePolicy[]).map((key) => (
                <option key={key} value={key}>
                  {POLICY_LABELS[key]}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.4 }}>
              {POLICY_DESC[policy]}
            </div>
          </div>

          {error && (
            <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 12, padding: "8px 10px", background: "var(--danger-soft)", borderRadius: "var(--radius-sm)" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {status.configured && (
              <button
                className="small danger"
                onClick={handleClear}
                disabled={saving}
              >
                清除配置
              </button>
            )}
            <button className="small" onClick={() => setOpen(false)} disabled={saving}>
              取消
            </button>
            <button className="primary small" onClick={handleSave} disabled={saving || !clientId.trim() || !apiKey.trim()}>
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
