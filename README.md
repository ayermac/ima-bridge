# IMA Bridge

**IMA Knowledge Base Desktop Client**

[English](README.md) | [中文](README.zh-CN.md)

[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

Browse, download, and sync IMA (ima.qq.com) knowledge base content locally. Pure client-side tool — all requests go directly to IMA servers, no third-party backend.

[Quick Start](#quick-start) | [Architecture](#architecture) | [Features](#features) | [Usage](#usage) | [Build](#build)

---

## Features

- **WebView QR Login** — Embedded WebView auto-probes localStorage for credentials, polls page signals (scan success, authorization, expiry) with manual login fallback
- **Knowledge Bases** — Browse personal, created, and joined knowledge bases with cover logos
- **Folder Navigation** — Paginated browsing for large folders, breadcrumb navigation
- **Multi-Type Export** — PDF, images, documents, slides, audio, video, spreadsheets, links, WeChat articles, notebooks
- **Self-Contained HTML** — WeChat articles export with all images base64-inlined, external CSS inlined
- **Notebook Export** — Notes as Markdown or styled HTML with embedded images
- **OpenAPI Sync** — Upload local files to IMA knowledge bases via OpenAPI (requires credentials)
- **Queue Persistence** — Download/sync queue survives app restarts with 45s watchdog auto-reset on timeout
- **Duplicate Policy** — Reject, auto-rename, or skip on name conflicts during sync
- **Settings Panel** — Configure OpenAPI credentials in-app, no `.env` editing required
- **API Log Viewer** — Real-time request/response log panel for debugging and monitoring
- **Encrypted Credentials** — OpenAPI credentials encrypted at rest in settings store

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Renderer (React)                │
│  App │ DocumentList │ DownloadQueue │ Settings   │
└──────────────────────┬──────────────────────────┘
                       │ IPC (contextBridge)
┌──────────────────────┴──────────────────────────┐
│                 Main Process (Electron)          │
│  IPC Handlers │ Login Window (WebView+Probe) │ Queue Store │
│  Download (binary) │ COS Upload │ File I/O       │
│  Settings Store (encrypted) │ API Log Collector  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│                  Core Layer                      │
│  ImaWebApi │ Exporters │ Types │ Auth            │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
   ima.qq.com APIs          IMA OpenAPI
   (Web session)            (Client credentials)
```

| Layer | Components | Purpose |
|-------|-----------|---------|
| Renderer | React components, hooks | UI, queue management, settings |
| IPC | `contextBridge`, preload | Secure renderer ↔ main communication |
| Main | IPC handlers, file I/O, COS upload, settings store | Download, export, sync orchestration, encrypted credential persistence |
| Core | `ImaWebApi`, exporters, types | API calls, HTML/MD generation, auth headers |
| Exporters | `note-exporter`, `wechat-exporter` | Self-contained HTML with base64 images |

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
git clone git@github.com:ayermac/ima-bridge.git
cd ima-bridge
npm install
```

### Development

```bash
npm run dev
```

Opens the Electron app with DevTools loaded.

### Test

```bash
npm run test:run
```

## Usage

1. Click **"扫码登录"** — an embedded WebView opens IMA login page, auto-detects scan success and credential storage; if auto-detection fails, use the manual login button
2. Browse knowledge bases, click to enter one
3. Select files:
   - **Download** — Save to local directory
   - **Sync** — Configure OpenAPI credentials first, pick a target knowledge base, click "同步"
4. Queue panel shows real-time progress with retry and clear controls; a 45s watchdog auto-resets stuck items
5. **Logs** tab shows real-time API request/response entries for debugging

## Modules

### Exporters

**Note Export** — JSON content blocks to styled HTML or Markdown:

```ts
import { notebookContentToHtml } from "@core/exporters/note-exporter";

const html = await notebookContentToHtml(content, title, linkMap, downloadBinary);
// → Self-contained HTML with base64-inlined images
```

**WeChat Article Export** — Fetch, parse DOM, inline all resources:

```ts
import { buildWechatHtml } from "@core/exporters/wechat-exporter";

const html = await buildWechatHtml(url, title, fetchImpl, downloadBinary);
// → Fully self-contained HTML (images + CSS inlined)
```

### IMA Web API

```ts
import { ImaWebApi } from "@core/ima-web-api";

const api = new ImaWebApi(account, fetchImpl, downloadBinary);
const bases = await api.listKnowledgeBases();
const page = await api.listFolder(knowledgeBaseId, folderId);
const exported = await api.exportNote(mediaId, "html");
```

### OpenAPI Sync

```ts
import { ImaOpenApi } from "@core/ima-open-api";

const api = new ImaOpenApi({ clientId, apiKey });
const result = await api.createMedia({ file_name, file_size, content_type, knowledge_base_id });
await uploadToCos({ filePath, ...result.cos_credential });
await api.addKnowledge({ media_id, knowledge_base_id, title });
```

## Project Structure

```
ima-bridge/
├── src/
│   ├── core/               # Business logic, API clients, types
│   │   ├── exporters/      #   Note & WeChat HTML/MD generators
│   │   ├── ima-web-api.ts  #   IMA Web API client
│   │   ├── ima-open-api.ts #   IMA OpenAPI client (sync/upload)
│   │   └── types.ts        #   Shared type definitions
│   ├── main/               # Electron main process
│   │   ├── ipc.ts          #   IPC handlers (download, fetch, sync, logs)
│   │   ├── login-window.ts #   WebView QR login with storage probing & polling
│   │   ├── cos-upload.ts   #   Tencent Cloud COS upload
│   │   └── settings-store.ts # Encrypted credential persistence
│   ├── preload/            # Context bridge (secure IPC exposure)
│   ├── renderer/           # React UI
│   │   ├── src/
│   │   │   ├── components/ #   DocumentList, DownloadQueue, Settings...
│   │   │   ├── hooks/      #   useIpc, useRuntime
│   │   │   └── App.tsx
│   │   └── src/styles/     #   CSS design tokens & layout
│   └── runtime/            # Adapter types for cross-platform
├── tests/                  # Vitest unit tests
└── electron-builder.yml    # Build config
```

## Build

### Current Platform

```bash
npm run build
npm run pack              # Unpacked app directory (debug)
npm run dist              # Installer (DMG / EXE)
```

### macOS

```bash
npm run dist:mac
# → release/IMA Bridge-x.x.x.dmg
# → release/IMA Bridge-x.x.x-mac.zip
```

### Windows

```bash
npm run dist:win
# → release/IMA Bridge Setup x.x.x.exe
```

> Cross-building Windows on macOS requires Wine + Mono, or use CI/CD.

### Security Note

Builds are **unsigned**. On first launch:
- **macOS**: System Settings → Privacy & Security → "Open Anyway"
- **Windows**: SmartScreen → "More info" → "Run anyway"

## OpenAPI Configuration

Two methods, priority from high to low:

1. **Settings Panel** (recommended) — Enter Client ID and API Key in-app, saves encrypted to disk immediately
2. **Environment variable fallback** — Copy `.env.example` to `.env` and fill in credentials

## Known Limitations

- **Link/WeChat duplicate detection** — `import_urls` API cannot reliably check duplicates; policy only applies to file upload path
- **Full KB sync** — "Sync all" requires manual page-by-page trigger, no background recursive scan yet
- **Credential storage** — Encrypted at rest in `userData/settings.json`, not yet using system keychain

## License

UNLICENSED

---

> This project is not officially affiliated with Tencent IMA. Third-party tool only.
