import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";

function hmacSha1(key: string, data: string): string {
  return crypto.createHmac("sha1", key).update(data).digest("hex");
}

function sha1(data: string): string {
  return crypto.createHash("sha1").update(data).digest("hex");
}

function buildAuthorization(params: {
  secretId: string;
  secretKey: string;
  method: string;
  pathname: string;
  headers: Record<string, string>;
  startTime: string;
  expiredTime: string;
}): string {
  const { secretId, secretKey, method, pathname, headers, startTime, expiredTime } = params;
  const keyTime = `${startTime};${expiredTime}`;
  const signKey = hmacSha1(secretKey, keyTime);
  const headerKeys = Object.keys(headers).sort();
  const httpHeaders = headerKeys.map((k) => `${k.toLowerCase()}=${encodeURIComponent(headers[k])}`).join("&");
  const httpString = `${method.toLowerCase()}\n${pathname}\n\n${httpHeaders}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`;
  const signature = hmacSha1(signKey, stringToSign);
  const headerList = headerKeys.map((k) => k.toLowerCase()).join(";");
  return [
    `q-sign-algorithm=sha1`,
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${headerList}`,
    `q-url-param-list=`,
    `q-signature=${signature}`,
  ].join("&");
}

export type CosUploadOptions = {
  filePath: string;
  secretId: string;
  secretKey: string;
  token: string;
  bucket: string;
  region: string;
  cosKey: string;
  contentType?: string;
  startTime?: string;
  expiredTime?: string;
  timeoutMs?: number;
};

export function uploadToCos(options: CosUploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const {
      filePath,
      secretId,
      secretKey,
      token,
      bucket,
      region,
      cosKey,
      contentType = "application/octet-stream",
      startTime = String(Math.floor(Date.now() / 1000)),
      expiredTime = String(Math.floor(Date.now() / 1000) + 3600),
      timeoutMs = 300_000,
    } = options;

    const fileContent = fs.readFileSync(filePath);
    const hostname = `${bucket}.cos.${region}.myqcloud.com`;
    const pathname = `/${cosKey}`;

    const signHeaders: Record<string, string> = {
      "content-length": String(fileContent.length),
      host: hostname,
    };

    const authorization = buildAuthorization({
      secretId,
      secretKey,
      method: "PUT",
      pathname,
      headers: signHeaders,
      startTime,
      expiredTime,
    });

    const req = https.request(
      {
        hostname,
        port: 443,
        path: pathname,
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "Content-Length": fileContent.length,
          Authorization: authorization,
          "x-cos-security-token": token,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = "";
        let settled = false;
        res.setEncoding("utf8");

        const finish = (err?: Error) => {
          if (settled) return;
          settled = true;
          if (err) reject(err);
        };

        res.on("data", (chunk: string) => {
          body += chunk;
        });
        res.on("end", () => {
          if (settled) return;
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            settled = true;
            resolve();
          } else {
            finish(new Error(`COS 上传失败 HTTP ${res.statusCode}: ${body.slice(0, 500)}`));
          }
        });
        res.on("aborted", () => {
          finish(new Error("COS 上传连接被中断"));
        });
        res.on("error", (err) => {
          finish(new Error(`COS 上传响应错误: ${err.message}`));
        });
        res.on("close", () => {
          if (!settled) {
            finish(new Error("COS 上传连接意外关闭"));
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("COS 上传超时"));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(fileContent);
    req.end();
  });
}
