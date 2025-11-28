/**
 * SyncSlate - Type Definitions
 *
 * 共通の型定義を集約
 */

// ============================================================
// Core Types (from index.tsx)
// ============================================================

export type Mode = 'SETUP' | 'ARMED' | 'COUNTDOWN' | 'ENDED';
export type Direction = 'UP' | 'DOWN';
export type Theme = 'light' | 'dark';
export type FontType = 'hand' | 'sans' | 'gothic';
export type Role = 'HOST' | 'CLIENT';
export type VoiceLanguage = 'en' | 'jp' | 'fr' | 'de' | 'es' | 'ko';

export interface SmartCue {
  id: string;
  seconds: number;
  text: string;
}

export interface ColorRange {
  id: string;
  start: number;
  end: number;
  color: string;
  textColor: string;
}

export interface Settings {
  duration: number;
  preRoll: number;
  direction: Direction;
  hostId: string;
  voiceAction: boolean;
  voiceCut: boolean;
  voiceReady: boolean;
  voiceCountdown: boolean;
  voiceCount: boolean;
  voiceCountLimit: number;
  fontType: FontType;
  showArmed: boolean;
  armedText: string;
  voiceLanguage: VoiceLanguage;
}

// ============================================================
// Supabase Sync Types
// ============================================================

export interface SyncSession {
  id: string;
  host_id: string;
  created_at: string;
  updated_at: string;
  settings: Settings;
  smart_cues: SmartCue[];
  color_ranges: ColorRange[];
}

export interface SyncDevice {
  id: string;
  session_id: string;
  device_id: string;
  role: Role;
  connected_at: string;
  last_seen: string;
}

export interface SyncEvent {
  id: string;
  session_id: string;
  event_type: 'CMD_START' | 'CMD_STOP' | 'SYNC_STATE';
  payload: Record<string, any>;
  server_timestamp: string;
  created_at: string;
}

// ============================================================
// Time Sync Types
// ============================================================

export interface TimeSyncResult {
  offset: number;
  rtt: number;
  quality: 'excellent' | 'good' | 'poor';
  timestamp: number;
}

export interface PrecisionTimerState {
  isRunning: boolean;
  isPaused: boolean;
  elapsed: number;
  startTime: number | null;
}

export interface AudioSyncMetrics {
  schedulingError: number;
  contextTime: number;
  serverTime: number;
}

// ============================================================
// Platform Core Types
// ============================================================

export interface User {
  id: string;
  email: string;
  displayName?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'expired';
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface UsageQuota {
  sessionsPerMonth: number;
  concurrentDevices: number;
  storageMB: number;
  maxDurationMinutes: number;
}

export interface UsageRecord {
  sessionId: string;
  userId: string;
  duration: number;
  deviceCount: number;
  timestamp: string;
}

export interface PlatformCoreConfig {
  baseUrl: string;
  clerkPublishableKey: string;
  enabled: boolean;
}

// ============================================================
// Sync Engine Types
// ============================================================

export type SyncMode = 'broadcast' | 'supabase';

export interface SyncEngineConfig {
  mode: SyncMode;
  sessionId?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface SyncStatePayload {
  settings: Settings;
  smartCues: SmartCue[];
  colorRanges: ColorRange[];
}

export interface CmdStartPayload {
  startTime: number;
}

export interface CmdStopPayload {
  manual: boolean;
}

export type SyncMessage =
  | { type: 'SYNC_STATE'; payload: SyncStatePayload }
  | { type: 'CMD_START'; payload: CmdStartPayload }
  | { type: 'CMD_STOP'; payload: CmdStopPayload };
