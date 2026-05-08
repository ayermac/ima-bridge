import { app } from "electron";
import fs from "fs";
import path from "path";
import type { QueueItem } from "../core/types";

export type QueuePersistedState = {
  version: 1;
  queue: QueueItem[];
  downloadDir: string | null;
  targetKnowledgeBaseId: string | null;
};

const FILENAME = "queue-state.json";

function getFilePath(): string {
  return path.join(app.getPath("userData"), FILENAME);
}

function getBackupPath(original: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${original}.corrupted.${timestamp}`;
}

export function loadQueueState(): QueuePersistedState | null {
  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as QueuePersistedState;
    if (parsed.version !== 1) {
      throw new Error(`不支持的队列状态版本: ${parsed.version}`);
    }
    if (!Array.isArray(parsed.queue)) {
      throw new Error("队列状态格式错误: queue 不是数组");
    }
    return parsed;
  } catch (err) {
    const msg = (err as Error).message || "未知错误";
    console.error("加载队列状态失败:", msg);
    try {
      const backup = getBackupPath(filePath);
      fs.renameSync(filePath, backup);
      console.error("已备份损坏的队列状态到:", backup);
    } catch {
      // ignore backup failure
    }
    return null;
  }
}

export function saveQueueState(state: QueuePersistedState): void {
  const filePath = getFilePath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf-8");
  fs.renameSync(tempPath, filePath);
}

export function clearQueueState(): void {
  const filePath = getFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function sanitizeQueueForRestore(queue: QueueItem[]): QueueItem[] {
  return queue.map((item) => {
    const resettableStatuses = new Set<QueueItem["status"]>([
      "resolving",
      "downloading",
      "exporting",
      "preparing",
      "uploading",
    ]);
    if (resettableStatuses.has(item.status)) {
      return { ...item, status: "pending" as const, error: undefined };
    }
    return item;
  });
}
