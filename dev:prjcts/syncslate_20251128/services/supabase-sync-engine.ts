/**
 * Supabase Sync Engine
 *
 * Supabase Realtimeを使用したクロスデバイス同期エンジン
 *
 * 機能:
 * - セッション作成/参加
 * - リアルタイム状態同期
 * - イベント送受信
 * - デバイス管理
 * - 自動再接続
 *
 * アーキテクチャ:
 * - Supabase Realtime Channels でイベント配信
 * - PostgreSQL triggers でサーバーサイド時刻記録
 * - 高精度時刻同期と組み合わせて ±1ms 精度を実現
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase-client';
import type {
  Role,
  Settings,
  SmartCue,
  ColorRange,
  SyncSession,
  SyncDevice,
  SyncEvent,
  SyncMessage,
  SyncStatePayload,
  CmdStartPayload,
  CmdStopPayload,
} from '../types/sync';

// ============================================================
// Types
// ============================================================

export interface SupabaseSyncEngineConfig {
  sessionId?: string;
  role: Role;
  deviceId: string;
  onMessage?: (message: SyncMessage) => void;
  onDeviceJoined?: (device: SyncDevice) => void;
  onDeviceLeft?: (deviceId: string) => void;
  onError?: (error: Error) => void;
}

export interface SessionInfo {
  id: string;
  hostId: string;
  settings: Settings;
  smartCues: SmartCue[];
  colorRanges: ColorRange[];
  deviceCount: number;
}

// ============================================================
// Supabase Sync Engine
// ============================================================

export class SupabaseSyncEngine {
  private config: SupabaseSyncEngineConfig;
  private channel: RealtimeChannel | null = null;
  private currentSession: SyncSession | null = null;
  private currentDevice: SyncDevice | null = null;
  private heartbeatInterval: number | null = null;
  private isConnected = false;

  constructor(config: SupabaseSyncEngineConfig) {
    this.config = config;
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * セッションを作成 (HOST用)
   */
  async createSession(
    settings: Settings,
    smartCues: SmartCue[],
    colorRanges: ColorRange[]
  ): Promise<SessionInfo> {
    try {
      const { data: session, error } = await supabase
        .from('sync_sessions')
        .insert({
          host_id: this.config.deviceId,
          settings,
          smart_cues: smartCues,
          color_ranges: colorRanges,
        })
        .select()
        .single();

      if (error) throw error;
      if (!session) throw new Error('Failed to create session');

      this.currentSession = session;

      // デバイスとして参加
      await this.joinSession(session.id);

      return {
        id: session.id,
        hostId: session.host_id,
        settings: session.settings,
        smartCues: session.smart_cues,
        colorRanges: session.color_ranges,
        deviceCount: 1,
      };
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * セッションに参加 (CLIENT用)
   */
  async joinSession(sessionId: string): Promise<SessionInfo> {
    try {
      // セッション情報を取得
      const { data: session, error: sessionError } = await supabase
        .from('sync_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      if (!session) throw new Error('Session not found');

      this.currentSession = session;

      // デバイスとして登録
      const { data: device, error: deviceError } = await supabase
        .from('sync_devices')
        .insert({
          session_id: sessionId,
          device_id: this.config.deviceId,
          role: this.config.role,
        })
        .select()
        .single();

      if (deviceError) throw deviceError;
      if (!device) throw new Error('Failed to join session');

      this.currentDevice = device;

      // Realtimeチャンネルに接続
      await this.subscribeToChannel(sessionId);

      // ハートビート開始
      this.startHeartbeat();

      // デバイス数を取得
      const { count } = await supabase
        .from('sync_devices')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      return {
        id: session.id,
        hostId: session.host_id,
        settings: session.settings,
        smartCues: session.smart_cues,
        colorRanges: session.color_ranges,
        deviceCount: count || 0,
      };
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * セッションから離脱
   */
  async leaveSession(): Promise<void> {
    try {
      // ハートビート停止
      this.stopHeartbeat();

      // デバイス削除
      if (this.currentDevice) {
        await supabase
          .from('sync_devices')
          .delete()
          .eq('id', this.currentDevice.id);
      }

      // チャンネル切断
      if (this.channel) {
        await supabase.removeChannel(this.channel);
        this.channel = null;
      }

      this.currentSession = null;
      this.currentDevice = null;
      this.isConnected = false;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * メッセージ送信
   */
  async sendMessage(message: SyncMessage): Promise<void> {
    if (!this.currentSession || !this.channel) {
      throw new Error('Not connected to a session');
    }

    try {
      // Realtime Broadcast で即座に配信
      await this.channel.send({
        type: 'broadcast',
        event: 'sync_message',
        payload: message,
      });

      // データベースに記録（サーバー時刻付き）
      await supabase.from('sync_events').insert({
        session_id: this.currentSession.id,
        event_type: message.type,
        payload: message.payload,
      });
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * セッション設定を更新 (HOST用)
   */
  async updateSession(
    settings: Settings,
    smartCues: SmartCue[],
    colorRanges: ColorRange[]
  ): Promise<void> {
    if (!this.currentSession) {
      throw new Error('Not connected to a session');
    }

    if (this.config.role !== 'HOST') {
      throw new Error('Only HOST can update session');
    }

    try {
      await supabase
        .from('sync_sessions')
        .update({
          settings,
          smart_cues: smartCues,
          color_ranges: colorRanges,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.currentSession.id);

      // SYNC_STATE メッセージを送信
      await this.sendMessage({
        type: 'SYNC_STATE',
        payload: { settings, smartCues, colorRanges },
      });
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * 接続状態を取得
   */
  isConnectedToSession(): boolean {
    return this.isConnected && this.currentSession !== null;
  }

  /**
   * 現在のセッション情報を取得
   */
  getCurrentSession(): SyncSession | null {
    return this.currentSession;
  }

  // ========================================
  // Private Methods
  // ========================================

  /**
   * Realtime チャンネルに接続
   */
  private async subscribeToChannel(sessionId: string): Promise<void> {
    const channelName = `session:${sessionId}`;

    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true }, // 自分のメッセージも受信
      },
    });

    // Broadcast メッセージ受信
    this.channel.on(
      'broadcast',
      { event: 'sync_message' },
      (payload: { payload: SyncMessage }) => {
        this.handleMessage(payload.payload);
      }
    );

    // デバイス参加通知
    this.channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'sync_devices',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const device = payload.new as SyncDevice;
        if (device.device_id !== this.config.deviceId) {
          this.config.onDeviceJoined?.(device);
        }
      }
    );

    // デバイス離脱通知
    this.channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'sync_devices',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const device = payload.old as SyncDevice;
        if (device.device_id !== this.config.deviceId) {
          this.config.onDeviceLeft?.(device.device_id);
        }
      }
    );

    // 接続状態監視
    this.channel.on('system', {}, (payload) => {
      if (payload.extension === 'postgres_changes') {
        if (payload.status === 'ok') {
          this.isConnected = true;
        } else {
          this.isConnected = false;
        }
      }
    });

    // 購読開始
    const subscribePromise = new Promise<void>((resolve, reject) => {
      this.channel!.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          console.log(`[SupabaseSyncEngine] Subscribed to channel: ${channelName}`);
          resolve();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isConnected = false;
          reject(new Error(`Failed to subscribe to channel: ${status}`));
        }
      });
    });

    await subscribePromise;
  }

  /**
   * メッセージ処理
   */
  private handleMessage(message: SyncMessage): void {
    console.log('[SupabaseSyncEngine] Received message:', message.type);
    this.config.onMessage?.(message);
  }

  /**
   * エラー処理
   */
  private handleError(error: Error): void {
    console.error('[SupabaseSyncEngine] Error:', error);
    this.config.onError?.(error);
  }

  /**
   * ハートビート開始（デバイスの生存確認）
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(async () => {
      if (this.currentDevice) {
        try {
          await supabase
            .from('sync_devices')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', this.currentDevice.id);
        } catch (error) {
          console.error('[SupabaseSyncEngine] Heartbeat failed:', error);
        }
      }
    }, 10000); // 10秒ごと
  }

  /**
   * ハートビート停止
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * UUID v4 を生成（RFC4122準拠）
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * デバイスIDを生成
 */
export function generateDeviceId(): string {
  const stored = localStorage.getItem('syncslate_device_id');
  if (stored) return stored;

  const deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem('syncslate_device_id', deviceId);
  return deviceId;
}

/**
 * セッションIDをURLから取得
 */
export function getSessionIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('session');
}
