import type { 
  Segment, 
  SegmentWeights 
} from '@autoedittate/config';
import { ConfigUtils } from '@autoedittate/config';
import type { EditDecision } from './types.js';

/**
 * セグメント遷移マネージャー
 * セグメント間の滑らかな遷移を管理
 */
export class SegmentTransitionManager {
  private readonly transitionDuration: number = 500; // デフォルト500ms
  
  /**
   * セグメント境界での遷移を処理
   */
  public handleSegmentTransition(
    fromSegment: Segment,
    toSegment: Segment,
    decisions: EditDecision[],
    boundaryTime: number
  ): EditDecision[] {
    // 境界付近の決定を取得
    const transitionWindow = this.transitionDuration;
    const affectedDecisions = decisions.filter(d =>
      d.time >= boundaryTime - transitionWindow &&
      d.time <= boundaryTime + transitionWindow
    );
    
    if (affectedDecisions.length === 0) {
      return decisions;
    }
    
    // 遷移重みを計算
    const transitionWeights = ConfigUtils.smoothSegmentTransition(
      fromSegment,
      toSegment,
      this.transitionDuration
    );
    
    // 影響を受ける決定に遷移重みを適用
    for (const decision of affectedDecisions) {
      const relativePosition = (decision.time - (boundaryTime - transitionWindow)) / 
                               (2 * transitionWindow);
      const weightIndex = Math.floor(relativePosition * transitionWeights.weights.length);
      
      if (weightIndex >= 0 && weightIndex < transitionWeights.weights.length) {
        // 遷移重みで更新
        decision.matchingDetails.weights = transitionWeights.weights[weightIndex];
        
        // スコアを再計算
        this.recalculateScores(decision);
      }
    }
    
    return decisions;
  }
  
  /**
   * セグメント間のギャップを埋める
   */
  public fillSegmentGaps(
    decisions: EditDecision[],
    segments: Array<{ name: string; startTime: number; endTime: number }>
  ): EditDecision[] {
    const filled: EditDecision[] = [...decisions];
    
    for (let i = 0; i < segments.length - 1; i++) {
      const currentEnd = segments[i].endTime;
      const nextStart = segments[i + 1].startTime;
      
      if (nextStart - currentEnd > 100) { // 100ms以上のギャップ
        // ギャップを埋める決定を生成
        const gapDecision = this.createGapFiller(
          currentEnd,
          nextStart,
          decisions
        );
        
        if (gapDecision) {
          filled.push(gapDecision);
        }
      }
    }
    
    // 時間順にソート
    filled.sort((a, b) => a.time - b.time);
    
    return filled;
  }
  
  /**
   * セグメント特有の調整を適用
   */
  public applySegmentSpecificAdjustments(
    decision: EditDecision,
    segmentName: string
  ): EditDecision {
    switch (segmentName) {
      case 'opening':
        return this.adjustForOpening(decision);
        
      case 'climax':
        return this.adjustForClimax(decision);
        
      case 'ending':
        return this.adjustForEnding(decision);
        
      default:
        return decision;
    }
  }
  
  /**
   * オープニング用の調整
   */
  private adjustForOpening(decision: EditDecision): EditDecision {
    // ヒーローショットを優先
    if (decision.shot.isHeroShot) {
      decision.confidence = Math.min(1.0, decision.confidence * 1.2);
      decision.scores.visual = Math.min(1.0, decision.scores.visual * 1.3);
    }
    
    // 長めのショットを推奨
    if (decision.duration < 2000) {
      decision.confidence *= 0.8;
    }
    
    return decision;
  }
  
  /**
   * クライマックス用の調整
   */
  private adjustForClimax(decision: EditDecision): EditDecision {
    // リズム同期を強化
    if (decision.matchingDetails.editPoint?.type === 'beat') {
      decision.confidence = Math.min(1.0, decision.confidence * 1.15);
      decision.scores.sync = Math.min(1.0, decision.scores.sync * 1.2);
    }
    
    // 短いカットを許可
    if (decision.duration > 500 && decision.duration < 1500) {
      decision.confidence = Math.min(1.0, decision.confidence * 1.1);
    }
    
    return decision;
  }
  
