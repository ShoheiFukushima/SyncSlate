# 1ms精度同期アーキテクチャ設計書

## 📋 概要

SyncSlate AIを1ms精度の完全同期システムに進化させ、SaaS Platform Coreと統合する包括的な設計。

## 🎯 目標精度

| レイヤー | 目標精度 | 実現手段 |
|---------|---------|---------|
| **オーディオ同期** | ±1ms | AudioContext.currentTime + サーバー時刻同期 |
| **ビジュアル同期** | ±8ms | Performance.now() + RAF最適化 |
| **コマンド配信** | ±5ms | WebSocket + RTT補正 |
| **時刻同期** | ±2ms | NTP補正 + サーバー時刻参照 |

## 🏗️ システムアーキテクチャ

### Phase 1: 時刻同期基盤

#### 1.1 NTP時刻同期サービス

```typescript
// services/time-sync.ts

interface TimeSyncConfig {
  serverUrl: string;
  syncInterval: number; // ms
  sampleCount: number;  // 精度向上のためのサンプル数
}

class PrecisionTimeSync {
  private offset: number = 0;
  private latency: number = 0;
  private syncHistory: Array<{ offset: number; rtt: number; timestamp: number }> = [];

  /**
   * サーバー時刻との同期
   *
   * アルゴリズム:
   * 1. クライアント時刻 T1 を記録
   * 2. サーバーにリクエスト送信
   * 3. サーバー時刻 Ts を受信
   * 4. クライアント時刻 T2 を記録
   * 5. RTT = T2 - T1
   * 6. オフセット = Ts - (T1 + RTT/2)
   */
  async syncWithServer(url: string): Promise<{ offset: number; rtt: number }> {
    const samples: Array<{ offset: number; rtt: number }> = [];

    // 複数回サンプリングして最小RTTを採用（最も正確）
    for (let i = 0; i < 5; i++) {
      const t1 = performance.now();

      const response = await fetch(`${url}/api/time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime: t1 })
      });

      const t2 = performance.now();
      const { serverTime } = await response.json();

      const rtt = t2 - t1;
      const offset = serverTime - (t1 + rtt / 2);

      samples.push({ offset, rtt });
    }

    // RTTが最小のサンプルを採用
    const bestSample = samples.reduce((min, curr) =>
      curr.rtt < min.rtt ? curr : min
    );

    this.offset = bestSample.offset;
    this.latency = bestSample.rtt / 2;

    this.syncHistory.push({
      offset: this.offset,
      rtt: bestSample.rtt,
      timestamp: Date.now()
    });

    return bestSample;
  }

  /**
   * サーバー時刻を取得（補正済み）
   */
  getServerTime(): number {
    return performance.now() + this.offset;
  }

  /**
   * クライアント時刻からサーバー時刻へ変換
   */
  toServerTime(clientTime: number): number {
    return clientTime + this.offset;
  }

  /**
   * サーバー時刻からクライアント時刻へ変換
   */
  toClientTime(serverTime: number): number {
    return serverTime - this.offset;
  }

  /**
   * 同期品質メトリクス
   */
  getQualityMetrics() {
    const recentHistory = this.syncHistory.slice(-10);
    const avgOffset = recentHistory.reduce((sum, s) => sum + s.offset, 0) / recentHistory.length;
    const offsetStdDev = Math.sqrt(
      recentHistory.reduce((sum, s) => sum + Math.pow(s.offset - avgOffset, 2), 0) / recentHistory.length
    );

    return {
      currentOffset: this.offset,
      currentLatency: this.latency,
      offsetStdDev,
      quality: offsetStdDev < 2 ? 'excellent' : offsetStdDev < 5 ? 'good' : 'poor'
    };
  }
}

export const timeSync = new PrecisionTimeSync();
```

#### 1.2 高精度タイマーサービス

```typescript
// services/precision-timer.ts

/**
 * Performance.now()ベースの高精度タイマー
 * Date.now()より精度が高い（マイクロ秒単位）
 */
class PrecisionTimer {
  private startTime: number = 0;
  private pauseTime: number = 0;
  private isPaused: boolean = false;

  start(absoluteStartTime: number) {
    this.startTime = absoluteStartTime;
    this.isPaused = false;
  }

