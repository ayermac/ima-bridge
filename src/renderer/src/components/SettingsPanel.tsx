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
        className="primary"
        style={{ height: 32, padding: "0 12px" }}
        title="OpenAPI 设置"
      >
        设置
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: 38,
            right: 0,
            zIndex: 120,
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            minWidth: 320,
            maxWidth: 400,
            padding: 16,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 12 }}>OpenAPI 设置</div>

          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
            配置 IMA OpenAPI Client ID 和 API Key，用于将内容同步到个人知识库。
            <br />
            这些信息仅保存在本机，不会上传到任何第三方后台。
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Client ID
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={status.clientIdPreview || "请输入 Client ID"}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            {status.clientIdPreview && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                当前已保存: {status.clientIdPreview}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="请输入 API Key"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              重名处理策略
            </label>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
              同步到目标知识库时，若已有同名文件：
            </div>
            <select
              value={policy}
              onChange={(e) => handlePolicyChange(e.target.value as DuplicatePolicy)}
              style={{ width: "100%", boxSizing: "border-box" }}
            >
              {(Object.keys(POLICY_LABELS) as DuplicatePolicy[]).map((key) => (
                <option key={key} value={key}>
                  {POLICY_LABELS[key]}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.4 }}>
              {policy === "reject" && "遇到同名文件时拒绝同步，并提示用户手动处理。不会覆盖目标知识库已有文件。"}
              {policy === "rename" && "遇到同名文件时自动为新文件追加时间戳（如 原文档_20260508_143022.pdf），保留两者。不会覆盖目标知识库已有文件。"}
              {policy === "skip" && "遇到同名文件时跳过上传，标记为已跳过。不会覆盖目标知识库已有文件。"}
            </div>
          </div>

          {error && (
            <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {status.configured && (
              <button
                onClick={handleClear}
                disabled={saving}
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                清除配置
              </button>
            )}
            <button onClick={() => setOpen(false)} disabled={saving}>
              取消
            </button>
            <button onClick={handleSave} disabled={saving || !clientId.trim() || !apiKey.trim()} className="primary">
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
