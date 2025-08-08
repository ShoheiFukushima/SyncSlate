/* Load Electron in ESM context via createRequire to avoid CJS interop pitfalls with ts-node/tsx.
   NOTE: During development we are executing this file with Node (tsx), not with Electron runtime.
   Accessing electron.app is undefined outside Electron. So we only run Electron bootstrap when ELECTRON_RUN_AS_NODE is not set. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const electron = require('electron');
const { app, BrowserWindow, dialog, ipcMain, shell } = electron;
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV !== 'production';
let mainWindow = null;
function getPreloadPath() {
    const preloadDev = path.resolve(__dirname, '../preload/preload.ts');
    const preloadProd = path.resolve(__dirname, '../preload/preload.js');
    return isDev ? preloadDev : preloadProd;
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
/**
 * Boot the Electron app only when running under Electron (not plain Node).
 * In dev, we should spawn Electron to run this file, not node/tsx directly.
 */
if (process.versions.electron) {
    (async () => {
        await app.whenReady();
        registerIpc();
        await createWindow();
        app.on('activate', async () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                await createWindow();
            }
        });
    })();
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin')
            app.quit();
    });
}
else {
    // Guard: running under plain Node (tsx). Do nothing to avoid electron.app being undefined.
    console.warn('[main] Skipped Electron bootstrap (not running under Electron runtime).');
}
