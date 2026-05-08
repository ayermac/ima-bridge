function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkFromMap(url: string, linkMap?: Record<string, string>): string {
  if (!url || !linkMap) return url;
  const clean = url.split("?")[0];
  return linkMap[clean] || linkMap[url] || url;
}

function parseNotebookContent(content: unknown): unknown[] {
  if (typeof content !== "string") return Array.isArray(content) ? content : [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderInlineHtml(children: unknown[] = [], linkMap?: Record<string, string>): string {
  return children
    .map((child: unknown) => {
      const c = child as Record<string, unknown>;
      if (c.type === "cloud_image" && c.url) {
        const src = escapeHtml(linkFromMap(String(c.url), linkMap));
        const width = (c.width || c.maxWidth) as number | undefined;
        const height = (c.height || c.maxHeight) as number | undefined;
        const size = width
          ? ` width="${escapeHtml(width)}"${height ? ` height="${escapeHtml(height)}"` : ""}`
          : "";
        return `<figure><img src="${src}"${size} alt="image"><figcaption></figcaption></figure>`;
      }
      if (c.type === "link" && c.url) {
        const href = escapeHtml(linkFromMap(String(c.url), linkMap));
        const text = escapeHtml(String(c.text || c.url));
        return `<a href="${href}">${text}</a>`;
      }
      let text = escapeHtml(String(c.text ?? "")).replace(/\n/g, "<br>");
      if (!text) return "";
      if (c.bold) text = `<strong>${text}</strong>`;
      if (c.italic) text = `<em>${text}</em>`;
      if (c.underline) text = `<u>${text}</u>`;
      if (c.strike || c.strikethrough) text = `<s>${text}</s>`;
      if (c.url || c.href) {
        const href = escapeHtml(linkFromMap(String(c.url || c.href), linkMap));
        text = `<a href="${href}">${text}</a>`;
      }
      return text;
    })
    .join("");
}

function blockTag(type: string): string {
  return /^h[1-6]$/.test(type) ? type : "p";
}

export function notebookContentToHtml(content: unknown, title: string, linkMap?: Record<string, string>): string {
  const blocks = parseNotebookContent(content);
  if (blocks.length === 0) {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><pre>${escapeHtml(content)}</pre></body></html>`;
  }

  const html: string[] = [];
  let list: { type: string; indent: number; items: string[] } | null = null;
  const closeList = () => {
    if (!list) return;
    const margin = list.indent > 1 ? ` style="margin-left:${(list.indent - 1) * 1.5}em"` : "";
    html.push(`<${list.type}${margin}>${list.items.join("")}</${list.type}>`);
    list = null;
  };

  for (const block of blocks) {
    const b = block as Record<string, unknown>;
    const body = renderInlineHtml((b.children as unknown[]) || [], linkMap);
    if (!body && !b.listStyleType) {
      closeList();
      continue;
    }

    if (b.listStyleType) {
      const type = b.listStyleType === "decimal" ? "ol" : "ul";
      const indent = (b.indent as number) ?? 1;
      if (list && (list.type !== type || list.indent !== indent)) closeList();
      if (!list) list = { type, indent, items: [] };
      list.items.push(`<li>${body || "&nbsp;"}</li>`);
      continue;
    }

    closeList();
    const tag = blockTag(String(b.type));
    const margin = b.indent ? ` style="margin-left:${(b.indent as number) * 1.5}em"` : "";
    html.push(`<${tag}${margin}>${body || "&nbsp;"}</${tag}>`);
  }

  closeList();

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      padding: 40px 18px;
      background: #f6f7f9;
      color: #1f2937;
      font: 16px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      max-width: 860px;
      margin: 0 auto;
      padding: 42px 50px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: white;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }
    h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.4em 0 0.65em; color: #111827; }
    h1:first-child { margin-top: 0; }
    p { margin: 0.8em 0; }
    ul, ol { margin: 0.8em 0 0.8em 1.4em; padding: 0; }
    li { margin: 0.3em 0; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    figure { margin: 18px 0; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    @media print {
      body { padding: 0; background: white; }
      main { max-width: none; border: 0; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    ${html.join("\n")}
  </main>
</body>
</html>`;
}

function renderInlineMarkdown(children: unknown[] = [], linkMap?: Record<string, string>): string {
  return children
    .map((child: unknown) => {
      const c = child as Record<string, unknown>;
      if (c.type === "cloud_image" && c.url) {
        return `![image](${linkFromMap(String(c.url), linkMap)})`;
      }
      let text = String(c.text ?? "");
      if (!text && c.url) text = String(c.url);
      if (!text) return "";
      if (c.bold) text = `**${text}**`;
      if (c.italic) text = `*${text}*`;
      if (c.url || c.href) text = `[${text}](${linkFromMap(String(c.url || c.href), linkMap)})`;
      return text;
    })
    .join("");
}

export function notebookContentToMarkdown(content: unknown, title: string, linkMap?: Record<string, string>): string {
  const blocks = parseNotebookContent(content);
  if (blocks.length === 0) return `# ${title}\n\n${content}\n`;

  return [
    `# ${title}`,
    "",
    ...blocks.map((block: unknown) => {
      const b = block as Record<string, unknown>;
      const body = renderInlineMarkdown((b.children as unknown[]) || [], linkMap);
      if (b.listStyleType === "decimal") return `1. ${body}`;
      if (b.listStyleType) return `- ${body}`;
      if (/^h[1-6]$/.test(String(b.type))) return `${"#".repeat(Number(String(b.type).slice(1)))} ${body}`;
      return body;
    }),
  ].join("\n\n");
}
