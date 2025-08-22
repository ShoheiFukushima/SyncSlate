/**
 * AutoEditTATE 設定管理モジュール
 * 
 * このモジュールは以下の機能を提供:
 * - YAML設定ファイルの読み込みとバリデーション
 * - 時間軸別マッチング戦略の管理
 * - 動的な設定調整
 * - 開発環境でのホットリロード
 */

export { ConfigLoader } from './ConfigLoader.js';
export { SegmentValidator } from './validators/SegmentValidator.js';
export { AnalysisValidator } from './validators/AnalysisValidator.js';

// 型定義のエクスポート
export type {
  // セグメント関連
  Segment,
  SegmentWeights,
  SegmentConstraints,
  Adjustment,
  TransitionRules,
  MatchingSegmentsConfig,
  
  // 解析設定関連
  MusicAnalysisConfig,
  VideoAnalysisConfig,
  Pattern,
  AnalysisSettingsConfig,
} from './types.js';

// ユーティリティ関数
export { ConfigUtils } from './utils/ConfigUtils.js';

// デフォルト設定ローダーのインスタンス
import { ConfigLoader } from './ConfigLoader.js';
export const defaultConfigLoader = ConfigLoader.getInstance();