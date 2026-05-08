import { BrowserWindow } from "electron";
import type { ImaAccountInfo } from "@core/types";

let loginWindow: BrowserWindow | null = null;

const ACCOUNT_KEY = "ima-universal-local-storage-accountInfo";

let accountInfoListeners: ((account: ImaAccountInfo | null) => void)[] = [];
let loginWindowClosedListeners: (() => void)[] = [];

export function onAccountInfoChanged(callback: (account: ImaAccountInfo | null) => void): () => void {
  accountInfoListeners.push(callback);
  return () => {
    accountInfoListeners = accountInfoListeners.filter((cb) => cb !== callback);
  };
}

export function onLoginWindowClosed(callback: () => void): () => void {
  loginWindowClosedListeners.push(callback);
  return () => {
    loginWindowClosedListeners = loginWindowClosedListeners.filter((cb) => cb !== callback);
  };
}

function notifyAccountInfo(account: ImaAccountInfo | null) {
  for (const cb of accountInfoListeners) {
    try {
      cb(account);
    } catch {}
  }
}

function notifyLoginWindowClosed() {
  for (const cb of loginWindowClosedListeners) {
    try {
      cb();
    } catch {}
  }
}

export function createLoginWindow(): void {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return;
  }

  loginWindow = new BrowserWindow({
    width: 420,
    height: 640,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  loginWindow.loadURL("https://ima.qq.com");

  loginWindow.webContents.on("dom-ready", async () => {
    await tryReadAccountInfo();
  });

  loginWindow.on("closed", () => {
    loginWindow = null;
    notifyLoginWindowClosed();
  });
}

export function closeLoginWindow(): void {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
    loginWindow = null;
  }
}

export function getLoginWebContents() {
  return loginWindow?.webContents ?? null;
}

export async function tryReadAccountInfo(): Promise<ImaAccountInfo | null> {
  const wc = getLoginWebContents();
  if (!wc) return null;

  try {
    const raw = await wc.executeJavaScript(`localStorage.getItem("${ACCOUNT_KEY}")`);
    if (!raw || typeof raw !== "string") return null;

    const account = JSON.parse(raw) as Record<string, unknown>;
    const guid = String(account.guid || "");
    const guidPart = guid.includes("-") ? guid.split("-")[1] : guid;
    const token = String(account.token || "");
    const refreshToken = String(account.refreshToken || "");
    const uid = String(account.uid || "");

    if (!guidPart || !token || !refreshToken || !uid) return null;

    const info: ImaAccountInfo = { guid: guidPart, token, refreshToken, uid };
    notifyAccountInfo(info);
    return info;
  } catch {
    return null;
  }
}
