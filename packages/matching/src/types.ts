/**
 * マッチングエンジンの型定義
 */

import type { 
  EditPoint, 
  RelativeDynamics,
  MusicAnalysisResult 
} from '@autoedittate/music-analysis';
import type { 
  Shot, 
  TransitionValidation,
  VideoAnalysisResult 
} from '@autoedittate/video-analysis';
import type { SegmentWeights } from '@autoedittate/config';

// 編集決定
export interface EditDecision {
  id: string;
  time: number;                    // 編集タイミング（ミリ秒）
  shot: Shot;                      // 使用するショット
  inPoint: number;                 // ショット内の開始点
  outPoint: number;                // ショット内の終了点
  duration: number;                // 使用時間
  
  // 決定理由
  confidence: number;              // 0.0-1.0（決定の確信度）
  flexibility: number;             // ±ミリ秒（調整可能範囲）
  scores: {
    visual: number;               // 視覚スコア
    sync: number;                 // 同期スコア
    semantic: number;             // 意味的スコア
    stability: number;            // 安定性スコア
    overall: number;              // 総合スコア
  };
  
  // マッチング詳細
  matchingDetails: {
    segmentName: string;          // セグメント名（opening, development等）
    weights: SegmentWeights;      // 適用された重み
    editPoint?: EditPoint;        // 対応する編集点
    musicalContext?: {
      isDownbeat: boolean;
      measurePosition: number;
      phrasePosition: number;
    };
  };
  
  // トランジション情報
  transition?: {
    fromShot?: Shot;
    validation: TransitionValidation;
    improvement?: string;         // 改善提案
  };
}

// 編集パターン
export interface EditPattern {
  name: 'dynamic_cut' | 'narrative_flow' | 'hybrid_balance';
  description: string;
  decisions: EditDecision[];
  
  // パターン評価
  evaluation: {
    aggregateConfidence: number;  // 全体の確信度（>= 0.88必須）
    avgShotDuration: number;      // 平均ショット長
    cutFrequency: number;         // カット頻度（カット/秒）
    transitionQuality: number;    // トランジション品質
    musicalAlignment: number;     // 音楽同期度
    visualFlow: number;           // 視覚的流れ
    narrativeCohesion: number;    // 物語的一貫性
  };
  
  // セグメントごとの評価
  segmentEvaluations: Array<{
    segmentName: string;
    startTime: number;
    endTime: number;
    score: number;
    issues: string[];
  }>;
}

// マッチング結果
export interface MatchingResult {
  patterns: {
    dynamicCut: EditPattern;
    narrativeFlow: EditPattern;
    hybridBalance: EditPattern;
  };
  
  // 推奨パターン
  recommendedPattern: 'dynamic_cut' | 'narrative_flow' | 'hybrid_balance';
  recommendationReason: string;
  
  // 全体評価
  overallQuality: {
    score: number;                // 0.0-1.0
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
  
  // explain.json用データ
  explainData: ExplainData;
}

// explain.json形式
export interface ExplainData {
  version: string;
  timestamp: string;
  aggregateConfidence: number;      // >= 0.88
  
  decisions: Array<{
    id: string;
    time: number;
    shot: string;
    confidence: number;
    reason: string;
    scores: Record<string, number>;
    context: Record<string, any>;
  }>;
  
  qualityMetrics: {
    musicSync: number;
    visualFlow: number;
    narrativeCoherence: number;
    technicalQuality: number;
    thirtyPercentCompliance: number;
  };
  
  segmentAnalysis: Array<{
    segment: string;
    timeRange: [number, number];
    appliedWeights: SegmentWeights;
    performance: {
      targetScore: number;
      actualScore: number;
      gap: number;
    };
  }>;
  
  statistics: {
    totalDecisions: number;
    avgConfidence: number;
    avgFlexibility: number;
    shotUsage: Record<string, number>;
    editPointTypes: Record<string, number>;
  };
}

// マッチングオプション
export interface MatchingOptions {
  // 基本設定
  minConfidence?: number;          // 最小確信度（デフォルト: 0.5）
  maxFlexibility?: number;         // 最大柔軟性（デフォルト: 100ms）
  
  // 最適化設定
  optimizationMethod?: 'greedy' | 'dynamic_programming' | 'genetic';
  iterations?: number;
  convergenceThreshold?: number;
  
  // パターン固有の調整
  patternModifiers?: {
    dynamicCut?: Partial<SegmentWeights>;
    narrativeFlow?: Partial<SegmentWeights>;
    hybridBalance?: Partial<SegmentWeights>;
  };
  
  // 制約
  constraints?: {
    minShotDuration?: number;      // 最小ショット長
    maxShotDuration?: number;      // 最大ショット長
    maxConsecutiveSameShot?: number; // 同一ショット連続使用上限
    requireHeroShotInOpening?: boolean;
  };
  
  // デバッグ
  verbose?: boolean;
  explainDetails?: boolean;
}