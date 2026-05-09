type DownloadBinaryFn = (url: string) => Promise<{ base64: string; contentType: string }>;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function isWechatImage(url: string): boolean {
  return url.includes("mmbiz.qpic.cn");
}

function extractAllImageUrls(doc: Document): string[] {
  const urls = new Set<string>();

  const addUrl = (raw: string | null) => {
    if (!raw || !raw.includes("mmbiz.qpic.cn")) return;
    const clean = raw.replace(/#.*$/, "");
    if (clean) urls.add(clean);
  };

  doc.querySelectorAll("img").forEach((img) => {
    const dataSrc = img.getAttribute("data-src");
    const croporisrc = img.getAttribute("data-croporisrc");
    const src = img.getAttribute("src") || "";
    const isEmptySrc = !src || src.startsWith("data:image/svg");

    if (dataSrc && isWechatImage(dataSrc)) {
      img.setAttribute("src", normalizeImageUrl(dataSrc));
    } else if (isEmptySrc && croporisrc && isWechatImage(croporisrc)) {
      img.setAttribute("src", normalizeImageUrl(croporisrc));
    }

    addUrl(img.getAttribute("src"));
    addUrl(dataSrc);
    addUrl(croporisrc);

    img.removeAttribute("data-src");
    img.removeAttribute("data-croporisrc");
  });

  const bgRegex = /url\(["']?(https?:\/\/mmbiz\.qpic\.cn[^"')]+)["']?\)/g;
  doc.querySelectorAll("[style]").forEach((el) => {
    const style = el.getAttribute("style") || "";
    for (const match of style.matchAll(bgRegex)) {
      addUrl(match[1]);
    }
  });

  doc.querySelectorAll("[data-background]").forEach((el) => {
    addUrl(el.getAttribute("data-background"));
  });

  return [...urls];
}

function extractCssUrls(doc: Document): string[] {
  const urls: string[] = [];
  doc.querySelectorAll("link[rel='stylesheet']").forEach((link) => {
    let href = link.getAttribute("href");
    if (!href) return;
    if (href.startsWith("//")) href = `https:${href}`;
    if (href.startsWith("https://")) urls.push(href);
  });
  return urls;
}

async function inlineCss(
  cssUrls: string[],
  html: string,
  fetchImpl: typeof fetch
): Promise<string> {
  if (cssUrls.length === 0) return html;

  let result = html;
  for (const url of cssUrls) {
    try {
      const resp = await fetchImpl(url);
      if (!resp.ok) continue;
      let css = await resp.text();
      css = css.replace(/url\(["']?\/\//g, 'url("https://');
      const tag = `<style>/* ${url.split("/").pop()} */\n${css}</style>`;
      const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(
        new RegExp(`<link[^>]*href=["']${escaped}["'][^>]*>`, "gi"),
        tag
      );
    } catch {
      // CSS download failed, keep original <link>
    }
  }
  return result;
}

async function downloadImagesAsDataUris(
  imageUrls: string[],
  downloadBinary: DownloadBinaryFn,
  concurrency = 5
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (let i = 0; i < imageUrls.length; i += concurrency) {
    const batch = imageUrls.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          const result = await downloadBinary(url);
          const dataUri = `data:${result.contentType};base64,${result.base64}`;
          return [url, dataUri] as const;
        } catch {
          return [url, null] as const;
        }
      })
    );
    for (const [url, dataUri] of results) {
      if (dataUri) map.set(url, dataUri);
    }
  }

  return map;
}

function replaceImageUrls(html: string, imageMap: Map<string, string>): string {
  let result = html;
  for (const [originalUrl, dataUri] of imageMap) {
    result = result.split(originalUrl).join(dataUri);
    const ampUrl = originalUrl.replace(/&/g, "&amp;");
    if (ampUrl !== originalUrl) {
      result = result.split(ampUrl).join(dataUri);
    }
  }
  return result;
}

function fixProtocolRelativeUrls(html: string): string {
  return html.replace(/(src|href)="\/\//g, '$1="https://');
}

export async function buildWechatHtml(
  url: string,
  title: string,
  fetchImpl?: typeof fetch,
  downloadBinary?: DownloadBinaryFn
): Promise<string> {
  const f = fetchImpl || fetch;

  const response = await f(url, {
    credentials: "omit",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error(`微信文章抓取失败：HTTP ${response.status}`);

  const raw = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");

  const titleText =
    doc.querySelector("#activity-name")?.textContent?.trim() ||
    doc.querySelector("title")?.textContent?.trim() ||
    title;

  const content = doc.querySelector("#js_content");
  if (content) {
    content.removeAttribute("style");
    (content as HTMLElement).style.visibility = "visible";
    (content as HTMLElement).style.display = "block";
  }

  const imageUrls = extractAllImageUrls(doc);
  const cssUrls = extractCssUrls(doc);

  let html = fixProtocolRelativeUrls(doc.documentElement.outerHTML);
  html = `<!DOCTYPE html>${html}`;

  html = await inlineCss(cssUrls, html, f);

  if (downloadBinary && imageUrls.length > 0) {
    const imageMap = await downloadImagesAsDataUris(imageUrls, downloadBinary);
    html = replaceImageUrls(html, imageMap);
  }

  return html;
}
