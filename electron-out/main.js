"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const http = __importStar(require("http"));
let mainWindow = null;
let serverProcess = null;
const isDev = !electron_1.app.isPackaged;
const PORT = Number(process.env.PORT) || 3000;
// ── 自动更新 ──
electron_updater_1.autoUpdater.autoDownload = false;
electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
function setupAutoUpdater() {
    if (isDev)
        return;
    // 启动时不自动 check — 由渲染进程 UpdateNotifier mount 时触发
    // 以及用户在"关于"面板点击"检查更新"时触发
    // 强制使用 GitHub API 下载，绕过 github.com 直链被墙问题
    electron_updater_1.autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'censhipin',
        repo: 'Workbench',
        host: 'api.github.com',
    });
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        mainWindow?.webContents.send('update-available', info.version);
    });
    electron_updater_1.autoUpdater.on('update-not-available', () => {
        mainWindow?.webContents.send('update-not-available');
    });
    electron_updater_1.autoUpdater.on('download-progress', (progress) => {
        mainWindow?.webContents.send('download-progress', progress.percent);
    });
    electron_updater_1.autoUpdater.on('update-downloaded', () => {
        mainWindow?.webContents.send('update-downloaded');
    });
    electron_updater_1.autoUpdater.on('error', (err) => {
        mainWindow?.webContents.send('update-error', err.message);
    });
    electron_1.ipcMain.on('check-for-update', () => {
        electron_updater_1.autoUpdater.checkForUpdates();
    });
    electron_1.ipcMain.on('download-update', () => {
        electron_updater_1.autoUpdater.downloadUpdate();
    });
    electron_1.ipcMain.on('install-update', () => {
        electron_updater_1.autoUpdater.quitAndInstall(true, true);
    });
}
/** 生产环境：用 Electron 内置的 Node.js 启动 standalone server */
function startProdServer() {
    return new Promise((resolve, reject) => {
        // asar:false 模式：所有文件物理展开在 resources/app/ 下
        const serverDir = path.join(process.resourcesPath, 'app', '.next', 'standalone');
        const serverPath = path.join(serverDir, 'server.js');
        // 使用 Electron 内置的 Node.js 可执行文件（ELECTRON_RUN_AS_NODE=1 使它作为普通 Node.js 运行）
        serverProcess = (0, child_process_1.spawn)(process.execPath, [serverPath], {
            cwd: serverDir,
            env: {
                ...process.env,
                NODE_ENV: 'production',
                PORT: String(PORT),
                ELECTRON_RUN_AS_NODE: '1',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        serverProcess.stdout?.on('data', (data) => {
            console.log(`[next] ${data.toString().trim()}`);
        });
        serverProcess.stderr?.on('data', (data) => {
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
                }
                else {
                    setTimeout(check, 1000);
                }
            });
            req.end();
        };
        check();
    });
}
/** 开发模式：用 npm script 启动 next dev */
function startDevServer() {
    return new Promise((resolve, reject) => {
        // 在 Windows 上直接调用 node_modules/.bin/next 可能有问题
        const projectRoot = electron_1.app.getAppPath();
        const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
        serverProcess = (0, child_process_1.spawn)(process.execPath, [nextBin, 'dev', '-p', String(PORT)], {
            cwd: projectRoot,
            env: {
                ...process.env,
                NODE_ENV: 'development',
                PORT: String(PORT),
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        serverProcess.stdout?.on('data', (data) => {
            process.stdout.write(`[next] ${data}`);
        });
        serverProcess.stderr?.on('data', (data) => {
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
                }
                else {
                    setTimeout(check, 1000);
                }
            });
            req.end();
        };
        check();
    });
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
electron_1.app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();
    // 自动更新：检查并触发更新检查（延迟 10 秒，等服务启动）
    setTimeout(() => {
        electron_updater_1.autoUpdater.checkForUpdates();
    }, 10000);
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
});
//# sourceMappingURL=main.js.map