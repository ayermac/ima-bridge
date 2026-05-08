import type { DocumentItem } from "./types";

const WINDOWS_RESERVED_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

const MAX_PART_LENGTH = 120;

export function cleanPathPart(part: string): string {
  let cleaned = part
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  // Remove trailing dots/spaces (invalid on Windows)
  cleaned = cleaned.replace(/[.\s]+$/, "");

  // Check Windows reserved names (case-insensitive)
  const upper = cleaned.toUpperCase();
  const base = upper.includes(".") ? upper.split(".")[0] : upper;
  if (WINDOWS_RESERVED_NAMES.has(base)) {
    cleaned = `${cleaned}_`;
  }

  // Truncate
  if (cleaned.length > MAX_PART_LENGTH) {
    cleaned = cleaned.slice(0, MAX_PART_LENGTH);
    // Re-strip trailing dots after truncation
    cleaned = cleaned.replace(/[.\s]+$/, "");
  }

  return cleaned || "未命名";
}

export function pathParts(path: string): string[] {
  return String(path || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .map(cleanPathPart);
}

export function filenameFor(doc: DocumentItem, media: Record<string, unknown>): string {
  const title = cleanPathPart(String(media?.title || doc.title || "ima-file"));
  const sourcePath = String(media?.source_path || media?.raw_file_url || "");
  let ext = "";
  if (sourcePath.includes(".")) {
    const candidate = sourcePath.slice(sourcePath.lastIndexOf("."));
    if (/^\.[a-z0-9]{1,8}$/i.test(candidate)) ext = candidate;
  }
  const filename = ext && !title.toLowerCase().endsWith(ext.toLowerCase()) ? `${title}${ext}` : title;
  return [...pathParts(doc._path), filename].join("/");
}
