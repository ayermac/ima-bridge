import { BrowserWindow, app } from "electron";
import path from "path";
import fs from "fs";
import type { ImaAccountInfo } from "@core/types";
import type { LoginProbeStatus } from "@runtime/adapter";

let loginWindow: BrowserWindow | null = null;

const ACCOUNT_KEY = "ima-universal-local-storage-accountInfo";
const UID_KEY = "ima-official-website-uid";
const IMA_URL = "https://ima.qq.com";
const IMA_LOGIN_URL = `${IMA_URL}/login`;
const STORAGE_PROBE_SCRIPT = `
  (() => {
    const accountKey = ${JSON.stringify(ACCOUNT_KEY)};
    const collect = (storage) => {
      const values = [];
      const keys = [];
      if (!storage) return { values, keys };
      const direct = storage.getItem(accountKey);
      if (direct) values.push({ key: accountKey, value: direct });
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!key) continue;
        keys.push(key);
        if (key === accountKey) continue;
        const value = storage.getItem(key);
        if (!value) continue;
        if (/account|login|token|user|ima/i.test(key) || /token|refreshToken|IMA-TOKEN|uid|guid/i.test(value)) {
          values.push({ key, value });
        }
      }
      return { values, keys };
    };
    const text = document.body ? document.body.innerText || "" : "";
    return {
      href: location.href,
      title: document.title,
      readyState: document.readyState,
      text,
      local: collect(window.localStorage),
      session: collect(window.sessionStorage),
      pageSignals: {
        scanSuccess: /扫描成功|扫码成功|已扫描/.test(text),
        allowOnPhone: /允许|授权|轻触|确认登录/.test(text),
        qrVisible: /扫码|二维码|微信/.test(text),
        expired: /过期|失效|刷新/.test(text),
        loginSuccess: /登录成功|已登录/.test(text)
      }
    };
  })()
`;

const UID_PROBE_SCRIPT = `
  (() => {
    const uid = localStorage.getItem("ima-official-website-uid");
    return { uid };
  })()
`;

let accountInfoListeners: ((account: ImaAccountInfo | null) => void)[] = [];
let loginWindowClosedListeners: (() => void)[] = [];
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastMainPageProbeAt = 0;

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

export function notifyAccountInfo(account: ImaAccountInfo | null) {
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

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void tryReadAccountInfo();
  }, 800);
}

function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function normalizeAccount(candidate: unknown): ImaAccountInfo | null {
  if (!candidate || typeof candidate !== "object") return null;

  const item = candidate as Record<string, unknown>;
  const guid = firstString(item.guid, item.imaGuid, item.IMA_GUID, item["IMA-GUID"]);
  const guidPart = guid.includes("-") ? guid.split("-").pop() || "" : guid;
  const token = firstString(item.token, item.imaToken, item.accessToken, item.IMA_TOKEN, item["IMA-TOKEN"]);
  const refreshToken = firstString(
    item.refreshToken,
    item.refresh_token,
    item.imaRefreshToken,
    item.IMA_REFRESH_TOKEN,
    item["IMA-REFRESH-TOKEN"]
  );
  const uid = firstString(item.uid, item.uin, item.userId, item.imaUid, item.IMA_UID, item["IMA-UID"]);

  if (!guidPart || !token || !refreshToken || !uid) return null;
  return { guid: guidPart, token, refreshToken, uid };
}

