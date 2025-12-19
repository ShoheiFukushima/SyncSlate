/**
 * SMART CUES 型定義
 *
 * Phase 1: 基本型定義
 * - SmartCue: CUEの基本型
 * - AudioType: 音声タイプ
 * - Session: セッション型
 */

/**
 * 音声タイプの列挙型
 */
export type AudioType = 'number' | 'text' | 'gunshot' | 'phone' | 'custom';

/**
 * SMART CUEの基本型定義
 */
export interface SmartCue {
  /** 一意識別子 (UUID v4) */
  id: string;

  /** タイムスタンプ(秒単位、0始まり) */
  timestamp: number;

  /** 音声タイプ */
  audioType: AudioType;

  /** テキスト読み上げ用(audioType='text'の場合) */
  text?: string;

  /** 電話コール回数(audioType='phone'の場合、1-10) */
  phoneRings?: number;

  /** カスタム音声URL(audioType='custom'の場合、Base64 data URL) */
  customAudioUrl?: string;

  /** カスタム音声の長さ(秒単位) */
  customAudioDuration?: number;

  /** カスタム音声のファイル名 */
  customAudioFilename?: string;

  /** 作成日時(ISO 8601) */
  createdAt: string;

  /** 最終更新日時(ISO 8601) */
  updatedAt: string;
}

/**
 * 音声タイプのメタデータ
 */
export interface AudioTypeMetadata {
  type: AudioType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

/**
 * 音声タイプメタデータの定義
 */
export const AUDIO_TYPE_METADATA: Record<AudioType, AudioTypeMetadata> = {
  number: {
    type: 'number',
    label: '数字',
    icon: '🔢',
    color: '#6B7280',
    description: '通常のカウント数字を読み上げ',
  },
  text: {
    type: 'text',
    label: 'テキスト',
    icon: '📝',
    color: '#8B5CF6',
    description: '指定したテキストを読み上げ(最大0.8秒)',
  },
  gunshot: {
    type: 'gunshot',
    label: '鉄砲',
    icon: '🔫',
    color: '#DC2626',
    description: '銃声効果音を再生',
  },
  phone: {
    type: 'phone',
    label: '電話コール',
    icon: '📞',
    color: '#059669',
    description: '電話のコール音を指定回数再生',
  },
  custom: {
    type: 'custom',
    label: 'カスタム音声',
    icon: '🎵',
    color: '#EA580C',
    description: 'アップロードした音声ファイルを再生',
  },
};

/**
 * セッション設定
 */
export interface SessionConfig {
  /** シーケンス長(秒単位) */
  sequenceDuration: number;

  /** Pre-roll時間(秒単位) */
  preRollDuration: number;

  /** ビープ音の有効/無効 */
  beepEnabled: boolean;

  /** カウント音声の有効/無効 */
  countVoiceEnabled: boolean;

  /** SMART CUESの有効/無効 */
  smartCuesEnabled: boolean;
}

/**
 * セッション(撮影テイク)の型定義
 */
export interface Session {
  /** セッションID(例: "session_20250112_001") */
  id: string;

  /** セッション名(ユーザーが編集可能) */
  name: string;

  /** シーン番号 */
  sceneNumber?: string;

  /** テイク番号 */
  takeNumber?: number;

  /** セッションに関連するCUE一覧 */
  smartCues: SmartCue[];

  /** セッション設定 */
  config: SessionConfig;

  /** 作成日時(ISO 8601) */
  createdAt: string;

  /** 最終更新日時(ISO 8601) */
  updatedAt: string;
}

/**
 * アプリケーション設定
 */
export interface AppSettings {
  /** Gemini APIキー */
  geminiApiKey?: string;

  /** デフォルトのシーケンス長 */
  defaultSequenceDuration: number;

  /** デフォルトのPre-roll時間 */
  defaultPreRollDuration: number;

  /** テーマ(light/dark) */
  theme: 'light' | 'dark';

  /** 言語 */
  language: 'ja' | 'en';
}

/**
 * LocalStorageに保存されるデータ構造
 */
export interface SyncSlateStorage {
  /** 現在のセッションID */
  currentSessionId: string | null;

  /** すべてのセッション */
  sessions: Session[];

  /** アプリケーション設定 */
  appSettings: AppSettings;

  /** バージョン番号(マイグレーション用) */
  version: string;
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