  /**
   * 経過時間を取得（ミリ秒）
   */
  getElapsed(): number {
    if (this.isPaused) {
      return this.pauseTime - this.startTime;
    }
    return timeSync.getServerTime() - this.startTime;
  }

  /**
   * 次のフレームまでの時間を取得
   * @param targetTime - 目標時刻（サーバー時刻）
   */
  getTimeUntil(targetTime: number): number {
    return targetTime - timeSync.getServerTime();
  }

  pause() {
    if (!this.isPaused) {
      this.pauseTime = timeSync.getServerTime();
      this.isPaused = true;
    }
  }

  resume() {
    if (this.isPaused) {
      const pauseDuration = timeSync.getServerTime() - this.pauseTime;
      this.startTime += pauseDuration;
      this.isPaused = false;
    }
  }
}

export const precisionTimer = new PrecisionTimer();
```

### Phase 2: オーディオ同期

#### 2.1 AudioContext時刻同期

```typescript
// services/audio-sync.ts

import { getGeminiAudioEngine } from '../gemini-api';
import { timeSync } from './time-sync';

interface ScheduledAudio {
  id: string;
  audioBuffer: AudioBuffer;
  scheduledTime: number; // サーバー時刻
  source?: AudioBufferSourceNode;
}

class AudioSyncEngine {
  private audioContext: AudioContext;
  private audioContextStartTime: number = 0;
  private scheduledAudios: Map<string, ScheduledAudio> = new Map();

  constructor() {
    this.audioContext = getGeminiAudioEngine().audioContext;
  }

  /**
   * AudioContextの開始時刻を記録
   * AudioContext.currentTimeとサーバー時刻の対応を確立
   */
  initialize() {
    // AudioContextが停止している場合は再開
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // AudioContext時刻とサーバー時刻の対応を記録
    this.audioContextStartTime = timeSync.getServerTime() - (this.audioContext.currentTime * 1000);
  }

  /**
   * サーバー時刻からAudioContext時刻へ変換
   */
  serverTimeToAudioTime(serverTime: number): number {
    const elapsedMs = serverTime - this.audioContextStartTime;
    return elapsedMs / 1000; // 秒単位
  }

  /**
   * AudioContext時刻からサーバー時刻へ変換
   */
  audioTimeToServerTime(audioTime: number): number {
    return this.audioContextStartTime + (audioTime * 1000);
  }

  /**
   * 指定時刻にオーディオを再生
   * @param audioBuffer - 再生するオーディオバッファ
   * @param serverTime - 再生開始時刻（サーバー時刻）
   */
  scheduleAudio(id: string, audioBuffer: AudioBuffer, serverTime: number) {
    const audioTime = this.serverTimeToAudioTime(serverTime);
    const currentAudioTime = this.audioContext.currentTime;

    // 過去の時刻は即座に再生
    const playTime = Math.max(audioTime, currentAudioTime + 0.001);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start(playTime);

    this.scheduledAudios.set(id, {
      id,
      audioBuffer,
      scheduledTime: serverTime,
      source
    });

    // 再生後にクリーンアップ
    source.onended = () => {
      this.scheduledAudios.delete(id);
    };

    return playTime;
  }

  /**
   * スケジュール済みオーディオをキャンセル
   */
  cancelScheduled(id: string) {
    const scheduled = this.scheduledAudios.get(id);
    if (scheduled?.source) {
      scheduled.source.stop();
      this.scheduledAudios.delete(id);
    }
  }

  /**
   * 全てのスケジュール済みオーディオをキャンセル
   */
  cancelAll() {
    this.scheduledAudios.forEach(scheduled => {
      scheduled.source?.stop();
    });
    this.scheduledAudios.clear();
  }

  /**
   * 現在のAudioContext時刻（サーバー時刻に変換）
   */
  getCurrentServerTime(): number {
    return this.audioTimeToServerTime(this.audioContext.currentTime);
  }
}

export const audioSync = new AudioSyncEngine();
```

### Phase 3: Supabase Realtime統合

#### 3.1 Supabaseクライアント

```bash
npm install @supabase/supabase-js
```

```typescript
// services/supabase-client.ts

import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase環境変数が設定されていません');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// データベース型定義
export interface Session {
  id: string;
  host_id: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  server_time?: number; // サーバー時刻参照用
}