function findAccountDeep(value: unknown, depth = 0, seen = new Set<unknown>()): ImaAccountInfo | null {
  if (!value || depth > 4 || seen.has(value)) return null;

  if (typeof value === "string") {
    const text = value.trim();
    if (!text || (!text.includes("token") && !text.includes("Token") && !text.includes("IMA-TOKEN"))) return null;
    try {
      return findAccountDeep(JSON.parse(text), depth + 1, seen);
    } catch {
      return null;
    }
  }

  if (typeof value !== "object") return null;
  seen.add(value);

  const normalized = normalizeAccount(value);
  if (normalized) return normalized;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAccountDeep(item, depth + 1, seen);
      if (found) return found;
    }
    return null;
  }

  const object = value as Record<string, unknown>;
  const preferredKeys = ["accountInfo", "account", "userInfo", "user", "data", "loginInfo", "auth"];
  for (const key of preferredKeys) {
    const found = findAccountDeep(object[key], depth + 1, seen);
    if (found) return found;
  }

  for (const child of Object.values(object)) {
    const found = findAccountDeep(child, depth + 1, seen);
    if (found) return found;
  }

  return null;
}

async function readStorageAccount(): Promise<ImaAccountInfo | null> {
  const dumps = await collectFrameStorageDumps();
  const groups = dumps.flatMap((storageDump) => [
    ...((((storageDump as Record<string, unknown>)?.local as Record<string, unknown>)?.values as unknown[]) || []),
    ...((((storageDump as Record<string, unknown>)?.session as Record<string, unknown>)?.values as unknown[]) || []),
  ]);

  for (const item of groups) {
    const value = (item as Record<string, unknown>)?.value;
    const account = findAccountDeep(value);
    if (account) return account;
  }

  return null;
}

async function readCookieAccount(): Promise<ImaAccountInfo | null> {
  const wc = getLoginWebContents();
  if (!wc) return null;

  const cookies = await wc.session.cookies.get({ url: IMA_URL });
  const byName = new Map(cookies.map((cookie) => [cookie.name, cookie.value]));
  return normalizeAccount({
    "IMA-GUID": byName.get("IMA-GUID"),
    "IMA-TOKEN": byName.get("IMA-TOKEN"),
    "IMA-REFRESH-TOKEN": byName.get("IMA-REFRESH-TOKEN"),
    "IMA-UID": byName.get("IMA-UID"),
  });
}

function getLoginFrames(): Array<{ url?: string; executeJavaScript(script: string): Promise<unknown>; frames?: unknown[] }> {
  const wc = getLoginWebContents() as unknown as { mainFrame?: unknown };
  const mainFrame = wc?.mainFrame as { url?: string; executeJavaScript(script: string): Promise<unknown>; frames?: unknown[] } | undefined;
  if (!mainFrame) return [];

  const frames: Array<{ url?: string; executeJavaScript(script: string): Promise<unknown>; frames?: unknown[] }> = [];
  const visit = (frame: { url?: string; executeJavaScript(script: string): Promise<unknown>; frames?: unknown[] }) => {
    frames.push(frame);
    for (const child of frame.frames || []) {
      visit(child as { url?: string; executeJavaScript(script: string): Promise<unknown>; frames?: unknown[] });
    }
  };
  visit(mainFrame);
  return frames;
}

async function collectFrameStorageDumps(): Promise<unknown[]> {
  const wc = getLoginWebContents();
  if (!wc) return [];

  const frames = getLoginFrames();
  if (frames.length === 0) {
    return [await wc.executeJavaScript(STORAGE_PROBE_SCRIPT)];
  }

  const dumps: unknown[] = [];
  for (const frame of frames) {
    try {
      dumps.push(await frame.executeJavaScript(STORAGE_PROBE_SCRIPT));
    } catch {
      // Cross-origin or transient frame; ignore and continue probing other frames.
    }
  }
  return dumps;
}

function hasPostScanSignal(dumps: unknown[]): boolean {
  return dumps.some((dump) => {
    const signals = ((dump as Record<string, unknown>)?.pageSignals as Partial<LoginProbeStatus["pageSignals"]>) || {};
    return !!(signals.scanSuccess || signals.allowOnPhone || signals.loginSuccess);
  });
}

