"use strict";
/* Electron main process (CommonJS). This file is compiled to CJS; avoid import.meta usage. */
const path = require('node:path');
const electron = require('electron');
const { app, BrowserWindow, dialog, ipcMain, shell } = electron;
const isDev = process.env.NODE_ENV !== 'production';
let mainWindow = null;
function getPreloadPath() {
    // Preload is built to JS. Point to compiled JS under dist-main/preload/preload.js
    // During dev we still reference the compiled preload output path relative to this file's dist.
    return path.resolve(__dirname, '../preload/preload.js');
}
async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: getPreloadPath(),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
        show: false,
    });
    mainWindow.on('ready-to-show', () => {
        mainWindow?.show();
    });
    if (isDev) {
        await mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        const indexHtml = path.resolve(__dirname, '../../app/renderer/dist/index.html');
        await mainWindow.loadFile(indexHtml);
    }
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}
function registerIpc() {
    ipcMain.handle('dialog:openVideo', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: '動画を開く',
            properties: ['openFile'],
            filters: [
                { name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });
        if (canceled)
            return null;
        return filePaths[0] ?? null;
    });
}
// Boot
app.whenReady().then(async () => {
    registerIpc();
    await createWindow();
    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await createWindow();
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});
