import { contextBridge, ipcRenderer } from 'electron';

/**
 * AutoEditTATE Electron Preload Script
 * 
 * セキュアなIPC通信のためのプリロードスクリプト
 * レンダラープロセスとメインプロセス間の安全な通信を提供
 */

// 型定義
export interface ElectronAPI {
  // ダイアログ
  dialog: {
    selectFile: (options?: {
      title?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
    }) => Promise<{ canceled: boolean; filePaths?: string[] }>;
    
    selectDirectory: (title?: string) => Promise<{ canceled: boolean; filePaths?: string[] }>;
    
    saveFile: (options?: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }) => Promise<{ canceled: boolean; filePath?: string }>;
  };
  
  // AutoEditTATE 処理
  autoEdit: {
    processXML: (xmlPath: string, outputDir: string, options?: any) => Promise<{
      success: boolean;
      result?: any;
      error?: string;
    }>;
    
    processFiles: (audioPath: string, videoPath: string, outputDir: string, options?: any) => Promise<{
      success: boolean;
      result?: any;
      error?: string;
    }>;
    
    getStatus: () => Promise<any>;
    
    updateConfig: (config: any) => Promise<{
      success: boolean;
      error?: string;
    }>;
  };
  
  // ファイルシステム
  fs: {
    readFile: (filePath: string) => Promise<{
      success: boolean;
      content?: string;
      error?: string;
    }>;
    
    writeFile: (filePath: string, content: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
  };
  
  // アプリ情報
  app: {
    getVersion: () => Promise<string>;
    getPath: (name: string) => Promise<string>;
  };
  
  // イベントリスナー
  on: (channel: string, callback: (...args: any[]) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// ElectronAPIをwindowオブジェクトに公開
const electronAPI: ElectronAPI = {
  // ダイアログAPI
  dialog: {
    selectFile: (options) => ipcRenderer.invoke('dialog:select-file', options),
    selectDirectory: (title) => ipcRenderer.invoke('dialog:select-directory', title),
    saveFile: (options) => ipcRenderer.invoke('dialog:save-file', options),
  },
  
  // AutoEditTATE API
  autoEdit: {
    processXML: (xmlPath, outputDir, options) => 
      ipcRenderer.invoke('autoedit:process-xml', xmlPath, outputDir, options),
    
    processFiles: (audioPath, videoPath, outputDir, options) => 
      ipcRenderer.invoke('autoedit:process-files', audioPath, videoPath, outputDir, options),
    
    getStatus: () => ipcRenderer.invoke('autoedit:get-status'),
    
    updateConfig: (config) => ipcRenderer.invoke('autoedit:update-config', config),
  },
  
  // ファイルシステムAPI
  fs: {
    readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:write-file', filePath, content),
  },
  
  // アプリAPI
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPath: (name) => ipcRenderer.invoke('app:get-path', name),
  },
  
  // イベントリスナー
  on: (channel: string, callback: (...args: any[]) => void) => {
    // セキュリティのため、許可されたチャンネルのみリスニング
    const validChannels = [
      'menu:start-analysis',
      'menu:stop-processing',
      'menu:run-qa',
      'menu:export',
      'file:xml-imported',
      'file:audio-imported',
      'file:video-imported',
      'processing:progress',
      'processing:complete',
      'processing:error',
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    } else {
      console.warn(`Attempted to listen to unauthorized channel: ${channel}`);
    }
  },
  
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

// Context Bridgeを使用してAPIを安全に公開
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 型定義をグローバルに追加
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// TypeScript用の型エクスポート
export type { ElectronAPI };