async function probeMainPageAfterScan(dumps: unknown[]): Promise<void> {
  const wc = getLoginWebContents();
  if (!wc || !hasPostScanSignal(dumps)) return;

  const now = Date.now();
  if (now - lastMainPageProbeAt < 2500) return;
  lastMainPageProbeAt = now;

  const currentUrl = wc.getURL();
  if (currentUrl && !currentUrl.includes("/login")) return;

  await wc.loadURL(IMA_URL, { userAgent: wc.userAgent }).catch(() => {});
}

function emptyLoginProbeStatus(): LoginProbeStatus {
  return {
    windowOpen: false,
    hasAccount: false,
    localStorageKeys: [],
    sessionStorageKeys: [],
    cookieNames: [],
    pageSignals: {
      scanSuccess: false,
      allowOnPhone: false,
      qrVisible: false,
      expired: false,
      loginSuccess: false,
    },
  };
}

export async function getLoginProbeStatus(): Promise<LoginProbeStatus> {
  const wc = getLoginWebContents();
  if (!wc) return emptyLoginProbeStatus();

  const dumps = await collectFrameStorageDumps();
  const pageInfos = dumps.map((dump) => dump as Record<string, unknown>);
  const firstPage = pageInfos[0] || {};

  const cookies = await wc.session.cookies.get({ url: IMA_URL });
  const account = await tryReadAccountInfo();
  const localStorageKeys = new Set<string>();
  const sessionStorageKeys = new Set<string>();
  const pageSignals = {
    scanSuccess: false,
    allowOnPhone: false,
    qrVisible: false,
    expired: false,
    loginSuccess: false,
  };

  for (const pageInfo of pageInfos) {
    const localKeys = (((pageInfo.local as Record<string, unknown>)?.keys as unknown[]) || []).map(String);
    const sessionKeys = (((pageInfo.session as Record<string, unknown>)?.keys as unknown[]) || []).map(String);
    localKeys.forEach((key) => localStorageKeys.add(key));
    sessionKeys.forEach((key) => sessionStorageKeys.add(key));
    const signals = (pageInfo.pageSignals as Partial<LoginProbeStatus["pageSignals"]>) || {};
    pageSignals.scanSuccess ||= !!signals.scanSuccess;
    pageSignals.allowOnPhone ||= !!signals.allowOnPhone;
    pageSignals.qrVisible ||= !!signals.qrVisible;
    pageSignals.expired ||= !!signals.expired;
    pageSignals.loginSuccess ||= !!signals.loginSuccess;
  }

  return {
    windowOpen: true,
    href: String(firstPage.href || ""),
    title: String(firstPage.title || ""),
    readyState: String(firstPage.readyState || ""),
    hasAccount: !!account,
    localStorageKeys: Array.from(localStorageKeys),
    sessionStorageKeys: Array.from(sessionStorageKeys),
    cookieNames: cookies.map((cookie) => cookie.name).sort(),
    pageSignals,
  };
}

