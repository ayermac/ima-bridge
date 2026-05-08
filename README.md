# IMA Bridge

IMA Bridge 是一个本地桌面客户端，用于浏览、下载和同步腾讯 IMA（ima.qq.com）知识库内容。

## 项目简介

本项目是**纯本地工具**，只使用用户自己的 IMA 登录态和 OpenAPI 凭证，**不提供任何第三方后台服务**。所有网络请求均直接发往 `ima.qq.com` 官方域名。

## 当前功能

- **扫码登录**：通过官方 IMA 网页完成登录，无需手动输入账号密码。
- **浏览知识库**：列出个人、创建和加入的知识库。
- **分页浏览文件夹**：支持逐页加载大文件夹，不阻塞浏览。
- **下载/导出**：支持 PDF、图片、文档、幻灯片、音频、视频、表格、链接、微信文章、笔记等多种类型。
- **OpenAPI 同步**：将本地内容同步到个人知识库（需配置 IMA OpenAPI 凭证）。
- **内容类型扩展**：链接（`import_urls`）、微信文章（HTML 导出）、笔记（MD/HTML 导出）。
- **队列持久化**：下载/同步队列支持持久化，重启后可恢复并继续。
- **设置面板**：在应用内安全配置 OpenAPI 凭证，无需手动编辑 `.env`。
- **重名策略**：同步时遇到同名文件可选择「拒绝」「自动重命名」或「跳过」。
- **v0.3 视觉升级**：Mascot 状态组件、Loading / Empty / Success / Error 状态反馈、全局视觉层级与响应式优化。

## 安全说明

- **凭证存储**：OpenAPI 凭证保存在本地 `userData/settings.json`，当前为明文存储（后续可考虑升级系统钥匙串）。
- **不泄露密钥**：渲染进程（UI）永远不会收到完整的 API Key，仅展示 `clientIdPreview`（前 4 位 + 后 4 位，中间隐藏）。
- **不提交凭证**：`.env` 和 `.env.local` 已加入 `.gitignore`，不会被提交到仓库。
- **无第三方后台**：所有请求直接发往 IMA 官方服务器，本项目不架设任何中转服务。

## 安装依赖

```bash
npm install
```

## 开发启动

```bash
npm run dev
```

启动后应用窗口会自动打开，并加载 DevTools。

## 构建

```bash
npm run build
```

构建产物输出到 `out/` 目录（main、preload、renderer 三个子目录）。

## OpenAPI 设置方式

应用提供两种配置方式，优先级从高到低：

1. **设置面板（推荐）**：点击顶部「设置」按钮，在弹窗中输入 Client ID 和 API Key，保存后立即生效，无需重启。
2. **环境变量 fallback**：复制 `.env.example` 为 `.env` 并填写凭证，或在 shell 中设置环境变量。

```bash
cp .env.example .env
# 编辑 .env 填入你的凭证
```

## 使用流程

1. 启动应用后点击「扫码登录」，在弹出窗口中完成 IMA 登录。
2. 浏览知识库列表，点击进入某个知识库。
3. 在文件夹中选择文件：
   - **下载**：直接下载到本地目录。
   - **同步**：先配置 OpenAPI 凭证，选择目标知识库，点击「同步选中」或「同步全部」。
4. 队列面板实时显示下载/同步进度，支持重试和清除已完成项。

## 已知限制

- **链接/微信文章重名策略**：`import_urls` 接口无法可靠检查重名，重名策略仅对文件上传路径生效；fallback 文件上传时仍会应用策略。
- **全库同步**：当前「同步全部」需要手动逐页触发，暂不支持后台自动递归扫描整个知识库。
- **凭证存储**：当前为本地明文 JSON，未使用系统钥匙串或加密存储。
- **平台**：目前基于 Electron，后续可能评估 Tauri 迁移。

## 打包发布

> 当前打包产物**未进行代码签名**。macOS 和 Windows 可能会在首次运行时提示安全警告，用户需要手动允许运行。

### 先决条件

确保已运行 `npm install` 安装依赖（包含 `electron-builder`）。

### 打包当前平台

```bash
npm run build
npm run pack
```

`pack` 会生成未封装的 app 目录（方便调试），输出到 `release/mac` 或 `release/win-unpacked`。

### 构建 macOS 安装包

```bash
npm run dist:mac
```

产物：
- `release/IMA Bridge-0.3.3.dmg` — 标准安装包
- `release/IMA Bridge-0.3.3-mac.zip` — 便携压缩包

### 构建 Windows 安装包

```bash
npm run dist:win
```

产物：
- `release/IMA Bridge Setup 0.3.3.exe` — 安装向导
- `release/IMA Bridge 0.3.3.exe` — 便携版

> 在 macOS 上构建 Windows 安装包需要安装 Wine 和 Mono，或使用 CI/CD（GitHub Actions 等）。如环境不支持，请在 Windows 机器上执行 `npm run dist:win`。

### 完整发布（当前平台 + 通用）

```bash
npm run dist
```

### 安全提示

由于未签名：
- **macOS**：首次打开可能提示「无法验证开发者」。请前往「系统设置 → 隐私与安全性」点击「仍要打开」。
- **Windows**：SmartScreen 可能拦截，点击「更多信息」→「仍要运行」。

## License

UNLICENSED

---

> 本项目与腾讯 IMA 官方无直接关联，仅为第三方工具。
