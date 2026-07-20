import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as https from 'https';
import * as fs from 'fs';
import * as http from 'http';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const isDev = !app.isPackaged;
const PORT = Number(process.env.PORT) || 3000;
const OWNER = 'censhipin';
const REPO = 'Workbench';

// ── 自定义自动更新（不依赖 electron-updater，国内可直连） ──
let latestVersion: string | null = null;
let latestExeUrl: string | null = null;
let downloadedExePath: string | null = null;

function checkForUpdates() {
  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;
  const req = https.get(apiUrl, {
    headers: { 'User-Agent': 'DataPilot-Updater', 'Accept': 'application/json' },
  }, (res) => {
    let body = '';
    res.on('data', (c: string) => body += c);
    res.on('end', () => {
      try {
        const release = JSON.parse(body);
        const remoteVersion = (release.tag_name || '').replace(/^v/, '');
        const currentVersion = app.getVersion();
        const exeAsset = (release.assets || []).find((a: any) =>
          a.name && a.name.endsWith('.exe') && !a.name.includes('blockmap'));
        if (!exeAsset) {
          mainWindow?.webContents.send('update-not-available');
          return;
        }
        if (compareVersion(remoteVersion, currentVersion) > 0) {
          latestVersion = remoteVersion;
          latestExeUrl = exeAsset.browser_download_url;
          mainWindow?.webContents.send('update-available', remoteVersion);
        } else {
          mainWindow?.webContents.send('update-not-available');
        }
      } catch (e) {
        mainWindow?.webContents.send('update-error', String(e));
      }
    });
  });
  req.on('error', (e) => mainWindow?.webContents.send('update-error', e.message));
  req.setTimeout(15000, () => { req.destroy(); mainWindow?.webContents.send('update-error', '检查更新超时'); });
}

function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function downloadUpdate() {
  if (!latestExeUrl || !latestVersion) return;

  const tmpDir = path.join(app.getPath('temp'), 'datapilot-update');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const exePath = path.join(tmpDir, `DataPilot Setup ${latestVersion}.exe`);
  downloadedExePath = exePath;

  const dlUrl = latestExeUrl;

  // 先试直连：github.com（小概率能通）
  downloadWithFailback(dlUrl, exePath, 8000, () => {
    // 直连失败，走 ghproxy 镜像
    const mirrorUrl = `https://ghproxy.net/${encodeURI(dlUrl)}`;
    downloadWithFailback(mirrorUrl, exePath, 300000, () => {
      mainWindow?.webContents.send('update-error', `下载失败。请前往 https://github.com/${OWNER}/${REPO}/releases/latest 手动下载`);
    });
  });
}

function downloadWithFailback(url: string, destPath: string, timeoutMs: number, onFail: () => void) {
  const proto = url.startsWith('https') ? https : http;
  const file = fs.createWriteStream(destPath);
  let completed = false;
  let totalSize = 0;
  let downloaded = 0;

  // 确保后续 same-key 重连不传 stale stream
  const req = proto.get(url, { headers: { 'User-Agent': 'DataPilot-Updater' } }, (res) => {
    // 处理重定向
    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      const loc = res.headers.location;
      file.close();
      downloadWithFailback(loc, destPath, timeoutMs, onFail);
      return;
    }
    totalSize = parseInt(String(res.headers['content-length'] || '0'), 10);
    let lastPct = -1;
    res.on('data', (chunk: Buffer) => {
      downloaded += chunk.length;
      file.write(chunk);
      const pct = totalSize > 0 ? Math.min(99, Math.round((downloaded / totalSize) * 100)) : -1;
      if (pct > lastPct) { lastPct = pct; mainWindow?.webContents.send('download-progress', pct); }
    });
    res.on('end', () => {
      file.end();
      completed = true;
      mainWindow?.webContents.send('download-progress', 100);
      mainWindow?.webContents.send('update-downloaded');
    });
  });
  req.on('error', () => {
    file.close();
    if (!completed) { try { fs.unlinkSync(destPath); } catch {} onFail(); }
  });
  req.setTimeout(timeoutMs, () => {
    req.destroy();
    file.close();
    if (!completed) onFail();
  });
}

function installUpdate() {
  if (!downloadedExePath || !fs.existsSync(downloadedExePath)) {
    shell.openExternal(`https://github.com/${OWNER}/${REPO}/releases/latest`);
    return;
  }
  spawn(downloadedExePath, ['/S'], { detached: true, stdio: 'ignore' }).unref();
  setTimeout(() => app.quit(), 1000);
}

// ── Electron 主流程 ──

function setupAutoUpdater() {
  if (isDev) return;
  ipcMain.on('check-for-update', () => checkForUpdates());
  ipcMain.on('download-update', () => downloadUpdate());
  ipcMain.on('install-update', () => installUpdate());
}

/** 生产环境：用 Electron 内置的 Node.js 启动 standalone server */
function startProdServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverDir = path.join(process.resourcesPath, 'app', '.next', 'standalone');
    const serverPath = path.join(serverDir, 'server.js');
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: serverDir,
      env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    serverProcess.stdout?.on('data', (d: Buffer) => console.log(`[next] ${d.toString().trim()}`));
    serverProcess.stderr?.on('data', (d: Buffer) => console.log(`[next] ${d.toString().trim()}`));
    serverProcess.on('error', (e) => reject(e));
    serverProcess.on('exit', (c) => { if (c !== 0) console.error(`[server] Exited with code ${c}`); });
    let attempts = 0;
    const max = 90;
    const check = () => {
      attempts++;
      http.get(`http://localhost:${PORT}`, (r) => { r.resume(); resolve(); }).on('error', () => {
        if (attempts >= max) reject(new Error(`Server not ready after ${max} attempts`));
        else setTimeout(check, 1000);
      });
    };
    check();
  });
}

/** 开发模式 */
function startDevServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const root = app.getAppPath();
    const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
    serverProcess = spawn(process.execPath, [nextBin, 'dev', '-p', String(PORT)], {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'development', PORT: String(PORT) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    serverProcess.stdout?.on('data', (d: Buffer) => process.stdout.write(`[next] ${d}`));
    serverProcess.stderr?.on('data', (d: Buffer) => process.stderr.write(`[next] ${d}`));
    let attempts = 0;
    const max = 90;
    const check = () => {
      attempts++;
      http.get(`http://localhost:${PORT}`, () => { resolve(); }).on('error', () => {
        if (attempts >= max) reject(new Error(`Dev server not ready after ${max} attempts`));
        else setTimeout(check, 1000);
      });
    };
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 700,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    autoHideMenuBar: true,
  });
  (isDev ? startDevServer() : startProdServer())
    .then(() => mainWindow?.loadURL(`http://localhost:${PORT}`))
    .catch((e) => mainWindow?.loadURL(`data:text/html,<h1>启动失败</h1><p>${encodeURIComponent(String(e))}</p>`));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  setTimeout(() => checkForUpdates(), 10000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => { if (serverProcess) { serverProcess.kill(); serverProcess = null; } });
