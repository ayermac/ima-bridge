import http from "http";
import type { BrowserWindow } from "electron";
import { saveAccountInfo } from "./settings-store";
import type { ImaAccountInfo } from "../core/types";

function isValidAccountInfo(v: unknown): v is ImaAccountInfo {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.guid === "string" && obj.guid.length > 0
    && typeof obj.token === "string" && obj.token.length > 0
    && typeof obj.refreshToken === "string" && obj.refreshToken.length > 0
    && typeof obj.uid === "string" && obj.uid.length > 0;
}

export function startLoginServer(mainWindow: BrowserWindow): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === "POST" && req.url === "/login") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            const rawInfo = parsed.accountInfo ?? parsed;
            if (!isValidAccountInfo(rawInfo)) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: false, error: "accountInfo 字段不完整" }));
              return;
            }
            const guid = String(rawInfo.guid);
            const guidPart = guid.includes("-") ? guid.split("-")[1] : guid;
            const info: ImaAccountInfo = {
              guid: guidPart,
              token: String(rawInfo.token),
              refreshToken: String(rawInfo.refreshToken),
              uid: String(rawInfo.uid),
            };
            saveAccountInfo(info);
            mainWindow.webContents.send("ima:accountInfoChanged", info);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, uid: info.uid }));
            setTimeout(() => { server.close(); }, 5000);
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "JSON 解析失败" }));
          }
        });
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Not Found" }));
    });

    const timeout = setTimeout(() => { server.close(); }, 10 * 60 * 1000);
    server.on("close", () => { clearTimeout(timeout); });
    server.on("error", (err) => { reject(err); });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (typeof addr === "object" && addr) {
        resolve(addr.port);
      } else {
        reject(new Error("无法获取服务器端口"));
      }
    });
  });
}
