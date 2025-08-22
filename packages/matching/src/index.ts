/**
 * AutoEditTATE マッチングエンジン
 * 
 * 時間軸別戦略による音楽と映像の最適マッチング
 * - 相対的ダイナミズムに基づく評価
 * - 3パターン生成（dynamic_cut, narrative_flow, hybrid_balance）
 * - aggregateConfidence >= 0.88の品質保証
 */

export { TimeBasedMatchingEngine } from './TimeBasedMatchingEngine.js';
export { SegmentTransitionManager } from './SegmentTransitionManager.js';
export { PatternIntegrator } from './PatternIntegrator.js';

// 型定義のエクスポート
export type {
  // 編集決定
  EditDecision,
  EditPattern,
  MatchingResult,
  ExplainData,
  
  // オプション
  MatchingOptions,
} from './types.js';