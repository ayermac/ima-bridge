function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlDocument(title: string, bodyHtml: string, sourceUrl = ""): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${sourceUrl ? `<base href="${escapeHtml(sourceUrl)}">` : ""}
  <title>${escapeHtml(title)}</title>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export async function buildWechatHtml(url: string, title: string, fetchImpl?: typeof fetch): Promise<string> {
  const f = fetchImpl || fetch;
  const response = await f(url, {
    credentials: "omit",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`微信文章抓取失败：HTTP ${response.status}`);

  const raw = await response.text();
  const parser = new DOMParser();
  const parsed = parser.parseFromString(raw, "text/html");
  const article = parsed.querySelector("#js_content") || parsed.querySelector(".rich_media_content") || parsed.body;
  const styles = Array.from(parsed.querySelectorAll("style"))
    .map((style) => (style as HTMLStyleElement).textContent || "")
    .join("\n");
  const body = article ? article.innerHTML : raw;

  return htmlDocument(title, `<style>${styles}</style>\n<article>${body}</article>`, url);
}
