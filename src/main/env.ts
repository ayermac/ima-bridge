import { app } from "electron";
import fs from "fs";
import path from "path";
import {
  loadAppSettings,
  saveAppSettings,
  clearAppSettings,
  type AppSettings,
  type DuplicatePolicy,
} from "./settings-store";

export type ImaOpenApiCredentials = {
  clientId: string;
  apiKey: string;
};

export type ImaOpenApiConfigStatus = {
  configured: boolean;
  hasClientId: boolean;
  hasApiKey: boolean;
  clientIdPreview?: string;
};

let loaded = false;

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalIndex = line.indexOf("=");
    if (equalIndex <= 0) continue;

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function candidateEnvDirs(): string[] {
  const dirs = [
    process.cwd(),
    app.getAppPath(),
    path.resolve(__dirname, "../.."),
  ];

  return Array.from(new Set(dirs));
}

function loadEnvFile(filePath: string, protectedKeys: Set<string>, overwrite = false): void {
  if (!fs.existsSync(filePath)) return;

  const parsed = parseEnv(fs.readFileSync(filePath, "utf-8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (protectedKeys.has(key)) continue;
    if (overwrite || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function loadLocalEnv(): void {
  if (loaded) return;
  loaded = true;

  const protectedKeys = new Set(Object.keys(process.env));

  for (const dir of candidateEnvDirs()) {
    loadEnvFile(path.join(dir, ".env"), protectedKeys);
    loadEnvFile(path.join(dir, ".env.local"), protectedKeys, true);
  }
}

// In-memory cache for settings-store values so we don't re-read disk every call
let _settingsCache: AppSettings | null | undefined = undefined;

export function refreshSettingsCache(): void {
  _settingsCache = loadAppSettings();
}

function getSettingsStoreValue(): AppSettings | null {
  if (_settingsCache === undefined) {
    _settingsCache = loadAppSettings();
  }
  return _settingsCache;
}

function resolveCredentials(): ImaOpenApiCredentials | null {
  loadLocalEnv();

  // Priority: settings-store > shell env > .env.local > .env
  const settings = getSettingsStoreValue();
  if (settings?.imaOpenApiClientId && settings?.imaOpenApiApiKey) {
    return { clientId: settings.imaOpenApiClientId, apiKey: settings.imaOpenApiApiKey };
  }

  const clientId = String(process.env.IMA_OPENAPI_CLIENTID || "").trim();
  const apiKey = String(process.env.IMA_OPENAPI_APIKEY || "").trim();
  if (!clientId || !apiKey) return null;

  return { clientId, apiKey };
}

export function getImaOpenApiCredentials(): ImaOpenApiCredentials | null {
  return resolveCredentials();
}

export function getImaOpenApiConfigStatus(): ImaOpenApiConfigStatus {
  loadLocalEnv();

  const settings = getSettingsStoreValue();

  let hasClientId = false;
  let hasApiKey = false;
  let clientIdPreview: string | undefined;

  if (settings?.imaOpenApiClientId) {
    hasClientId = true;
    clientIdPreview = previewCredential(settings.imaOpenApiClientId);
  }
  if (settings?.imaOpenApiApiKey) {
    hasApiKey = true;
  }

  if (!hasClientId) {
    hasClientId = !!String(process.env.IMA_OPENAPI_CLIENTID || "").trim();
  }
  if (!hasApiKey) {
    hasApiKey = !!String(process.env.IMA_OPENAPI_APIKEY || "").trim();
  }
  if (!clientIdPreview && process.env.IMA_OPENAPI_CLIENTID) {
    clientIdPreview = previewCredential(String(process.env.IMA_OPENAPI_CLIENTID));
  }

  return {
    configured: hasClientId && hasApiKey,
    hasClientId,
    hasApiKey,
    clientIdPreview,
  };
}

function previewCredential(value: string): string {
  if (value.length <= 12) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

export function saveImaOpenApiSettings(settings: { clientId: string; apiKey: string }): void {
  const existing = getSettingsStoreValue() || {};
  saveAppSettings({ ...existing, imaOpenApiClientId: settings.clientId, imaOpenApiApiKey: settings.apiKey });
  _settingsCache = { ...existing, imaOpenApiClientId: settings.clientId, imaOpenApiApiKey: settings.apiKey };
}

export function clearImaOpenApiSettings(): void {
  clearAppSettings();
  _settingsCache = null;
}

export function getDuplicatePolicy(): DuplicatePolicy {
  const settings = getSettingsStoreValue();
  const policy = settings?.duplicatePolicy;
  if (policy === "rename" || policy === "skip" || policy === "reject") {
    return policy;
  }
  return "reject";
}

export function saveDuplicatePolicy(policy: DuplicatePolicy): void {
  const existing = getSettingsStoreValue() || {};
  saveAppSettings({ ...existing, duplicatePolicy: policy });
  _settingsCache = { ...existing, duplicatePolicy: policy };
}