  /**
   * エンディング用の調整
   */
  private adjustForEnding(decision: EditDecision): EditDecision {
    // 安定性を重視
    decision.scores.stability = Math.min(1.0, decision.scores.stability * 1.3);
    
    // 長めのショットを推奨
    if (decision.duration > 3000) {
      decision.confidence = Math.min(1.0, decision.confidence * 1.1);
    }
    
    // フェードアウトオプション
    if (decision.time + decision.duration >= 58000) { // 最後の2秒
      decision.flexibility = 200; // 柔軟性を高める
    }
    
    return decision;
  }
  
  /**
   * ギャップフィラーを作成
   */
  private createGapFiller(
    startTime: number,
    endTime: number,
    existingDecisions: EditDecision[]
  ): EditDecision | null {
    // 前後の決定から適切なショットを選択
    const prevDecision = existingDecisions
      .filter(d => d.time < startTime)
      .sort((a, b) => b.time - a.time)[0];
    
    const nextDecision = existingDecisions
      .filter(d => d.time >= endTime)
      .sort((a, b) => a.time - b.time)[0];
    
    if (!prevDecision && !nextDecision) {
      return null;
    }
    
    // 前の決定のショットを延長するか、次の決定のショットを前倒し
    const sourceDecision = prevDecision || nextDecision;
    
    return {
      ...sourceDecision,
      id: `gap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      time: startTime,
      duration: endTime - startTime,
      confidence: sourceDecision.confidence * 0.7, // 確信度を下げる
      matchingDetails: {
        ...sourceDecision.matchingDetails,
        segmentName: 'transition',
      },
    };
  }
  
  /**
   * スコアを再計算
   */
  private recalculateScores(decision: EditDecision): void {
    const weights = decision.matchingDetails.weights;
    
    // 重み付き総合スコアを再計算
    decision.scores.overall = 
      decision.scores.visual * weights.visual +
      decision.scores.sync * weights.sync +
      decision.scores.semantic * weights.semantic +
      decision.scores.stability * weights.stability;
  }
  
  /**
   * セグメント遷移の品質を評価
   */
  public evaluateTransitionQuality(
    decisions: EditDecision[],
    segments: Array<{ name: string; startTime: number; endTime: number }>
  ): Array<{
    from: string;
    to: string;
    time: number;
    quality: number;
    issues: string[];
  }> {
    const evaluations: Array<{
      from: string;
      to: string;
      time: number;
      quality: number;
      issues: string[];
    }> = [];
    
    for (let i = 0; i < segments.length - 1; i++) {
      const fromSegment = segments[i];
      const toSegment = segments[i + 1];
      const boundaryTime = fromSegment.endTime;
      
      const issues: string[] = [];
      let quality = 1.0;
      
      // 境界付近の決定を確認
      const nearBoundary = decisions.filter(d =>
        Math.abs(d.time - boundaryTime) < 500
      );
      
      if (nearBoundary.length === 0) {
        issues.push('No decisions near segment boundary');
        quality *= 0.5;
      } else {
        // 境界での急激な変化をチェック
        const before = nearBoundary.filter(d => d.time < boundaryTime);
        const after = nearBoundary.filter(d => d.time >= boundaryTime);
        
        if (before.length > 0 && after.length > 0) {
          const lastBefore = before[before.length - 1];
          const firstAfter = after[0];
          
          // ショットの変化
          if (lastBefore.shot.id === firstAfter.shot.id) {
            issues.push('Same shot across segment boundary');
            quality *= 0.8;
          }
          
          // 確信度の急激な変化
          const confidenceDiff = Math.abs(
            lastBefore.confidence - firstAfter.confidence
          );
          if (confidenceDiff > 0.3) {
            issues.push('Large confidence change at boundary');
            quality *= 0.9;
          }
        }
      }
      
      evaluations.push({
        from: fromSegment.name,
        to: toSegment.name,
        time: boundaryTime,
        quality,
        issues,
      });
    }
    
    return evaluations;
  }
}