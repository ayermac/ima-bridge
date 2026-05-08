import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "path";
import { createLoginWindow, closeLoginWindow, getLoginWebContents } from "./login-window";
import { setupIpcHandlers } from "./ipc";

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    titleBarStyle: "hiddenInset",
  });

  if (process.env.NODE_ENV === "development" || process.env.ELECTRON_IS_DEV === "1") {
    win.loadURL("http://localhost:5173").catch(() => {
      win.loadFile(path.join(__dirname, "../renderer/index.html"));
    });
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return win;
}

app.whenReady().then(() => {
  mainWindow = createMainWindow();
  setupIpcHandlers(mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

export { mainWindow };