export interface SyncEvent {
  id: number;
  session_id: string;
  event_type: 'CMD_START' | 'CMD_STOP' | 'SYNC_STATE' | 'TIME_SYNC';
  payload: any;
  server_time: number; // サーバー側で記録された時刻
  created_at: string;
}

export interface Device {
  id: string;
  session_id: string;
  role: 'HOST' | 'CLIENT';
  user_agent: string;
  last_ping: string;
  time_offset: number; // サーバーとの時刻オフセット
  latency: number;     // RTT / 2
}
```

#### 3.2 Supabase Sync Engine

```typescript
// services/supabase-sync-engine.ts

import { supabase, Session, SyncEvent, Device } from './supabase-client';
import { timeSync } from './time-sync';
import { RealtimeChannel } from '@supabase/supabase-js';

export type SyncEventType = 'CMD_START' | 'CMD_STOP' | 'SYNC_STATE' | 'TIME_SYNC';

export interface SyncMessage {
  type: SyncEventType;
  payload: any;
  serverTime?: number; // サーバー時刻（受信時）
}

export class SupabaseSyncEngine {
  private channel: RealtimeChannel | null = null;
  private sessionId: string | null = null;
  private deviceId: string;
  private role: 'HOST' | 'CLIENT';
  private messageHandlers: Map<SyncEventType, (msg: SyncMessage) => void> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(deviceId: string, role: 'HOST' | 'CLIENT') {
    this.deviceId = deviceId;
    this.role = role;
  }

