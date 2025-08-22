import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { AutoEditTATE, type ProcessingResult } from '@autoedittate/core';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AutoEditTATE Electron Main Process
 * 
 * デスクトップアプリケーションのメインプロセス
 * - ウィンドウ管理
 * - ファイルシステムアクセス
 * - AutoEditTATEコアとの連携
 */

class AutoEditTATEApp {
  private mainWindow: BrowserWindow | null = null;
  private autoEditTATE: AutoEditTATE;
  private isDevelopment: boolean;
  
  constructor() {
    this.autoEditTATE = new AutoEditTATE();
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    this.initializeApp();
  }
  
  private async initializeApp(): Promise<void> {
    // アプリの準備完了を待機
    await app.whenReady();
    
    // メインウィンドウを作成
    await this.createMainWindow();
    
    // メニューを設定
    this.createApplicationMenu();
    
    // IPCハンドラーを設定
    this.setupIpcHandlers();
    
    // アプリケーションイベントを設定
    this.setupAppEvents();
    
    console.log('AutoEditTATE Electron app initialized');
  }
  
  /**
   * メインウィンドウを作成
   */
  private async createMainWindow(): Promise<void> {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 800,
      titleBarStyle: 'default',
      icon: path.join(__dirname, '../assets/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: !this.isDevelopment,
      },
      show: false, // 準備完了後に表示
    });
    
    // 開発環境とプロダクション環境でのURL設定
    if (this.isDevelopment) {
      // 開発サーバーに接続
      await this.mainWindow.loadURL('http://localhost:3000');
      
      // DevToolsを開く
      this.mainWindow.webContents.openDevTools();
    } else {
      // ビルドされたファイルを読み込み
      const indexPath = path.join(__dirname, '../renderer/index.html');
      await this.mainWindow.loadFile(indexPath);
    }
    
    // ウィンドウの準備が完了したら表示
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      
      // 開発環境での自動リロード設定
      if (this.isDevelopment) {
        this.mainWindow?.webContents.reloadIgnoringCache();
      }
    });
    
    // ウィンドウが閉じられた時の処理
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
    
    // 外部リンクは既定のブラウザで開く
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }
  
  /**
   * アプリケーションメニューを作成
   */
  private createApplicationMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Import XML Project',
            accelerator: 'CmdOrCtrl+O',
            click: () => this.handleImportXML(),
          },
          {
            label: 'Import Audio File',
            accelerator: 'CmdOrCtrl+Shift+A',
            click: () => this.handleImportAudio(),
          },
          {
            label: 'Import Video File',
            accelerator: 'CmdOrCtrl+Shift+V',
            click: () => this.handleImportVideo(),
          },
          { type: 'separator' },
          {
            label: 'Export Results',
            accelerator: 'CmdOrCtrl+E',
            click: () => this.handleExport(),
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => app.quit(),
          },
        ],
      },
      {
        label: 'Process',
        submenu: [
          {
            label: 'Start Analysis',
            accelerator: 'CmdOrCtrl+R',
            click: () => this.sendToRenderer('menu:start-analysis'),
          },
          {
            label: 'Stop Processing',
            accelerator: 'CmdOrCtrl+.',
            click: () => this.sendToRenderer('menu:stop-processing'),
          },
          { type: 'separator' },
          {
            label: 'Run QA Validation',
            accelerator: 'CmdOrCtrl+T',
            click: () => this.sendToRenderer('menu:run-qa'),
          },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About AutoEditTATE',
            click: () => this.showAboutDialog(),
          },
          {
            label: 'Documentation',
            click: () => shell.openExternal('https://github.com/your-org/autoedit-tate'),
          },
        ],
      },
    ];
    
    // macOSの場合、アプリメニューを追加
    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      });
    }
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
  
  /**
   * IPCハンドラーを設定
   */
  private setupIpcHandlers(): void {
    // ファイル選択
    ipcMain.handle('dialog:select-file', async (_, options: {
      title?: string;
      filters?: Electron.FileFilter[];
      properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
    }) => {
      if (!this.mainWindow) return { canceled: true };
      
      return await dialog.showOpenDialog(this.mainWindow, {
        title: options.title || 'Select File',
        filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
        properties: options.properties || ['openFile'],
      });
    });
    
    // ディレクトリ選択
    ipcMain.handle('dialog:select-directory', async (_, title?: string) => {
      if (!this.mainWindow) return { canceled: true };
      
      return await dialog.showOpenDialog(this.mainWindow, {
        title: title || 'Select Directory',
        properties: ['openDirectory'],
      });
    });
    
    // 保存ダイアログ
    ipcMain.handle('dialog:save-file', async (_, options: {
      title?: string;
      defaultPath?: string;
      filters?: Electron.FileFilter[];
    }) => {
      if (!this.mainWindow) return { canceled: true };
      
      return await dialog.showSaveDialog(this.mainWindow, {
        title: options.title || 'Save File',
        defaultPath: options.defaultPath,
        filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
      });
    });
    
    // AutoEditTATE処理
    ipcMain.handle('autoedit:process-xml', async (_, xmlPath: string, outputDir: string, options?: any) => {
      try {
        console.log(`Processing XML: ${xmlPath} -> ${outputDir}`);
        const result = await this.autoEditTATE.processFromXML(xmlPath, outputDir, options);
        return { success: true, result };
      } catch (error) {
        console.error('XML processing failed:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
    
    ipcMain.handle('autoedit:process-files', async (_, audioPath: string, videoPath: string, outputDir: string, options?: any) => {
      try {
        console.log(`Processing files: audio=${audioPath}, video=${videoPath} -> ${outputDir}`);
        const result = await this.autoEditTATE.processFromFiles(audioPath, videoPath, outputDir, options);
        return { success: true, result };
      } catch (error) {
        console.error('File processing failed:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
    
    // システム状態取得
    ipcMain.handle('autoedit:get-status', async () => {
      return this.autoEditTATE.getSystemStatus();
    });
    
    // 設定更新
    ipcMain.handle('autoedit:update-config', async (_, config: any) => {
      try {
        await this.autoEditTATE.updateConfiguration(config);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
    
    // ファイル操作
    ipcMain.handle('fs:read-file', async (_, filePath: string) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { success: true, content };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
    
    ipcMain.handle('fs:write-file', async (_, filePath: string, content: string) => {
      try {
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
    
    // アプリ情報
    ipcMain.handle('app:get-version', () => app.getVersion());
    ipcMain.handle('app:get-path', (_, name: string) => app.getPath(name as any));
  }
  
  /**
   * アプリケーションイベントを設定
   */
  private setupAppEvents(): void {
    // すべてのウィンドウが閉じられた時
    app.on('window-all-closed', () => {
      // macOSでは、明示的にアプリを終了するまでアプリを実行し続ける
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
    
    // アプリがアクティブになった時（macOS）
    app.on('activate', async () => {
      // メインウィンドウが存在しない場合は作成
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createMainWindow();
      }
    });
    
    // アプリが終了する前
    app.on('before-quit', () => {
      console.log('AutoEditTATE app is quitting...');
    });
  }
  
  /**
   * レンダラープロセスにメッセージを送信
   */
  private sendToRenderer(channel: string, ...args: any[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }
  
  /**
   * ファイルインポートハンドラー
   */
  private async handleImportXML(): Promise<void> {
    if (!this.mainWindow) return;
    
    const result = await dialog.showOpenDialog(this.mainWindow, {
      title: 'Import Premiere XML Project',
      filters: [
        { name: 'XML Files', extensions: ['xml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      this.sendToRenderer('file:xml-imported', result.filePaths[0]);
    }
  }
  
  private async handleImportAudio(): Promise<void> {
    if (!this.mainWindow) return;
    
    const result = await dialog.showOpenDialog(this.mainWindow, {
      title: 'Import Audio File',
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      this.sendToRenderer('file:audio-imported', result.filePaths[0]);
    }
  }
  
  private async handleImportVideo(): Promise<void> {
    if (!this.mainWindow) return;
    
    const result = await dialog.showOpenDialog(this.mainWindow, {
      title: 'Import Video File',
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      this.sendToRenderer('file:video-imported', result.filePaths[0]);
    }
  }
  
  private async handleExport(): Promise<void> {
    this.sendToRenderer('menu:export');
  }
  
  /**
   * About ダイアログを表示
   */
  private showAboutDialog(): void {
    if (!this.mainWindow) return;
    
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'About AutoEditTATE',
      message: 'AutoEditTATE',
      detail: `Version: ${app.getVersion()}\n\nAI-powered automatic video editing system for SNS content.\n\nBuilt with Electron, React, and TypeScript.`,
      buttons: ['OK'],
    });
  }
}

// アプリケーションを開始
new AutoEditTATEApp();