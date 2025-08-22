/**
 * 音楽解析の型定義
 */

// ビート情報
export interface Beat {
  time: number;        // ミリ秒
  strength: number;    // 0.0-1.0（相対強度）
  confidence: number;  // 0.0-1.0（検出確信度）
}

// オンセット（音の立ち上がり）情報
export interface Onset {
  time: number;        // ミリ秒
  strength: number;    // 0.0-1.0（相対強度）
  frequency: number;   // Hz
  type: 'percussive' | 'harmonic' | 'mixed';
}

// テンポ情報
export interface TempoInfo {
  bpm: number;         // BPM（参考値）
  confidence: number;  // 検出確信度
  variations: Array<{
    time: number;      // ミリ秒
    bpm: number;       // その時点でのBPM
  }>;
}

// 音楽セグメント（verse, chorus等）
export interface MusicSegment {
  type: 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'outro' | 'instrumental';
  startTime: number;   // ミリ秒
  endTime: number;     // ミリ秒
  confidence: number;  // 検出確信度
  energy: number;      // 0.0-1.0（相対エネルギー）
}

// スペクトル特徴
export interface SpectralFeatures {
  time: number;
  centroid: number;      // スペクトル重心
  spread: number;        // スペクトル広がり
  flux: number;          // スペクトル変化量
  rolloff: number;       // ロールオフ周波数
  flatness: number;      // スペクトル平坦性
  mfcc: number[];        // MFCC係数
  chroma: number[];      // クロマベクトル
}

// 動的特徴（時間変化する特徴）
export interface DynamicFeatures {
  time: number;
  rms: number;           // RMS（音量）
  zcr: number;           // ゼロ交差率
  energy: number;        // エネルギー
  loudness: number;      // ラウドネス（知覚音量）
}

// 編集点候補
export interface EditPoint {
  time: number;          // ミリ秒
  confidence: number;    // 0.0-1.0（推奨度）
  flexibility: number;   // ±ミリ秒（許容範囲）
  type: 'beat' | 'onset' | 'segment_boundary' | 'energy_peak' | 'silence';
  reason: string;        // 編集点とする理由
  musicalContext?: {
    isDownbeat: boolean; // ダウンビートか
    measurePosition: number; // 小節内の位置（0.0-1.0）
    phrasePosition: number;  // フレーズ内の位置（0.0-1.0）
  };
}

// 相対的ダイナミズム情報
export interface RelativeDynamics {
  time: number;
  intensity: number;      // 0.0-1.0（楽曲内相対強度）
  complexity: number;     // 0.0-1.0（楽曲内相対複雑性）
  variation: number;      // 0.0-1.0（楽曲内相対変化量）
  emotionalValence: number; // -1.0-1.0（感情価：ネガティブ〜ポジティブ）
  arousal: number;        // 0.0-1.0（覚醒度）
}

// 音楽解析結果
export interface MusicAnalysisResult {
  duration: number;               // 総時間（ミリ秒）
  tempo: TempoInfo;              // テンポ情報
  beats: Beat[];                 // ビート列
  onsets: Onset[];               // オンセット列
  segments: MusicSegment[];      // セグメント情報
  editPoints: EditPoint[];       // 編集点候補
  dynamics: RelativeDynamics[];  // 相対的ダイナミズム
  spectralFeatures: SpectralFeatures[]; // スペクトル特徴
  dynamicFeatures: DynamicFeatures[];   // 動的特徴
  
  // 統計情報（相対値計算用）
  statistics: {
    energy: { min: number; max: number; mean: number; std: number; };
    spectralCentroid: { min: number; max: number; mean: number; std: number; };
    loudness: { min: number; max: number; mean: number; std: number; };
  };
  
  // メタデータ
  metadata: {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    codec: string;
    key?: string;            // 調性（C, Am等）
    mode?: 'major' | 'minor';
    timeSignature?: string;   // 拍子（4/4等）
  };
}

// 解析オプション
export interface MusicAnalysisOptions {
  // 基本設定
  extractBeats: boolean;
  extractOnsets: boolean;
  extractTempo: boolean;
  extractSegments: boolean;
  extractSpectral: boolean;
  extractDynamic: boolean;
  
  // 詳細設定
  fftSize?: number;
  hopLength?: number;
  windowFunction?: 'hann' | 'hamming' | 'blackman';
  
  // 編集点検出設定
  editPointSensitivity?: number;  // 0.0-1.0（編集点検出の感度）
  minEditPointInterval?: number;  // 最小編集点間隔（ミリ秒）
  
  // パフォーマンス設定
  parallel?: boolean;
  cacheIntermediateResults?: boolean;
}