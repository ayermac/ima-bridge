import type { KnowledgeTarget, QueueItem, RuntimeAdapter, KnowledgeSource, ImaAccountInfo } from "./types";

export type SyncEngineDeps = {
  source: KnowledgeSource;
  target: KnowledgeTarget;
  runtime: RuntimeAdapter;
};

export class KnowledgeSyncEngine {
  private source: KnowledgeSource;
  private target: KnowledgeTarget;
  private runtime: RuntimeAdapter;

  constructor(deps: SyncEngineDeps) {
    this.source = deps.source;
    this.target = deps.target;
    this.runtime = deps.runtime;
  }

  async syncItem(item: QueueItem): Promise<void> {
    // Placeholder: Phase 3+ implementation
    // 1. resolveMedia / exportNote / exportWechat
    // 2. download to temp
    // 3. target.uploadFile / importUrls
    throw new Error("OpenAPI sync not yet implemented in Phase 1");
  }
}

export async function createWebSource(account: ImaAccountInfo): Promise<KnowledgeSource> {
  const { ImaWebApi } = await import("./ima-web-api");
  return new ImaWebApi(account);
}
