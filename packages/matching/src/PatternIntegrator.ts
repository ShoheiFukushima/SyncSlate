import type { 
  EditDecision, 
  EditPattern,
  ExplainData 
} from './types.js';

/**
 * パターン統合器
 * 複数のパターンを統合・最適化
 */
export class PatternIntegrator {
  /**
   * パターンを統合して最適な編集列を生成
   */
  public integratePatterns(
    patterns: EditPattern[],
    weights?: { [patternName: string]: number }
  ): EditDecision[] {
    // デフォルトの重み
    const patternWeights = {
      dynamic_cut: 0.33,
      narrative_flow: 0.33,
      hybrid_balance: 0.34,
      ...weights,
    };
    
    // 各パターンの決定を時間でグループ化
    const timeGroups = this.groupDecisionsByTime(patterns);
    
    // 各時間点で最適な決定を選択
    const integrated: EditDecision[] = [];
    
    for (const [time, decisions] of timeGroups.entries()) {
      const bestDecision = this.selectBestDecision(
        decisions,
        patternWeights
      );
      
      if (bestDecision) {
        integrated.push(bestDecision);
      }
    }
    
    // 時間順にソート
    integrated.sort((a, b) => a.time - b.time);
    
    // 重複や競合を解決
    return this.resolveConflicts(integrated);
  }
  
  /**
   * パターン間の差異を分析
   */
  public analyzePatternDifferences(
    patterns: EditPattern[]
  ): {
    similarity: number;
    differences: Array<{
      time: number;
      patterns: string[];
      reason: string;
    }>;
    consensus: EditDecision[];
  } {
    const allDecisions = patterns.flatMap(p => 
      p.decisions.map(d => ({ ...d, patternName: p.name }))
    );
    
    // 時間でグループ化
    const timeGroups = new Map<number, any[]>();
    for (const decision of allDecisions) {
      const timeKey = Math.floor(decision.time / 100) * 100; // 100ms単位で丸める
      const group = timeGroups.get(timeKey) || [];
      group.push(decision);
      timeGroups.set(timeKey, group);
    }
    
    // 差異を特定
    const differences: Array<{
      time: number;
      patterns: string[];
      reason: string;
    }> = [];
    
    const consensus: EditDecision[] = [];
    let agreementCount = 0;
    
    for (const [time, decisions] of timeGroups.entries()) {
      const patternNames = [...new Set(decisions.map(d => d.patternName))];
      
      if (patternNames.length === patterns.length) {
        // 全パターンが同じ時間に決定を持つ
        const shots = [...new Set(decisions.map(d => d.shot.id))];
        
        if (shots.length === 1) {
          // 全パターンが同じショットを選択
          agreementCount++;
          consensus.push(decisions[0]);
        } else {
          differences.push({
            time,
            patterns: patternNames,
            reason: `Different shots selected: ${shots.join(', ')}`,
          });
        }
      } else {
        differences.push({
          time,
          patterns: patternNames,
          reason: `Not all patterns have decision at this time`,
        });
      }
    }
    
    const similarity = timeGroups.size > 0 ? 
      agreementCount / timeGroups.size : 0;
    
    return {
      similarity,
      differences,
      consensus,
    };
  }
  
  /**
   * パターンをマージ
   */
  public mergePatterns(
    primary: EditPattern,
    secondary: EditPattern,
    mergeRatio: number = 0.5
  ): EditPattern {
    const merged: EditDecision[] = [];
    
    // プライマリパターンの決定を基準に
    for (const primaryDecision of primary.decisions) {
      // 対応する二次パターンの決定を探す
      const secondaryDecision = this.findClosestDecision(
        primaryDecision,
        secondary.decisions
      );
      
      if (secondaryDecision && Math.random() < mergeRatio) {
        // 二次パターンの決定を採用
        merged.push(this.blendDecisions(primaryDecision, secondaryDecision, mergeRatio));
      } else {
        // プライマリパターンの決定を維持
        merged.push(primaryDecision);
      }
    }
    
    // 二次パターンのみにある決定も考慮
    for (const secondaryDecision of secondary.decisions) {
      const hasMatch = merged.some(d => 
        Math.abs(d.time - secondaryDecision.time) < 100
      );
      
      if (!hasMatch && Math.random() < mergeRatio * 0.5) {
        merged.push(secondaryDecision);
      }
    }
    
    // 時間順にソート
    merged.sort((a, b) => a.time - b.time);
    
    return {
      name: 'hybrid_balance',
      description: `Merged pattern (${primary.name} + ${secondary.name})`,
      decisions: merged,
      evaluation: this.evaluateMergedPattern(merged),
      segmentEvaluations: [],
    };
  }
  
  /**
   * 時間でグループ化
   */
  private groupDecisionsByTime(
    patterns: EditPattern[]
  ): Map<number, Array<{ decision: EditDecision; pattern: string; weight: number }>> {
    const groups = new Map<number, Array<{ 
      decision: EditDecision; 
      pattern: string; 
      weight: number;
    }>>();
    
    for (const pattern of patterns) {
      for (const decision of pattern.decisions) {
        const timeKey = Math.floor(decision.time / 100) * 100;
        const group = groups.get(timeKey) || [];
        
        group.push({
          decision,
          pattern: pattern.name,
          weight: pattern.evaluation.aggregateConfidence,
        });
        
        groups.set(timeKey, group);
      }
    }
    
    return groups;
  }
  
