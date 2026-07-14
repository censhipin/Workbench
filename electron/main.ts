import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { spawn, ChildProcess, execFileSync } from 'child_process';
import * as path from 'path';
import * as http from 'http';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const isDev = !app.isPackaged;
const PORT = Number(process.env.PORT) || 3000;

// ── 自动更新 ──
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
  if (isDev) return;

  // 启动时不自动 check — 由渲染进程 UpdateNotifier mount 时触发
  // 以及用户在"关于"面板点击"检查更新"时触发

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('download-progress', progress.percent);
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-error', err.message);
  });

  ipcMain.on('check-for-update', () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

/** 生产环境：用 Electron 内置的 Node.js 启动 standalone server */
function startProdServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    // asar:false 模式：所有文件物理展开在 resources/app/ 下
    const serverDir = path.join(process.resourcesPath, 'app', '.next', 'standalone');
    const serverPath = path.join(serverDir, 'server.js');

    // 使用 Electron 内置的 Node.js 可执行文件（ELECTRON_RUN_AS_NODE=1 使它作为普通 Node.js 运行）
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: serverDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(PORT),
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    serverProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[next] ${data.toString().trim()}`);
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.log(`[next] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (err) => {
      console.error('[server] Failed to start:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[server] Exited with code ${code}`);
      }
    });

    // 轮询等待 Next.js 就绪
    let attempts = 0;
    const maxAttempts = 90;
    const check = () => {
      attempts++;
      const req = http.get(`http://localhost:${PORT}`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          reject(new Error(`Server not ready after ${maxAttempts} attempts`));
        } else {
          setTimeout(check, 1000);
        }
      });
      req.end();
    };
    check();
  });
}

/** 开发模式：用 npm script 启动 next dev */
function startDevServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 在 Windows 上直接调用 node_modules/.bin/next 可能有问题
    const projectRoot = app.getAppPath();
    const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

    serverProcess = spawn(process.execPath, [nextBin, 'dev', '-p', String(PORT)], {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: String(PORT),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    serverProcess.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(`[next] ${data}`);
    });
    serverProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[next] ${data}`);
    });

    let attempts = 0;
    const maxAttempts = 90;
    const check = () => {
      attempts++;
      const req = http.get(`http://localhost:${PORT}`, () => {
        req.destroy();
        resolve();
      });
      req.on('error', () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          reject(new Error(`Dev server not ready after ${maxAttempts} attempts`));
        } else {
          setTimeout(check, 1000);
        }
      });
      req.end();
    };
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  const loadApp = isDev ? startDevServer() : startProdServer();

  loadApp
    .then(() => mainWindow?.loadURL(`http://localhost:${PORT}`))
    .catch((err) => {
      console.error('Failed to start server:', err);
      mainWindow?.loadURL(`data:text/html,<h1>启动失败</h1><p>${encodeURIComponent(String(err))}</p>`);
    });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
