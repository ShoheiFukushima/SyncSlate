/**
 * AutoEditTATE 映像解析モジュール
 * 
 * 映像ファイルの解析とショット品質評価を行う
 * - ショット使用可能性判定（1秒/4秒ルール）
 * - 30%変化の法則によるトランジション検証
 * - ヒーローショット検出
 */

export { VideoAnalyzer } from './VideoAnalyzer.js';
export { ShotUsabilityChecker } from './ShotUsabilityChecker.js';
export { TransitionValidator } from './TransitionValidator.js';

// 型定義のエクスポート
export type {
  // 基本型
  Shot,
  Scene,
  Color,
  Motion,
  Face,
  
  // 品質・検証
  EdgeComplexity,
  TransitionValidation,
  FrameAnalysis,
  
  // 結果とオプション
  VideoAnalysisResult,
  VideoAnalysisOptions,
} from './types.js';