  /**
   * HOSTとして新規セッションを作成
   */
  async createSession(): Promise<string> {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        host_id: this.deviceId,
        server_time: Date.now() // サーバー時刻を記録
      })
      .select()
      .single();

    if (error) throw new Error(`セッション作成失敗: ${error.message}`);

    this.sessionId = data.id;

    // デバイス登録
    await this.registerDevice();

    // 時刻同期を実行
    await this.performTimeSync();

    return data.id;
  }

  /**
   * CLIENTとして既存セッションに参加
   */
  async joinSession(sessionId: string): Promise<void> {
    const { data, error } = await supabase
      .from('sessions')
      .select()
      .eq('id', sessionId)
      .eq('is_active', true)
      .single();

    if (error) throw new Error(`セッション参加失敗: ${error.message}`);
    if (!data) throw new Error('セッションが見つかりません');

    this.sessionId = sessionId;

    // デバイス登録
    await this.registerDevice();

    // 時刻同期を実行
    await this.performTimeSync();
  }

  /**
   * デバイス登録
   */
  private async registerDevice() {
    if (!this.sessionId) throw new Error('セッションIDが未設定');

    const { error } = await supabase
      .from('devices')
      .insert({
        id: this.deviceId,
        session_id: this.sessionId,
        role: this.role,
        user_agent: navigator.userAgent,
        time_offset: timeSync.offset,
        latency: timeSync.latency
      });

    if (error && error.code !== '23505') { // 重複エラーは無視
      console.error('デバイス登録失敗:', error);
    }

    // 定期的にPing（30秒ごと）
    this.startPinging();
  }

  /**
   * 定期Ping開始
   */
  private startPinging() {
    if (this.pingInterval) clearInterval(this.pingInterval);

    this.pingInterval = setInterval(async () => {
      if (!this.sessionId) return;

      await supabase
        .from('devices')
        .update({
          last_ping: new Date().toISOString(),
          time_offset: timeSync.offset,
          latency: timeSync.latency
        })
        .eq('id', this.deviceId)
        .eq('session_id', this.sessionId);
    }, 30000);
  }

  /**
   * 時刻同期を実行
   */
  private async performTimeSync() {
    const platformCoreUrl = import.meta.env.VITE_PLATFORM_CORE_URL || 'http://localhost:3000';
    await timeSync.syncWithServer(platformCoreUrl);

    console.log('[TimeSync] 同期完了:', timeSync.getQualityMetrics());
  }

  /**
   * リアルタイム購読開始
   */
  subscribe() {
    if (!this.sessionId) throw new Error('セッションIDが未設定');

    this.channel = supabase
      .channel(`session:${this.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sync_events',
          filter: `session_id=eq.${this.sessionId}`
        },
        (payload) => {
          const event = payload.new as SyncEvent;
          this.handleIncomingEvent(event);
        }
      )
      .subscribe((status) => {
        console.log('[Supabase] 購読状態:', status);
      });
  }

  /**
   * 受信イベント処理
   */
  private handleIncomingEvent(event: SyncEvent) {
    // サーバー時刻を付与
    const message: SyncMessage = {
      type: event.event_type,
      payload: event.payload,
      serverTime: event.server_time
    };

    const handler = this.messageHandlers.get(event.event_type);
    if (handler) {
      handler(message);
    }
  }

  /**
   * イベント送信
   */
  async broadcast(eventType: SyncEventType, payload: any): Promise<void> {
    if (!this.sessionId) throw new Error('セッションIDが未設定');

    const serverTime = timeSync.getServerTime();

    const { error } = await supabase
      .from('sync_events')
      .insert({
        session_id: this.sessionId,
        event_type: eventType,
        payload: payload,
        server_time: serverTime
      });

    if (error) throw new Error(`イベント送信失敗: ${error.message}`);

    console.log('[Supabase] イベント送信:', eventType, payload);
  }

  /**
   * メッセージハンドラー登録
   */
  on(eventType: SyncEventType, handler: (msg: SyncMessage) => void) {
    this.messageHandlers.set(eventType, handler);
  }

  /**
   * 購読解除
   */
  unsubscribe() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * セッション終了
   */
  async endSession() {
    if (!this.sessionId) return;

    await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('id', this.sessionId);

    this.unsubscribe();
    this.sessionId = null;
  }
}
```

### Phase 4: Platform Core統合

#### 4.1 環境変数設定

```env
# .env.local

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Platform Core
VITE_PLATFORM_CORE_URL=http://localhost:3000
NEXT_PUBLIC_PLATFORM_CORE_URL=http://localhost:3000

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
```

#### 4.2 Platform Core クライアント

```typescript
// services/platform-core-client.ts

import Clerk from '@clerk/clerk-js';

const clerkPublishableKey = import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const platformCoreUrl = import.meta.env.VITE_PLATFORM_CORE_URL || 'http://localhost:3000';

if (!clerkPublishableKey) {
  throw new Error('Clerk Publishable Keyが設定されていません');
}

// Clerk初期化
export const clerk = new Clerk(clerkPublishableKey);
await clerk.load();

/**
 * Platform Core APIクライアント
 */
class PlatformCoreClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * 認証済みリクエスト
   */
  private async authenticatedFetch(endpoint: string, options: RequestInit = {}) {
    const session = clerk.session;
    if (!session) {
      throw new Error('未認証です');
    }

    const token = await session.getToken();
    const userId = clerk.user?.id;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'X-User-ID': userId || '',
      'Content-Type': 'application/json',
      ...options.headers
    };

    return fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });
  }

  /**
   * サブスクリプション情報取得
   */
  async getSubscription() {
    const response = await this.authenticatedFetch('/api/subscription/status');
    if (!response.ok) throw new Error('サブスクリプション取得失敗');
    return response.json();
  }

  /**
   * 使用可能かチェック
   */
  async checkQuota(resourceType: string) {
    const response = await this.authenticatedFetch('/api/usage/check', {
      method: 'POST',
      body: JSON.stringify({ resourceType })
    });
    if (!response.ok) throw new Error('クォータチェック失敗');
    return response.json();
  }

  /**
   * 使用量記録
   */
  async recordUsage(resourceType: string, metadata: any) {
    const response = await this.authenticatedFetch('/api/usage/record', {
      method: 'POST',
      body: JSON.stringify({ resourceType, metadata })
    });
    if (!response.ok) throw new Error('使用量記録失敗');
    return response.json();
  }

  /**
   * サーバー時刻取得（時刻同期用）
   */
  async getServerTime(): Promise<{ serverTime: number }> {
    const response = await fetch(`${this.baseUrl}/api/time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientTime: performance.now() })
    });
    if (!response.ok) throw new Error('サーバー時刻取得失敗');
    return response.json();
  }
}

export const platformCore = new PlatformCoreClient(platformCoreUrl);
```

#### 4.3 使用量記録統合

```typescript
// hooks/use-platform-core.ts

