import { ipcMain, dialog, shell, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import {
  createLoginWindow,
  closeLoginWindow,
  getLoginProbeStatus,
  tryReadAccountInfo,
  onAccountInfoChanged,
  onLoginWindowClosed,
  notifyAccountInfo,
} from "./login-window";
import {
  getImaOpenApiConfigStatus,
  getImaOpenApiCredentials,
  saveImaOpenApiSettings,
  clearImaOpenApiSettings,
  getDuplicatePolicy,
  saveDuplicatePolicy,
} from "./env";
import type { DuplicatePolicy } from "../core/types";
import { ImaOpenApi, inferMediaType } from "../core/ima-open-api";
import { renameWithTimestamp } from "../core/duplicate-utils";
import { uploadToCos } from "./cos-upload";
import { loadQueueState, saveQueueState, clearQueueState } from "./queue-store";
import type { QueuePersistedState } from "./queue-store";
import { loadAccountInfo, saveAccountInfo, clearAccountInfo } from "./settings-store";

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle("ima:openLoginWindow", async () => {
    await createLoginWindow(mainWindow);
  });

  ipcMain.handle("ima:closeLoginWindow", () => {
    closeLoginWindow();
  });

  ipcMain.handle("ima:getAccountInfo", async () => {
    return tryReadAccountInfo() || loadAccountInfo();
  });

  ipcMain.handle("ima:getLoginProbeStatus", async () => {
    return getLoginProbeStatus();
  });

  ipcMain.handle("ima:clearAccountInfo", () => {
    clearAccountInfo();
    notifyAccountInfo(null);
    return Promise.resolve();
  });

  ipcMain.handle("ima:setAccountInfo", (_event, info: { guid: string; token: string; refreshToken: string; uid: string }) => {
    saveAccountInfo(info);
    notifyAccountInfo(info);
    return Promise.resolve();
  });

  ipcMain.handle("ima:chooseDirectory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("ima:saveFile", async (_event, filePath: string, data: string) => {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, data, "utf-8");
  });

  function downloadWithRedirect(
    url: string,
    filePath: string,
    redirectCount = 0
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (redirectCount > 5) {
        reject(new Error("重定向次数过多"));
        return;
      }

      const client = url.startsWith("https:") ? https : http;
      const req = client.get(
        url,
        { headers: { "User-Agent": "Mozilla/5.0" } },
        (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            const redirectUrl = new URL(res.headers.location, url).toString();
            res.resume();
            downloadWithRedirect(redirectUrl, filePath, redirectCount + 1)
              .then(resolve)
              .catch(reject);
            return;
          }

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            res.resume();
            reject(new Error(`下载失败：HTTP ${res.statusCode}`));
            return;
          }

          const file = fs.createWriteStream(filePath);
          let settled = false;
          let fileFinished = false;

          const fail = (err: Error) => {
            if (settled) return;
            settled = true;
            file.destroy();
            fs.promises.unlink(filePath).catch(() => {});
            reject(err);
          };

          res.pipe(file);
          file.on("finish", () => {
            if (settled) return;
            fileFinished = true;
            file.close(() => {
              if (settled) return;
              settled = true;
              resolve();
            });
          });
          file.on("error", (err) => {
            fail(err);
          });
          res.on("aborted", () => {
            fail(new Error("下载连接已中断"));
          });
          res.on("error", (err) => {
            fail(err);
          });
          res.on("close", () => {
            if (!fileFinished && !res.complete) {
              fail(new Error("下载连接提前关闭"));
            }
          });
        }
      );
      req.on("error", (err) => {
        fs.promises.unlink(filePath).catch(() => {});
        reject(err);
      });
      req.setTimeout(60000, () => {
        req.destroy();
        fs.promises.unlink(filePath).catch(() => {});
        reject(new Error("下载超时"));
      });
    });
  }

  ipcMain.handle("ima:downloadUrl", async (_event, url: string, filePath: string) => {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await downloadWithRedirect(url, filePath);
  });

  ipcMain.handle("ima:openPath", async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });

  ipcMain.handle("ima:getOpenApiConfigStatus", () => {
    return getImaOpenApiConfigStatus();
  });

  ipcMain.handle("ima:getOpenApiSettingsStatus", () => {
    return getImaOpenApiConfigStatus();
  });

  ipcMain.handle("ima:saveOpenApiSettings", (_event, clientId: string, apiKey: string) => {
    const trimmedClientId = String(clientId || "").trim();
    const trimmedApiKey = String(apiKey || "").trim();
    if (!trimmedClientId || !trimmedApiKey) {
      throw new Error("Client ID 和 API Key 不能为空");
    }
    saveImaOpenApiSettings({ clientId: trimmedClientId, apiKey: trimmedApiKey });
    mainWindow.webContents.send("ima:openApiConfigChanged");
    return { success: true };
  });

  ipcMain.handle("ima:clearOpenApiSettings", () => {
    clearImaOpenApiSettings();
    mainWindow.webContents.send("ima:openApiConfigChanged");
    return { success: true };
  });

  ipcMain.handle("ima:getDuplicatePolicy", () => {
    return getDuplicatePolicy();
  });

  ipcMain.handle("ima:saveDuplicatePolicy", (_event, policy: DuplicatePolicy) => {
    if (policy !== "reject" && policy !== "rename" && policy !== "skip") {
      throw new Error("无效的重名策略");
    }
    saveDuplicatePolicy(policy);
    return { success: true };
  });

  const ALLOWED_API_FETCH_HOSTS = new Set([
    "ima.qq.com",
    "ima.copilot",
    "mp.weixin.qq.com",
    "mmbiz.qpic.cn",
    "res.wx.qq.com",
  ]);

  function isAllowedHost(hostname: string): boolean {
    if (ALLOWED_API_FETCH_HOSTS.has(hostname)) return true;
    // 腾讯云 COS 图片域名 (*.image.myqcloud.com, *.cos.*.myqcloud.com)
    if (hostname.endsWith(".myqcloud.com")) return true;
    return false;
  }

  function sendApiLog(level: "info" | "error" | "warn", message: string) {
    mainWindow.webContents.send("ima:apiLog", {
      time: new Date().toLocaleTimeString(),
      level,
      message,
    });
  }

  ipcMain.handle("ima:apiFetch", async (_event, url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const parsedUrl = new URL(url);
    if (!isAllowedHost(parsedUrl.hostname)) {
      throw new Error(`不允许的请求目标: ${parsedUrl.hostname}`);
    }

    return new Promise<{ ok: boolean; status: number; data: unknown; text: string; headers: Record<string, string> }>((resolve, reject) => {
      const startTime = Date.now();
      const client = url.startsWith("https:") ? https : http;
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (url.startsWith("https:") ? "443" : "80"),
        path: parsedUrl.pathname + parsedUrl.search,
        method: init.method || "GET",
        headers: init.headers || {},
      };
      sendApiLog("info", `[apiFetch] ${options.method} ${url}`);
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        req.destroy();
        sendApiLog("error", `[apiFetch] 超时 ${Date.now() - startTime}ms: ${url}`);
        reject(new Error("请求超时"));
      }, 30000);

      const req = client.request(options, (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => { data += chunk; });
        res.on("end", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          const elapsed = Date.now() - startTime;
          sendApiLog("info", `[apiFetch] 响应 ${res.statusCode} ${elapsed}ms ${url} (body=${data.length} chars)`);
          let json: unknown;
          try { json = JSON.parse(data); } catch { json = undefined; }
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            headers[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
          }
          resolve({ ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300, status: res.statusCode || 0, data: json, text: data, headers });
        });
      });
      req.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        sendApiLog("error", `[apiFetch] 错误 ${Date.now() - startTime}ms ${url}: ${err.message}`);
        reject(err);
      });
      if (init.body) req.write(init.body);
      req.end();
    });
  });

  ipcMain.handle("ima:downloadBinaryBase64", async (_event, url: string, extraHeaders?: Record<string, string>) => {
    const parsedUrl = new URL(url);
    if (!isAllowedHost(parsedUrl.hostname)) {
      throw new Error(`不允许的下载目标: ${parsedUrl.hostname}`);
    }

    return new Promise<{ base64: string; contentType: string }>((resolve, reject) => {
      const client = url.startsWith("https:") ? https : http;
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (url.startsWith("https:") ? "443" : "80"),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          "Referer": parsedUrl.hostname.includes("mmbiz.qpic.cn") || parsedUrl.hostname.includes("wx.qq.com")
            ? "https://mp.weixin.qq.com/"
            : "https://ima.qq.com/",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
          ...extraHeaders,
        },
      };
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        req.destroy();
        reject(new Error("图片下载超时"));
      }, 30000);

      const req = client.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => { chunks.push(chunk); });
        res.on("end", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
            reject(new Error(`图片下载失败: HTTP ${res.statusCode}`));
            return;
          }
          const buf = Buffer.concat(chunks);
          const contentType = String(res.headers["content-type"] || "image/png");
          resolve({ base64: buf.toString("base64"), contentType });
        });
      });
      req.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(err);
      });
      req.end();
    });
  });

  ipcMain.handle("ima:listAddableKnowledgeBases", async () => {
    const credentials = getImaOpenApiCredentials();
    if (!credentials) throw new Error("OpenAPI 未配置");
    const api = new ImaOpenApi(credentials);
    return api.listAddableKnowledgeBases();
  });

  async function syncFileToKnowledgeBase(params: {
    localFilePath: string;
    targetKnowledgeBaseId: string;
    title: string;
    duplicatePolicy?: DuplicatePolicy;
  }): Promise<{ success: boolean; mediaId?: string; skipped?: boolean }> {
    const credentials = getImaOpenApiCredentials();
    if (!credentials) throw new Error("OpenAPI 未配置");

    const { localFilePath, targetKnowledgeBaseId, title, duplicatePolicy } = params;
    if (!fs.existsSync(localFilePath)) {
      throw new Error("本地文件不存在");
    }

    const stat = fs.statSync(localFilePath);
    const fileSize = stat.size;
    let fileName = path.basename(localFilePath);
    const { mediaType, contentType, ext } = inferMediaType(fileName);

    const api = new ImaOpenApi(credentials);
    const policy = duplicatePolicy || getDuplicatePolicy();

    // Check repeated names with policy handling
    async function checkAndResolveName(name: string): Promise<{ fileName: string; isRepeated: boolean }> {
      const repeated = await api.checkRepeatedNames(targetKnowledgeBaseId, [
        { name, media_type: mediaType },
      ]);
      return { fileName: name, isRepeated: !!repeated[0]?.is_repeated };
    }

    let nameCheck = await checkAndResolveName(fileName);

    if (nameCheck.isRepeated) {
      if (policy === "reject") {
        throw new Error(`目标知识库已存在同名文件：${fileName}。当前版本不会覆盖，请重命名后重试。`);
      }
      if (policy === "skip") {
        return { success: true, skipped: true };
      }
      if (policy === "rename") {
        fileName = renameWithTimestamp(fileName);
        // Re-check with new name; assume timestamp makes it unique
        nameCheck = await checkAndResolveName(fileName);
        if (nameCheck.isRepeated) {
          // Highly unlikely; fallback to reject
          throw new Error(`目标知识库已存在同名文件：${fileName}。自动重命名后仍冲突，请手动重命名。`);
        }
      }
    }

    const createResult = await api.createMedia({
      file_name: fileName,
      file_size: fileSize,
      content_type: contentType,
      knowledge_base_id: targetKnowledgeBaseId,
      file_ext: ext,
    });

    const cosCred = createResult.cos_credential;
    await uploadToCos({
      filePath: localFilePath,
      secretId: cosCred.secret_id,
      secretKey: cosCred.secret_key,
      token: cosCred.token,
      bucket: cosCred.bucket_name,
      region: cosCred.region,
      cosKey: cosCred.cos_key,
      contentType,
      startTime: cosCred.start_time,
      expiredTime: cosCred.expired_time,
      timeoutMs: 300_000,
    });

    await api.addKnowledge({
      media_type: mediaType,
      media_id: createResult.media_id,
      title: fileName,
      knowledge_base_id: targetKnowledgeBaseId,
      file_info: {
        cos_key: cosCred.cos_key,
        file_size: fileSize,
        file_name: fileName,
      },
    });

    return { success: true, mediaId: createResult.media_id };
  }

  ipcMain.handle("ima:syncFileToKnowledgeBase", async (_event, params: {
    localFilePath: string;
    targetKnowledgeBaseId: string;
    title: string;
  }) => {
    return syncFileToKnowledgeBase(params);
  });

  ipcMain.handle("ima:syncContentToKnowledgeBase", async (_event, params: {
    targetKnowledgeBaseId: string;
    title: string;
    mediaType: number;
    url?: string;
    localFilePath?: string;
  }) => {
    const credentials = getImaOpenApiCredentials();
    if (!credentials) throw new Error("OpenAPI 未配置");

    const { targetKnowledgeBaseId, title, mediaType, url, localFilePath } = params;
    const api = new ImaOpenApi(credentials);
    const policy = getDuplicatePolicy();

    // 链接 / 微信文章优先走 import_urls
    if ((mediaType === 2 || mediaType === 6) && url) {
      // Check duplicate names before import
      try {
        const repeated = await api.checkRepeatedNames(targetKnowledgeBaseId, [{ name: title, media_type: mediaType }]);
        if (repeated[0]?.is_repeated) {
          if (policy === "reject") {
            throw new Error(`目标知识库已存在同名内容：${title}。当前版本不会覆盖，请重命名后重试。`);
          }
          if (policy === "skip") {
            return { success: true, skipped: true };
          }
        }
      } catch (err) {
        // If the check itself fails (e.g. API doesn't support it), fall through to import
        if ((err as Error).message?.includes("目标知识库已存在")) throw err;
      }

      const importResult = await api.importUrls({ urls: [url], knowledge_base_id: targetKnowledgeBaseId });
      const first = importResult.results?.[0];
      if (first?.success) {
        return { success: true, mediaId: first.media_id };
      }
      const errMsg = first?.msg || "import_urls 失败";
      // 微信文章 fallback：如果 localFilePath 存在，尝试按文件上传
      if (mediaType === 6 && localFilePath && fs.existsSync(localFilePath)) {
        return syncFileToKnowledgeBase({ localFilePath, targetKnowledgeBaseId, title, duplicatePolicy: policy });
      }
      throw new Error(errMsg);
    }

    // 笔记或普通文件 fallback 走文件上传
    if (localFilePath) {
      if (!fs.existsSync(localFilePath)) {
        throw new Error("本地文件不存在");
      }
      return syncFileToKnowledgeBase({ localFilePath, targetKnowledgeBaseId, title, duplicatePolicy: policy });
    }

    throw new Error("无可用的同步方式：缺少 url 或 localFilePath");
  });

  // Event emitters for renderer
  const sendAccountInfo = (account: unknown) => {
    mainWindow.webContents.send("ima:accountInfoChanged", account);
  };
  const sendLoginWindowClosed = () => {
    mainWindow.webContents.send("ima:loginWindowClosed");
  };

  ipcMain.handle("ima:loadQueueState", () => {
    return loadQueueState();
  });

  ipcMain.handle("ima:saveQueueState", (_event, state: QueuePersistedState) => {
    saveQueueState(state);
  });

  ipcMain.handle("ima:clearQueueState", () => {
    clearQueueState();
  });

  onAccountInfoChanged((account) => {
    sendAccountInfo(account);
  });
  onLoginWindowClosed(() => {
    sendLoginWindowClosed();
  });
}