export async function createLoginWindow(parent?: BrowserWindow): Promise<void> {
  if (loginWindow && !loginWindow.isDestroyed()) {
    if (loginWindow.isMinimized()) loginWindow.restore();
    loginWindow.show();
    loginWindow.focus();
    return;
  }

  loginWindow = new BrowserWindow({
    width: 420,
    height: 640,
    title: "IMA 登录",
    parent,
    show: false,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      nativeWindowOpen: true,
      allowRunningInsecureContent: true,
    },
  });

  loginWindow.setMenuBarVisibility(false);

  // Mask as a normal Chrome browser to avoid being redirected to landing page
  const chromeUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
  loginWindow.webContents.userAgent = chromeUA;

  // Allow all permission requests (camera, notifications, etc.)
  loginWindow.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(true);
  });

  // Allow third-party cookies (required for WeChat QR login cross-domain flow)
  loginWindow.webContents.session.cookies.set({
    url: "https://ima.qq.com",
    name: "_ima_cookie_test",
    value: "1",
    sameSite: "no_restriction",
  }).catch(() => {});

  // Ensure cookies are not cleared on exit
  loginWindow.webContents.session.setUserAgent(chromeUA);

  // Force Chrome UA on all requests and strip Electron fingerprints from headers
  loginWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders["User-Agent"] = chromeUA;
    delete details.requestHeaders["X-Electron"];
    delete details.requestHeaders["X-Electron-Version"];
    callback({ requestHeaders: details.requestHeaders });
  });

  // Log all navigation and requests for debugging
  const logPath = path.join(app.getPath("temp"), "ima-bridge-login.log");
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try { fs.appendFileSync(logPath, line); } catch {}
    console.log(line.trim());
  };
  loginWindow.webContents.on("will-navigate", (_event, url) => {
    log(`[Login] will-navigate: ${url}`);
  });
  loginWindow.webContents.on("did-navigate", (_event, url) => {
    log(`[Login] did-navigate: ${url}`);
  });
  loginWindow.webContents.session.webRequest.onCompleted((details) => {
    if (details.statusCode >= 400) {
      log(`[Login] request failed: ${details.method} ${details.url} ${details.statusCode}`);
    }
  });

  loginWindow.webContents.on("dom-ready", async () => {
    await loginWindow?.webContents.executeJavaScript(`
      // Comprehensive browser fingerprint spoofing
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [
        {name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format", version: "undefined", length: 1, item: function() { return this[0]; }, namedItem: function() { return null; }, [Symbol.iterator]: function*() { yield this[0]; }},
        {name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "Portable Document Format", version: "undefined", length: 1, item: function() { return this[0]; }, namedItem: function() { return null; }, [Symbol.iterator]: function*() { yield this[0]; }},
        {name: "Native Client", filename: "internal-nacl-plugin", description: "Native Client module", version: "undefined", length: 2, item: function(i) { return i < 2 ? {} : null; }, namedItem: function() { return null; }, [Symbol.iterator]: function*() { yield {}; yield {}; }},
        {name: "Widevine Content Decryption Module", filename: "widevinecdmadapter.dll", description: "Widevine Content Decryption Module", version: "undefined", length: 0, item: function() { return null; }, namedItem: function() { return null; }, [Symbol.iterator]: function*() {}},
      ]});
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
      Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
      Object.defineProperty(navigator, 'product', { get: () => 'Gecko' });
      Object.defineProperty(navigator, 'productSub', { get: () => '20030107' });
      Object.defineProperty(navigator, 'vendorSub', { get: () => '' });
      Object.defineProperty(navigator, 'doNotTrack', { get: () => null });
      Object.defineProperty(navigator, 'cookieEnabled', { get: () => true });
      Object.defineProperty(navigator, 'onLine', { get: () => true });
      Object.defineProperty(navigator, 'pdfViewerEnabled', { get: () => true });
      Object.defineProperty(navigator, 'scheduling', { get: () => undefined });
      Object.defineProperty(navigator, 'storage', { get: () => ({ estimate: () => Promise.resolve({quota: 274877906944, usage: 0}), persist: () => Promise.resolve(false), persisted: () => Promise.resolve(false) }) });
      Object.defineProperty(navigator, 'wakeLock', { get: () => ({ request: () => Promise.resolve({ release: () => {} }) }) });
      Object.defineProperty(navigator, 'permissions', { get: () => ({ query: () => Promise.resolve({ state: 'prompt' }) }) });
      Object.defineProperty(navigator, 'clipboard', { get: () => ({ readText: () => Promise.resolve(''), writeText: () => Promise.resolve(), read: () => Promise.resolve([]), write: () => Promise.resolve() }) });
      Object.defineProperty(navigator, 'mediaCapabilities', { get: () => ({ decodingInfo: () => Promise.resolve({ supported: true, smooth: true, powerEfficient: true }) }) });
      Object.defineProperty(navigator, 'presentation', { get: () => undefined });
      Object.defineProperty(navigator, 'bluetooth', { get: () => undefined });
      Object.defineProperty(navigator, 'keyboard', { get: () => undefined });
      Object.defineProperty(navigator, 'mediaSession', { get: () => ({ metadata: null, playbackState: 'none', setActionHandler: () => {}, setPositionState: () => {} }) });
      Object.defineProperty(navigator, 'mimeTypes', { get: () => ({
        length: 4,
        item: function(i) { return this[i]; },
        namedItem: function(name) { return this[name] || null; },
        0: {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: navigator.plugins[1]},
        1: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: navigator.plugins[1]},
        2: {type: "application/x-nacl", suffixes: "", description: "Native Client module", enabledPlugin: navigator.plugins[2]},
        3: {type: "application/x-pnacl", suffixes: "", description: "Portable Native Client module", enabledPlugin: navigator.plugins[2]},
        "application/pdf": {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: navigator.plugins[1]},
        "application/x-google-chrome-pdf": {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: navigator.plugins[1]},
      }) });
      Object.defineProperty(screen, 'width', { get: () => 1680 });
      Object.defineProperty(screen, 'height', { get: () => 1050 });
      Object.defineProperty(screen, 'availWidth', { get: () => 1680 });
      Object.defineProperty(screen, 'availHeight', { get: () => 1027 });
      Object.defineProperty(screen, 'colorDepth', { get: () => 30 });
      Object.defineProperty(screen, 'pixelDepth', { get: () => 30 });
      Object.defineProperty(screen, 'availLeft', { get: () => 0 });
      Object.defineProperty(screen, 'availTop', { get: () => 23 });
      window.chrome = {
        runtime: {
          OnInstalledReason: { CHROME_UPDATE: "chrome_update", INSTALL: "install", SHARED_MODULE_UPDATE: "shared_module_update", UPDATE: "update" },
          OnRestartRequiredReason: { APP_UPDATE: "app_update", OS_UPDATE: "os_update", PERIODIC: "periodic" },
          PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", MIPS64EL: "mips64el", MIPSEL: "mipsel", X86_32: "x86-32", X86_64: "x86-64" },
          PlatformNaclArch: { ARM: "arm", MIPS: "mips", MIPS64: "mips64", MIPS64EL: "mips64el", MIPSEL: "mipsel", MIPSEL64: "mipsel64", X86_32: "x86-32", X86_64: "x86-64" },
          PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
          RequestUpdateCheckStatus: { NO_UPDATE: "no_update", THROTTLED: "throttled", UPDATE_AVAILABLE: "update_available" },
          OnConnectEvent: { CONNECT: "connect", DISCONNECT: "disconnect" },
          OnMessageEvent: { MESSAGE: "message" },
          sendMessage: function() {},
          onMessage: { addListener: function() {}, removeListener: function() {} },
          onConnect: { addListener: function() {}, removeListener: function() {} },
          connect: function() { return { onMessage: { addListener: function(){} }, onDisconnect: { addListener: function(){} }, postMessage: function(){} }; }
        },
        app: { isInstalled: false, InstallState: { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" }, RunningState: { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" } },
        csi: function() { return { onloadT: Date.now(), pageT: Date.now(), startE: Date.now() }; },
        loadTimes: function() { return { commitLoadTime: Date.now(), connectionInfo: "h2", finishDocumentLoadTime: Date.now(), finishLoadTime: Date.now(), firstPaintAfterLoadTime: 0, firstPaintTime: Date.now(), navigationType: "Other", npnNegotiatedProtocol: "h2", requestTime: Date.now(), startLoadTime: Date.now(), wasAlternateProtocolAvailable: false, wasFetchedViaSpdy: true }; }
      };
      // Override Notification to prevent "Notifications are not supported" detection
      if (!window.Notification) {
        window.Notification = function(title, options) { this.title = title; this.body = options?.body || ''; this.icon = options?.icon || ''; this.tag = options?.tag || ''; this.requireInteraction = options?.requireInteraction || false; this.silent = options?.silent || false; this.onclick = null; this.onclose = null; this.onerror = null; this.onshow = null; };
        window.Notification.permission = "default";
        window.Notification.requestPermission = function() { return Promise.resolve("default"); };
        window.Notification.maxActions = 2;
      }
      // Override PushManager
      if (!window.PushManager) {
        window.PushManager = function() {};
        window.PushManager.prototype.subscribe = function() { return Promise.reject(new Error("Push not supported")); };
        window.PushManager.prototype.getSubscription = function() { return Promise.resolve(null); };
        window.PushManager.prototype.permissionState = function() { return Promise.resolve("prompt"); };
      }
      if (window.process && window.process.type) {
        Object.defineProperty(window, 'process', { get: () => undefined });
      }
      if (window.Electron) delete window.Electron;
      if (window.require) delete window.require;
      // Expose all storage keys for debugging
      window.__imaDebug = {
        localKeys: Array.from({length: localStorage.length}, (_, i) => localStorage.key(i)),
        sessionKeys: Array.from({length: sessionStorage.length}, (_, i) => sessionStorage.key(i)),
      };
    `);
    // Start polling for account info after injection
    startPolling();
    await tryReadAccountInfo();
  });

  // Also check on navigation (page redirect after login)
  loginWindow.webContents.on("did-navigate", async (_event, url) => {
    // If redirected to ima.copilot after scan, the login flow may have completed
    // but the page is showing the landing page. Keep polling for credentials.
    if (url.includes("ima.copilot") || url.includes("/copilot")) {
      // Give the page a moment to write localStorage/cookies
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await tryReadAccountInfo();
  });

  loginWindow.once("ready-to-show", () => {
    if (!loginWindow || loginWindow.isDestroyed()) return;
    loginWindow.show();
    loginWindow.focus();
    // Always open DevTools for login window so user can inspect storage/cookies
    loginWindow.webContents.openDevTools({ mode: "detach" });
  });

  const showFallback = setTimeout(() => {
    if (!loginWindow || loginWindow.isDestroyed() || loginWindow.isVisible()) return;
    loginWindow.show();
    loginWindow.focus();
  }, 1200);

  loginWindow.webContents.on("did-fail-load", () => {
    if (!loginWindow || loginWindow.isDestroyed()) return;
    loginWindow.show();
    loginWindow.focus();
  });

  loginWindow.on("closed", () => {
    stopPolling();
    loginWindow = null;
    notifyLoginWindowClosed();
  });

  await loginWindow.loadURL(IMA_LOGIN_URL, {
    userAgent: loginWindow.webContents.userAgent,
  }).catch(() => {
    if (!loginWindow || loginWindow.isDestroyed()) return;
    loginWindow.show();
    loginWindow.focus();
  });
  clearTimeout(showFallback);
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

async function readUidFromStorage(): Promise<string | null> {
  const wc = getLoginWebContents();
  if (!wc) return null;
  try {
    const result = await wc.executeJavaScript(UID_PROBE_SCRIPT);
    const uid = (result as Record<string, unknown>)?.uid;
    return typeof uid === "string" && uid.trim() ? uid.trim() : null;
  } catch {
    return null;
  }
}

export async function tryReadAccountInfo(): Promise<ImaAccountInfo | null> {
  try {
    const info = (await readStorageAccount()) || (await readCookieAccount());
    if (!info) {
      await probeMainPageAfterScan(await collectFrameStorageDumps());
      return null;
    }

    notifyAccountInfo(info);
    // Auto-close login window on successful login
    if (loginWindow && !loginWindow.isDestroyed()) {
      stopPolling();
      loginWindow.close();
      loginWindow = null;
    }
    return info;
  } catch {
    return null;
  }
}
