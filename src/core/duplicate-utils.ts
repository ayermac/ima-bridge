import path from "path";

export function generateTimestampSuffix(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}_${h}${min}${s}`;
}

export function renameWithTimestamp(fileName: string, now: Date = new Date()): string {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  const suffix = generateTimestampSuffix(now);
  return `${base}_${suffix}${ext}`;
}
