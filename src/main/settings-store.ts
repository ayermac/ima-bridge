import { app } from "electron";
import fs from "fs";
import path from "path";
import type { ImaAccountInfo } from "../core/types";

export type DuplicatePolicy = "reject" | "rename" | "skip";

export type AppSettings = {
  imaOpenApiClientId?: string;
  imaOpenApiApiKey?: string;
  duplicatePolicy?: DuplicatePolicy;
  accountInfo?: ImaAccountInfo;
};

const FILENAME = "settings.json";

function getFilePath(): string {
  return path.join(app.getPath("userData"), FILENAME);
}

function getBackupPath(original: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${original}.corrupted.${timestamp}`;
}

function isValidDuplicatePolicy(v: unknown): v is DuplicatePolicy {
  return v === "reject" || v === "rename" || v === "skip";
}

function isValidAccountInfo(v: unknown): v is ImaAccountInfo {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.guid === "string" && typeof obj.token === "string" &&
    typeof obj.refreshToken === "string" && typeof obj.uid === "string";
}

export function loadAppSettings(): AppSettings | null {
  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("设置文件格式错误");
    }
    const obj = parsed as Record<string, unknown>;
    const result: AppSettings = {};

    if (typeof obj.imaOpenApiClientId === "string") {
      result.imaOpenApiClientId = obj.imaOpenApiClientId.trim();
    }
    if (typeof obj.imaOpenApiApiKey === "string") {
      result.imaOpenApiApiKey = obj.imaOpenApiApiKey.trim();
    }
    if (isValidDuplicatePolicy(obj.duplicatePolicy)) {
      result.duplicatePolicy = obj.duplicatePolicy;
    }
    if (isValidAccountInfo(obj.accountInfo)) {
      result.accountInfo = obj.accountInfo;
    }

    return result;
  } catch (err) {
    const msg = (err as Error).message || "未知错误";
    console.error("加载设置失败:", msg);
    try {
      const backup = getBackupPath(filePath);
      fs.renameSync(filePath, backup);
      console.error("已备份损坏的设置文件到:", backup);
    } catch {
      // ignore backup failure
    }
    return null;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  const filePath = getFilePath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const tempPath = `${filePath}.tmp`;
  const payload: Record<string, unknown> = {};
  if (settings.imaOpenApiClientId) payload.imaOpenApiClientId = settings.imaOpenApiClientId;
  if (settings.imaOpenApiApiKey) payload.imaOpenApiApiKey = settings.imaOpenApiApiKey;
  if (settings.duplicatePolicy) payload.duplicatePolicy = settings.duplicatePolicy;
  if (settings.accountInfo) payload.accountInfo = settings.accountInfo;

  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf-8");
  fs.renameSync(tempPath, filePath);
}

export function clearAppSettings(): void {
  const filePath = getFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Backward compatibility wrappers
export function loadOpenApiSettings(): { clientId: string; apiKey: string } | null {
  const settings = loadAppSettings();
  if (!settings) return null;
  const clientId = settings.imaOpenApiClientId;
  const apiKey = settings.imaOpenApiApiKey;
  if (!clientId || !apiKey) return null;
  return { clientId, apiKey };
}

export function saveOpenApiSettings(settings: { clientId: string; apiKey: string }): void {
  const existing = loadAppSettings() || {};
  saveAppSettings({
    ...existing,
    imaOpenApiClientId: settings.clientId,
    imaOpenApiApiKey: settings.apiKey,
  });
}

export function clearOpenApiSettings(): void {
  const existing = loadAppSettings();
  if (existing) {
    const { imaOpenApiClientId: _, imaOpenApiApiKey: __, ...rest } = existing;
    saveAppSettings(rest);
  }
}

export function loadAccountInfo(): ImaAccountInfo | null {
  const settings = loadAppSettings();
  return settings?.accountInfo ?? null;
}

export function saveAccountInfo(info: ImaAccountInfo): void {
  const existing = loadAppSettings() || {};
  saveAppSettings({ ...existing, accountInfo: info });
}

export function clearAccountInfo(): void {
  const existing = loadAppSettings();
  if (existing?.accountInfo) {
    const { accountInfo: _, ...rest } = existing;
    saveAppSettings(rest);
  }
}