import { useEffect, useState } from 'react';
import { platformCore } from '../services/platform-core-client';
import { clerk } from '../services/platform-core-client';

export interface Subscription {
  plan: string;
  sessionsPerMonth: number;
  devicesPerSession: number;
  currentUsage: {
    sessions: number;
    devices: number;
  };
}

export function usePlatformCore() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = clerk.user;
        if (user) {
          setIsAuthenticated(true);
          const sub = await platformCore.getSubscription();
          setSubscription(sub);
        }
      } catch (error) {
        console.error('認証チェック失敗:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  /**
   * セッション作成前のクォータチェック
   */
  const checkSessionQuota = async (): Promise<boolean> => {
    if (!isAuthenticated) return true; // ゲストモードは制限なし

    try {
      const result = await platformCore.checkQuota('session');
      return result.allowed;
    } catch (error) {
      console.error('クォータチェック失敗:', error);
      return false;
    }
  };

  /**
   * セッション使用を記録
   */
  const recordSessionUsage = async (sessionId: string, deviceCount: number) => {
    if (!isAuthenticated) return;

    try {
      await platformCore.recordUsage('session', {
        sessionId,
        deviceCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('使用量記録失敗:', error);
    }
  };

  return {
    subscription,
    isAuthenticated,
    isLoading,
    checkSessionQuota,
    recordSessionUsage
  };
}
```

### Phase 5: 統合実装

#### 5.1 index.tsx の更新

```typescript
// index.tsx (主要変更箇所)

import { SupabaseSyncEngine } from './services/supabase-sync-engine';
import { audioSync } from './services/audio-sync';
import { precisionTimer } from './services/precision-timer';
import { timeSync } from './services/time-sync';
import { usePlatformCore } from './hooks/use-platform-core';

const useSyncEngine = () => {
  // Platform Core統合
  const { checkSessionQuota, recordSessionUsage, subscription } = usePlatformCore();

  // Supabase Sync Engine
  const supabaseEngineRef = useRef<SupabaseSyncEngine | null>(null);
  const [syncMode, setSyncMode] = useState<'BROADCAST' | 'SUPABASE'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('sync') === 'supabase' ? 'SUPABASE' : 'BROADCAST';
  });

  // ... 既存のコード ...

  /**
   * 高精度start関数
   */
  const start = useCallback(async () => {
    if (role === 'CLIENT') return;

    // クォータチェック
    const canCreate = await checkSessionQuota();
    if (!canCreate) {
      alert(`セッション上限に達しました（${subscription?.currentUsage.sessions}/${subscription?.sessionsPerMonth}）`);
      return;
    }

    // AudioContext初期化
    audioSync.initialize();

    // サーバー時刻で開始時刻を設定（500ms後）
    const scheduledStart = timeSync.getServerTime() + 500;

    console.log('[HOST] 開始時刻（サーバー時刻）:', scheduledStart);

    handleStartSequence(scheduledStart);

    if (syncMode === 'BROADCAST') {
      channelRef.current?.postMessage({
        type: 'CMD_START',
        payload: { startTime: scheduledStart }
      });
    } else {
      await supabaseEngineRef.current?.broadcast('CMD_START', { startTime: scheduledStart });
    }

    // 使用量記録
    if (supabaseEngineRef.current?.sessionId) {
      await recordSessionUsage(supabaseEngineRef.current.sessionId, 1);
    }
  }, [role, syncMode, handleStartSequence, checkSessionQuota, recordSessionUsage, subscription]);

  /**
   * 高精度tick関数
   */
  const tick = useCallback(() => {
    if (!startTime) return;

    const elapsed = precisionTimer.getElapsed();
    setElapsed(elapsed / 1000); // 秒単位

    // オーディオスケジューリング（1ms精度）
    const timeInPreRoll = elapsed - readyDuration * 1000;
    if (timeInPreRoll >= 0) {
      const remainingPreRoll = Math.ceil((preRollDuration * 1000 - timeInPreRoll) / 1000);
      if (remainingPreRoll > 0 && remainingPreRoll <= preRollDuration) {
        const key = `preroll-${remainingPreRoll}`;
        if (!eventTracker.current.has(key)) {
          if (settings.voiceCountdown) {
            // オーディオを正確な時刻にスケジュール
            const audioTime = startTime + readyDuration * 1000 + (preRollDuration - remainingPreRoll) * 1000;
            scheduleVoiceAudio(remainingPreRoll.toString(), audioTime);
          }
          eventTracker.current.add(key);
        }
      }
    }

    // ... 残りのロジック ...
  }, [startTime, settings, /* ... */]);

  // ... 残りのコード ...
};
```

## 📊 性能メトリクス

### 測定ポイント

```typescript
// services/metrics.ts

interface SyncMetrics {
  // 時刻同期
  timeOffset: number;      // サーバーとのオフセット（ms）
  timeOffsetStdDev: number; // オフセット標準偏差
  latency: number;         // RTT / 2 (ms)

  // オーディオ同期
  audioSchedulingError: number; // スケジューリング誤差（ms）
  audioActualError: number;     // 実際の再生誤差（ms）

  // ビジュアル同期
  frameDropRate: number;   // フレームドロップ率（%）
  rafJitter: number;       // RAF呼び出し間隔のジッター（ms）

  // ネットワーク
  wsLatency: number;       // WebSocketレイテンシ（ms）
  messageDeliveryTime: number; // メッセージ配信時間（ms）
}

class MetricsCollector {
  private metrics: SyncMetrics = {
    timeOffset: 0,
    timeOffsetStdDev: 0,
    latency: 0,
    audioSchedulingError: 0,
    audioActualError: 0,
    frameDropRate: 0,
    rafJitter: 0,
    wsLatency: 0,
    messageDeliveryTime: 0
  };

  updateTimeSync(offset: number, stdDev: number, latency: number) {
    this.metrics.timeOffset = offset;
    this.metrics.timeOffsetStdDev = stdDev;
    this.metrics.latency = latency;
  }

  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * メトリクスを可視化
   */
  logMetrics() {
    console.table(this.metrics);
  }
}

export const metrics = new MetricsCollector();
```

## 🧪 テスト計画

### 精度測定テスト

```typescript
// tests/precision-test.ts

async function measureSyncPrecision() {
  const engine = new SupabaseSyncEngine('test-device', 'CLIENT');

  // 100回のサンプリング
  const samples: number[] = [];

  for (let i = 0; i < 100; i++) {
    const t1 = performance.now();
    await engine.performTimeSync();
    const t2 = performance.now();

    samples.push(t2 - t1);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const stdDev = Math.sqrt(
    samples.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / samples.length
  );

  console.log('平均RTT:', avg.toFixed(2), 'ms');
  console.log('標準偏差:', stdDev.toFixed(2), 'ms');
  console.log('99%信頼区間:', `±${(stdDev * 2.576).toFixed(2)} ms`);
}
```

## 📋 実装チェックリスト

- [ ] **Phase 1: 時刻同期基盤**
  - [ ] NTP時刻同期サービス実装
  - [ ] 高精度タイマーサービス実装
  - [ ] 時刻同期品質メトリクス実装

- [ ] **Phase 2: オーディオ同期**
  - [ ] AudioContext同期実装
  - [ ] 高精度オーディオスケジューリング
  - [ ] オーディオ再生誤差測定

- [ ] **Phase 3: Supabase統合**
  - [ ] Supabaseクライアント設定
  - [ ] データベーステーブル作成
  - [ ] Realtime購読実装

- [ ] **Phase 4: Platform Core統合**
  - [ ] Clerk認証統合
  - [ ] クォータチェック実装
  - [ ] 使用量記録実装

- [ ] **Phase 5: テスト**
  - [ ] 精度測定テスト
  - [ ] クロスデバイステスト
  - [ ] 負荷テスト

## 🎯 期待される成果

| 項目 | 現在 | 目標 |
|-----|-----|-----|
| オーディオ同期精度 | ±50ms | ±1ms |
| ビジュアル同期精度 | ±50ms | ±8ms |
| 時刻同期精度 | 未実装 | ±2ms |
| 対応デバイス | 同一ブラウザ | 任意のデバイス |
| 認証 | なし | Clerk統合 |
| 課金管理 | なし | Platform Core統合 |

---

**作成日**: 2025-11-29
**バージョン**: 1.0.0
**ステータス**: 設計完了・実装待ち
