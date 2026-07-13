import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  // 自动更新
  onUpdateAvailable: (cb: (v: string) => void) => {
    ipcRenderer.on('update-available', (_e, version) => cb(version));
  },
  onUpdateNotAvailable: (cb: () => void) => {
    ipcRenderer.on('update-not-available', () => cb());
  },
  onDownloadProgress: (cb: (pct: number) => void) => {
    ipcRenderer.on('download-progress', (_e, percent) => cb(percent));
  },
  onUpdateDownloaded: (cb: () => void) => {
    ipcRenderer.on('update-downloaded', () => cb());
  },
  onUpdateError: (cb: (msg: string) => void) => {
    ipcRenderer.on('update-error', (_e, msg) => cb(msg));
  },
  checkForUpdate: () => ipcRenderer.send('check-for-update'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
});
