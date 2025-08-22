/**
 * AutoEditTATE 音楽解析モジュール
 * 
 * 音楽ファイルの解析と編集点検出を行う
 * - 相対的ダイナミズムに基づく強度計算
 * - ビート・オンセット・セグメント検出
 * - 編集点候補の提案（柔軟性パラメータ付き）
 */

export { MusicAnalyzer } from './MusicAnalyzer.js';
export { RelativeConverter } from './RelativeConverter.js';
export { EditPointDetector } from './EditPointDetector.js';

// 型定義のエクスポート
export type {
  // 基本型
  Beat,
  Onset,
  TempoInfo,
  MusicSegment,
  EditPoint,
  
  // 特徴量
  SpectralFeatures,
  DynamicFeatures,
  RelativeDynamics,
  
  // 結果とオプション
  MusicAnalysisResult,
  MusicAnalysisOptions,
} from './types.js';