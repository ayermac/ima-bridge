# IMA Bridge

**IMA 知识库桌面客户端**

[English](README.md) | [中文](README.zh-CN.md)

[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

本地浏览、下载和同步 IMA (ima.qq.com) 知识库内容。纯客户端工具，所有请求直达 IMA 服务器，无第三方后端。

[快速开始](#快速开始) | [架构](#架构) | [功能特性](#功能特性) | [使用方法](#使用方法) | [构建](#构建)

---

## 功能特性

- **一键登录** — 启动本地 HTTP 服务器，在 ima.qq.com DevTools 控制台粘贴一行 JS 脚本即可自动传递凭证；也支持手动粘贴 JSON 登录
- **知识库浏览** — 浏览个人、创建和加入的知识库，展示封面 Logo
- **文件夹导航** — 大型文件夹分页浏览，面包屑导航
- **多格式导出** — PDF、图片、文档、幻灯片、音频、视频、表格、链接、微信文章、笔记
- **自包含 HTML** — 微信文章导出时所有图片 Base64 内联，外部 CSS 内联
- **笔记导出** — 笔记导出为 Markdown 或带样式的 HTML，图片内嵌
- **OpenAPI 同步** — 通过 OpenAPI 将本地文件上传至 IMA 知识库（需配置凭证）
- **队列持久化** — 下载/同步队列在应用重启后保留，45 秒看门狗超时自动重置
- **去重策略** — 同步时文件名冲突可选拒绝、自动重命名或跳过
- **设置面板** — 应用内配置 OpenAPI 凭证，无需编辑 `.env` 文件
- **API 日志查看器** — 实时请求/响应日志面板，便于调试和监控
- **凭证加密存储** — OpenAPI 凭证在设置存储中加密保存

## 架构

```
┌─────────────────────────────────────────────────┐
│                  渲染进程 (React)                │
│  App │ DocumentList │ DownloadQueue │ Settings   │
└──────────────────────┬──────────────────────────┘
                       │ IPC (contextBridge)
┌──────────────────────┴──────────────────────────┐
│                 主进程 (Electron)                │
│  IPC 处理 │ 登录服务器 (HTTP) │ 队列存储    │
│  下载 (二进制) │ COS 上传 │ 文件 I/O            │
│  设置存储 (加密) │ API 日志收集器               │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│                  核心层                          │
│  ImaWebApi │ 导出器 │ 类型定义 │ 认证           │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
   ima.qq.com API            IMA OpenAPI
   (Web 会话)               (客户端凭证)
```

| 层级 | 组件 | 用途 |
|------|------|------|
| 渲染层 | React 组件、Hooks | UI、队列管理、设置 |
| IPC | `contextBridge`、preload | 安全的渲染进程 ↔ 主进程通信 |
| 主层 | IPC 处理、文件 I/O、COS 上传、设置存储 | 下载、导出、同步编排、凭证加密持久化 |
| 核心层 | `ImaWebApi`、导出器、类型定义 | API 调用、HTML/MD 生成、认证头 |
| 导出器 | `note-exporter`、`wechat-exporter` | 自包含 HTML（Base64 图片内联） |

## 快速开始

### 环境要求

- Node.js 18+
- npm

### 安装

```bash
git clone git@github.com:ayermac/ima-bridge.git
cd ima-bridge
npm install
```

### 开发

```bash
npm run dev
```

启动 Electron 应用并加载 DevTools。

### 测试

```bash
npm run test:run
```

## 使用方法

1. 点击 **"一键登录"** — 启动本地 HTTP 服务器，在 ima.qq.com DevTools 控制台粘贴显示的 JS 脚本（Chrome 需先输入 `allow pasting`）即可自动传递凭证；也可手动粘贴 accountInfo JSON
2. 浏览知识库，点击进入
3. 选择文件：
   - **下载** — 保存到本地目录
   - **同步** — 先配置 OpenAPI 凭证，选择目标知识库，点击"同步"
4. 队列面板实时显示进度，支持重试和清空控制；45 秒看门狗自动重置卡住的任务
5. **日志** 标签页实时显示 API 请求/响应条目，便于调试

## 模块说明

### 导出器

**笔记导出** — JSON 内容块转为带样式的 HTML 或 Markdown：

```ts
import { notebookContentToHtml } from "@core/exporters/note-exporter";

const html = await notebookContentToHtml(content, title, linkMap, downloadBinary);
// → 自包含 HTML，图片 Base64 内联
```

**微信文章导出** — 抓取页面、解析 DOM、内联所有资源：

```ts
import { buildWechatHtml } from "@core/exporters/wechat-exporter";

const html = await buildWechatHtml(url, title, fetchImpl, downloadBinary);
// → 完全自包含 HTML（图片 + CSS 内联）
```

### IMA Web API

```ts
import { ImaWebApi } from "@core/ima-web-api";

const api = new ImaWebApi(account, fetchImpl, downloadBinary);
const bases = await api.listKnowledgeBases();
const page = await api.listFolder(knowledgeBaseId, folderId);
const exported = await api.exportNote(mediaId, "html");
```

### OpenAPI 同步

```ts
import { ImaOpenApi } from "@core/ima-open-api";

const api = new ImaOpenApi({ clientId, apiKey });
const result = await api.createMedia({ file_name, file_size, content_type, knowledge_base_id });
await uploadToCos({ filePath, ...result.cos_credential });
await api.addKnowledge({ media_id, knowledge_base_id, title });
```

## 项目结构

```
ima-bridge/
├── src/
│   ├── core/               # 业务逻辑、API 客户端、类型定义
│   │   ├── exporters/      #   笔记 & 微信 HTML/MD 生成器
│   │   ├── ima-web-api.ts  #   IMA Web API 客户端
│   │   ├── ima-open-api.ts #   IMA OpenAPI 客户端（同步/上传）
│   │   └── types.ts        #   共享类型定义
│   ├── main/               # Electron 主进程
│   │   ├── ipc.ts          #   IPC 处理（下载、抓取、同步、日志）
│   │   ├── login-window.ts #   WebView 扫码登录（存储探测 + 轮询）
│   │   ├── cos-upload.ts   #   腾讯云 COS 上传
│   │   └── settings-store.ts # 凭证加密持久化
│   ├── preload/            # 上下文桥接（安全 IPC 暴露）
│   ├── renderer/           # React UI
│   │   ├── src/
│   │   │   ├── components/ #   DocumentList、DownloadQueue、Settings 等
│   │   │   ├── hooks/      #   useIpc、useRuntime
│   │   │   └── App.tsx
│   │   └── src/styles/     #   CSS 设计令牌 & 布局
│   └── runtime/            # 跨平台适配器类型
├── tests/                  # Vitest 单元测试
└── electron-builder.yml    # 构建配置
```

## 构建

### 当前平台

```bash
npm run build
npm run pack              # 未打包应用目录（调试用）
npm run dist              # 安装包（DMG / EXE）
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

> 在 macOS 上交叉编译 Windows 需要 Wine + Mono，或使用 CI/CD。

### 安全说明

构建产物**未签名**。首次启动时：
- **macOS**：系统设置 → 隐私与安全性 → "仍要打开"
- **Windows**：SmartScreen → "更多信息" → "仍要运行"

## OpenAPI 配置

两种方式，优先级从高到低：

1. **设置面板**（推荐）— 在应用内输入 Client ID 和 API Key，加密保存到磁盘
2. **环境变量回退** — 复制 `.env.example` 为 `.env` 并填入凭证

## 已知限制

- **链接/微信去重检测** — `import_urls` API 无法可靠检测重复项，去重策略仅适用于文件上传路径
- **全量知识库同步** — "同步全部"需手动逐页触发，暂不支持后台递归扫描
- **凭证存储** — 加密存储于 `userData/settings.json`，尚未使用系统钥匙串

## 许可证

UNLICENSED

---

> 本项目与腾讯 IMA 无官方关联，仅为第三方工具。
