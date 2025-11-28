/**
 * Supabase クライアント
 *
 * Supabase Realtimeを使用したクロスデバイス同期の基盤
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.warn('[Supabase] VITE_SUPABASE_URLが設定されていません。Supabase機能は無効化されます。');
}

if (!supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_ANON_KEYが設定されていません。Supabase機能は無効化されます。');
}

// Supabaseクライアント（環境変数が設定されている場合のみ作成）
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/**
 * Supabaseが利用可能かチェック
 */
export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}

// データベース型定義

/**
 * セッションテーブル
 */
export interface Session {
  id: string;
  host_id: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  server_time?: number; // サーバー時刻参照用
}

/**
 * 同期イベントテーブル
 */
export interface SyncEvent {
  id: number;
  session_id: string;
  event_type: 'CMD_START' | 'CMD_STOP' | 'SYNC_STATE' | 'TIME_SYNC';
  payload: any;
  server_time: number; // サーバー側で記録された時刻
  created_at: string;
}

/**
 * デバイステーブル
 */
export interface Device {
  id: string;
  session_id: string;
  role: 'HOST' | 'CLIENT';
  user_agent: string;
  last_ping: string;
  time_offset: number; // サーバーとの時刻オフセット（ms）
  latency: number;     // RTT / 2 (ms)
}

/**
 * Database型定義（Supabase生成用）
 */
export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: Session;
        Insert: Omit<Session, 'id' | 'created_at' | 'expires_at'> & {
          id?: string;
          created_at?: string;
          expires_at?: string;
        };
        Update: Partial<Session>;
      };
      sync_events: {
        Row: SyncEvent;
        Insert: Omit<SyncEvent, 'id' | 'created_at'> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<SyncEvent>;
      };
      devices: {
        Row: Device;
        Insert: Omit<Device, 'last_ping'> & {
          last_ping?: string;
        };
        Update: Partial<Device>;
      };
    };
  };
}

/**
 * Supabase セットアップガイド
 *
 * 1. Supabaseプロジェクト作成: https://supabase.com
 * 2. 以下のSQLを実行してテーブルを作成:
 *
 * ```sql
 * -- セッションテーブル
 * CREATE TABLE sessions (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   host_id TEXT NOT NULL UNIQUE,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
 *   is_active BOOLEAN DEFAULT true,
 *   server_time BIGINT
 * );
 *
 * CREATE INDEX idx_sessions_expires ON sessions(expires_at);
 * CREATE INDEX idx_sessions_active ON sessions(is_active);
 *
 * -- 同期イベントテーブル
 * CREATE TABLE sync_events (
 *   id BIGSERIAL PRIMARY KEY,
 *   session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
 *   event_type TEXT NOT NULL,
 *   payload JSONB NOT NULL,
 *   server_time BIGINT NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE INDEX idx_sync_events_session ON sync_events(session_id, created_at DESC);
 *
 * -- デバイステーブル
 * CREATE TABLE devices (
 *   id TEXT PRIMARY KEY,
 *   session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
 *   role TEXT NOT NULL,
 *   user_agent TEXT,
 *   last_ping TIMESTAMPTZ DEFAULT NOW(),
 *   time_offset NUMERIC(10, 2) DEFAULT 0,
 *   latency NUMERIC(10, 2) DEFAULT 0
 * );
 *
 * CREATE INDEX idx_devices_session ON devices(session_id);
 * CREATE INDEX idx_devices_ping ON devices(last_ping);
 *
 * -- Row Level Security (RLS)
 * ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public read" ON sessions FOR SELECT USING (true);
 * CREATE POLICY "Allow public insert" ON sessions FOR INSERT WITH CHECK (true);
 * CREATE POLICY "Allow public update" ON sessions FOR UPDATE USING (true);
 *
 * ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public read" ON sync_events FOR SELECT USING (true);
 * CREATE POLICY "Allow public insert" ON sync_events FOR INSERT WITH CHECK (true);
 *
 * ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public read" ON devices FOR SELECT USING (true);
 * CREATE POLICY "Allow public insert" ON devices FOR INSERT WITH CHECK (true);
 * CREATE POLICY "Allow public update" ON devices FOR UPDATE USING (true);
 *
 * -- 自動削除トリガー（24時間後）
 * CREATE OR REPLACE FUNCTION delete_expired_sessions()
 * RETURNS trigger AS $$
 * BEGIN
 *   DELETE FROM sessions WHERE expires_at < NOW();
 *   RETURN NULL;
 * END;
 * $$ LANGUAGE plpgsql;
 *
 * CREATE TRIGGER trigger_delete_expired_sessions
 *   AFTER INSERT OR UPDATE ON sessions
 *   EXECUTE FUNCTION delete_expired_sessions();
 * ```
 *
 * 3. 環境変数を.env.localに設定:
 * ```
 * VITE_SUPABASE_URL=https://xxxxx.supabase.co
 * VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * ```
 */
