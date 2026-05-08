import React, { useState, useEffect, useCallback } from "react";
import type { KnowledgeBase } from "@core/types";

type Props = {
  configured: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onLoad: (bases: KnowledgeBase[]) => void;
  listAddableKnowledgeBases: () => Promise<KnowledgeBase[]>;
};

export default function TargetKbSelector({
  configured,
  selectedId,
  onSelect,
  onLoad,
  listAddableKnowledgeBases,
}: Props) {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setError("");
    try {
      const list = await listAddableKnowledgeBases();
      setBases(list);
      onLoad(list);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }, [configured, listAddableKnowledgeBases, onLoad]);

  useEffect(() => {
    if (configured && open && bases.length === 0) {
      load();
    }
  }, [configured, open, bases.length, load]);

  if (!configured) {
    return (
      <button
        disabled
        className="primary"
        style={{ height: 32, padding: "0 12px", opacity: 0.6, cursor: "not-allowed" }}
        title="请在设置中配置 IMA_OPENAPI_CLIENTID 和 IMA_OPENAPI_APIKEY"
      >
        OpenAPI 未配置
      </button>
    );
  }

  const selected = bases.find((b) => b.id === selectedId);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} disabled={loading} className="primary" style={{ height: 32, padding: "0 12px" }}>
        {selected ? `同步到: ${selected.name}` : "选择目标知识库"}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: 38,
            left: 0,
            zIndex: 100,
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            minWidth: 280,
            maxHeight: 320,
            overflow: "auto",
            padding: "8px 0",
          }}
        >
          {loading && <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>加载中...</div>}
          {error && <div style={{ padding: "12px 16px", fontSize: 13, color: "#dc2626" }}>{error}</div>}
          {!loading && !error && bases.length === 0 && (
            <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>没有可添加的知识库</div>
          )}
          {bases.map((base) => (
            <div
              key={base.id}
              onClick={() => {
                onSelect(base.id);
                setOpen(false);
              }}
              style={{
                padding: "10px 16px",
                cursor: "pointer",
                fontSize: 14,
                background: base.id === selectedId ? "#eff6ff" : "transparent",
                color: base.id === selectedId ? "var(--primary)" : "var(--text)",
                fontWeight: base.id === selectedId ? 600 : 400,
              }}
            >
              {base.name}
            </div>
          ))}
          <div
            style={{
              padding: "8px 16px",
              borderTop: "1px solid var(--border)",
              fontSize: 12,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
            onClick={() => {
              load();
            }}
          >
            刷新列表
          </div>
        </div>
      )}
    </div>
  );
}
