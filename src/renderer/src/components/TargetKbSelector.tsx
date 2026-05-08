import React, { useState, useEffect, useCallback } from "react";
import type { KnowledgeBase } from "@core/types";
import { EmptyState } from "./AppState";

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
        className="small"
        style={{ opacity: 0.6, cursor: "not-allowed" }}
        title="请在设置中配置 IMA_OPENAPI_CLIENTID 和 IMA_OPENAPI_APIKEY"
      >
        OpenAPI 未配置
      </button>
    );
  }

  const selected = bases.find((b) => b.id === selectedId);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} disabled={loading} className="primary small">
        {selected ? `同步到: ${selected.name}` : "选择目标知识库"}
      </button>
      {open && (
        <div className="dropdown" style={{ top: 36, left: 0, minWidth: 280, maxWidth: 360 }}>
          {loading && (
            <div style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
              <div className="list-loading__spinner" style={{ width: 14, height: 14 }} />
              加载中...
            </div>
          )}
          {error && (
            <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--danger)" }}>{error}</div>
          )}
          {!loading && !error && bases.length === 0 && (
            <div style={{ padding: "12px 16px" }}>
              <EmptyState title="没有可添加的知识库" description="请确认 OpenAPI 配置正确，或刷新列表。" />
            </div>
          )}
          {bases.map((base) => (
            <div
              key={base.id}
              onClick={() => {
                onSelect(base.id);
                setOpen(false);
              }}
              className={`dropdown__item${base.id === selectedId ? " dropdown__item--active" : ""}`}
            >
              <span className="truncate" style={{ flex: 1 }} title={base.name}>{base.name}</span>
              {base.id === selectedId && <span style={{ fontSize: 12, color: "var(--primary)" }}>✓</span>}
            </div>
          ))}
          <div className="dropdown__footer" onClick={() => load()}>
            刷新列表
          </div>
        </div>
      )}
    </div>
  );
}
