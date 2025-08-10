import { contextBridge, ipcRenderer } from 'electron';

export type OpenVideoResult = string | null;

const api = {
  openVideoDialog: async (): Promise<OpenVideoResult> => {
    return ipcRenderer.invoke('dialog:openVideo');
  },
  // Native addon placeholder; will be wired after napi-rs build
  native: {
    greet: async (): Promise<string> => {
      try {
        // Dynamic import so preload remains safe if native module is missing in dev
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const native = await import('../../native/rust-core/index.js');
        return native.greet?.() ?? 'native.greet not available';
      } catch (e) {
        return `native module not loaded: ${String(e)}`;
      }
    },
  },
};

declare global {
  interface Window {
    api: typeof api;
  }
}

contextBridge.exposeInMainWorld('api', api);