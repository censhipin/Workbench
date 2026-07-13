"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    // 自动更新
    onUpdateAvailable: (cb) => {
        electron_1.ipcRenderer.on('update-available', (_e, version) => cb(version));
    },
    onUpdateNotAvailable: (cb) => {
        electron_1.ipcRenderer.on('update-not-available', () => cb());
    },
    onDownloadProgress: (cb) => {
        electron_1.ipcRenderer.on('download-progress', (_e, percent) => cb(percent));
    },
    onUpdateDownloaded: (cb) => {
        electron_1.ipcRenderer.on('update-downloaded', () => cb());
    },
    onUpdateError: (cb) => {
        electron_1.ipcRenderer.on('update-error', (_e, msg) => cb(msg));
    },
    checkForUpdate: () => electron_1.ipcRenderer.send('check-for-update'),
    downloadUpdate: () => electron_1.ipcRenderer.send('download-update'),
    installUpdate: () => electron_1.ipcRenderer.send('install-update'),
});
//# sourceMappingURL=preload.js.map