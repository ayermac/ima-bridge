import type { ImaAccountInfo } from "./types";

export function bknHash(token: string): string {
  let hash = 5381;
  for (let i = 0; i < token.length; i += 1) {
    hash += (hash << 5) + token.charCodeAt(i);
  }
  return String(hash & 2147483647);
}

export function parseAccountInfo(raw: string | null): ImaAccountInfo {
  if (!raw) {
    throw new Error("未找到 IMA 登录信息，请先登录 ima.qq.com");
  }
  const account = JSON.parse(raw) as Record<string, unknown>;
  const guid = String(account.guid || "");
  const guidPart = guid.includes("-") ? guid.split("-")[1] : guid;
  const token = String(account.token || "");
  const refreshToken = String(account.refreshToken || "");
  const uid = String(account.uid || "");

  if (!guidPart || !token || !refreshToken || !uid) {
    throw new Error("IMA 登录信息不完整");
  }

  return { guid: guidPart, token, refreshToken, uid };
}

export function buildHeaders(account: ImaAccountInfo): Record<string, string> {
  const imaCookie = [
    `IMA-GUID=${account.guid}`,
    `IMA-REFRESH-TOKEN=${account.refreshToken}`,
    `IMA-TOKEN=${account.token}`,
    `IMA-UID=${account.uid}`,
    "UID-TYPE=2",
    "TOKEN-TYPE=14",
    "PLATFORM=H5",
    "CLIENT-TYPE=256020",
    "WEB-VERSION=1.1.2",
  ].join("; ");

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    from_browser_ima: "1",
    "x-ima-bkn": bknHash(account.token),
    "x-ima-cookie": imaCookie,
  };
}