  /**
   * 最適な決定を選択
   */
  private selectBestDecision(
    candidates: Array<{ decision: EditDecision; pattern: string; weight: number }>,
    patternWeights: { [key: string]: number }
  ): EditDecision | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].decision;
    
    // スコアを計算
    let bestScore = -Infinity;
    let bestCandidate = candidates[0];
    
    for (const candidate of candidates) {
      const patternWeight = patternWeights[candidate.pattern] || 0.33;
      const score = 
        candidate.decision.confidence * 0.4 +
        candidate.decision.scores.overall * 0.3 +
        candidate.weight * 0.2 +
        patternWeight * 0.1;
      
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }
    
    return bestCandidate.decision;
  }
  
  /**
   * 競合を解決
   */
  private resolveConflicts(decisions: EditDecision[]): EditDecision[] {
    const resolved: EditDecision[] = [];
    let lastEndTime = -Infinity;
    
    for (const decision of decisions) {
      // 重複チェック
      if (decision.time >= lastEndTime) {
        resolved.push(decision);
        lastEndTime = decision.time + decision.duration;
      } else {
        // 重複がある場合、より確信度の高い方を選択
        const overlapping = resolved[resolved.length - 1];
        
        if (decision.confidence > overlapping.confidence) {
          // 前の決定を短縮
          overlapping.duration = Math.max(
            500, // 最小500ms
            decision.time - overlapping.time
          );
          overlapping.outPoint = overlapping.inPoint + overlapping.duration;
          
          resolved.push(decision);
          lastEndTime = decision.time + decision.duration;
        }
      }
    }
    
    return resolved;
  }
  
  /**
   * 最も近い決定を見つける
   */
  private findClosestDecision(
    target: EditDecision,
    candidates: EditDecision[]
  ): EditDecision | null {
    let minDistance = Infinity;
    let closest: EditDecision | null = null;
    
    for (const candidate of candidates) {
      const distance = Math.abs(candidate.time - target.time);
      
      if (distance < minDistance && distance < 500) { // 500ms以内
        minDistance = distance;
        closest = candidate;
      }
    }
    
    return closest;
  }
  
  /**
   * 決定をブレンド
   */
  private blendDecisions(
    primary: EditDecision,
    secondary: EditDecision,
    ratio: number
  ): EditDecision {
    return {
      ...primary,
      confidence: primary.confidence * (1 - ratio) + secondary.confidence * ratio,
      scores: {
        visual: primary.scores.visual * (1 - ratio) + secondary.scores.visual * ratio,
        sync: primary.scores.sync * (1 - ratio) + secondary.scores.sync * ratio,
        semantic: primary.scores.semantic * (1 - ratio) + secondary.scores.semantic * ratio,
        stability: primary.scores.stability * (1 - ratio) + secondary.scores.stability * ratio,
        overall: primary.scores.overall * (1 - ratio) + secondary.scores.overall * ratio,
      },
      shot: ratio > 0.5 ? secondary.shot : primary.shot,
    };
  }
  
  /**
   * マージされたパターンを評価
   */
  private evaluateMergedPattern(decisions: EditDecision[]): EditPattern['evaluation'] {
    const aggregateConfidence = decisions.length > 0 ?
      decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length : 0;
    
    const avgShotDuration = decisions.length > 0 ?
      decisions.reduce((sum, d) => sum + d.duration, 0) / decisions.length : 0;
    
    const cutFrequency = decisions.length / 60; // 60秒想定
    
    // 簡易評価
    return {
      aggregateConfidence,
      avgShotDuration,
      cutFrequency,
      transitionQuality: 0.8,
      musicalAlignment: 0.7,
      visualFlow: 0.75,
      narrativeCohesion: 0.7,
    };
  }
  
  /**
   * 改善提案を生成
   */
  public generateImprovementSuggestions(
    pattern: EditPattern
  ): string[] {
    const suggestions: string[] = [];
    
    // 確信度が低い場合
    if (pattern.evaluation.aggregateConfidence < 0.7) {
      suggestions.push('Consider adjusting edit point detection sensitivity');
      suggestions.push('Review shot quality thresholds');
    }
    
    // トランジション品質が低い場合
    if (pattern.evaluation.transitionQuality < 0.6) {
      suggestions.push('Increase shot variety to meet 30% change rule');
      suggestions.push('Consider using more diverse camera angles');
    }
    
    // 音楽同期が弱い場合
    if (pattern.evaluation.musicalAlignment < 0.5) {
      suggestions.push('Improve beat detection accuracy');
      suggestions.push('Consider manual beat marking for complex sections');
    }
    
    // カット頻度の問題
    if (pattern.evaluation.cutFrequency < 0.5) {
      suggestions.push('Cuts may be too sparse - consider adding more edit points');
    } else if (pattern.evaluation.cutFrequency > 3) {
      suggestions.push('Cuts may be too frequent - consider longer shots');
    }
    
    // セグメント固有の問題
    for (const segEval of pattern.segmentEvaluations) {
      if (segEval.issues.length > 0) {
        suggestions.push(`${segEval.segmentName}: ${segEval.issues.join(', ')}`);
      }
    }
    
    return [...new Set(suggestions)]; // 重複を除去
  }
}