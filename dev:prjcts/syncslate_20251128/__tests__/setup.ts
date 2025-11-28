/**
 * Test Setup and Configuration
 * グローバルなテスト設定とモック
 */

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// TextEncoder/TextDecoder のポリフィル
Object.assign(global, { TextEncoder, TextDecoder });

// BroadcastChannel のモック
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private static channels: Map<string, Set<MockBroadcastChannel>> = new Map();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(message: any) {
    const channels = MockBroadcastChannel.channels.get(this.name);
    if (channels) {
      channels.forEach((channel) => {
        if (channel !== this && channel.onmessage) {
          const event = new MessageEvent('message', { data: message });
          setTimeout(() => channel.onmessage?.(event), 0);
        }
      });
    }
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      this.onmessage = listener;
    }
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message' && this.onmessage === listener) {
      this.onmessage = null;
    }
  }

  close() {
    const channels = MockBroadcastChannel.channels.get(this.name);
    if (channels) {
      channels.delete(this);
      if (channels.size === 0) {
        MockBroadcastChannel.channels.delete(this.name);
      }
    }
  }

  static reset() {
    MockBroadcastChannel.channels.clear();
  }
}

// グローバルに設定
(global as any).BroadcastChannel = MockBroadcastChannel;

// URLSearchParams のモック
delete (window as any).location;
(window as any).location = {
  href: 'http://localhost:3000/',
  origin: 'http://localhost:3000',
  search: '',
};

// Date.now() のモックヘルパー
export const mockDateNow = (timestamp: number) => {
  jest.spyOn(Date, 'now').mockImplementation(() => timestamp);
};

// requestAnimationFrame のモック
let rafCallbacks: FrameRequestCallback[] = [];
let rafId = 0;

(global as any).requestAnimationFrame = (callback: FrameRequestCallback): number => {
  const id = ++rafId;
  rafCallbacks.push(callback);
  return id;
};

(global as any).cancelAnimationFrame = (id: number): void => {
  // 実際の削除ロジックは簡略化
};

export const flushAnimationFrames = (timestamp: number = 16) => {
  const callbacks = [...rafCallbacks];
  rafCallbacks = [];
  callbacks.forEach(cb => cb(timestamp));
};

// localStorage のモック
class MockLocalStorage {
  private store: { [key: string]: string } = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

Object.defineProperty(window, 'localStorage', {
  value: new MockLocalStorage(),
  writable: true,
});

// navigator.share のモック
Object.defineProperty(navigator, 'share', {
  value: jest.fn().mockResolvedValue(undefined),
  writable: true,
});

// navigator.clipboard のモック
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
  },
  writable: true,
});

// テスト間でのクリーンアップ
beforeEach(() => {
  MockBroadcastChannel.reset();
  (window as any).location.search = '';
  localStorage.clear();
  rafCallbacks = [];
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});