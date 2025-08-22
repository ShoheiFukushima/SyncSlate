import { promises as fs } from 'fs';
import type { 
  ExplainData, 
  EditPattern,
  MatchingResult 
} from '@autoedittate/matching';

/**
 * explain.json ビルダー
 * 編集判断の根拠を記録したJSONファイルを生成
 */
export class ExplainJsonBuilder {
  /**
   * マッチング結果からexplain.jsonを生成
   */
  public async buildFromMatchingResult(
    result: MatchingResult,
    outputPath: string
  ): Promise<void> {
    console.log('Building explain.json...');
    
    // explain.jsonデータを構築
    const explainData = this.buildExplainData(result);
    
    // バリデーション
    this.validateExplainData(explainData);
    
    // JSONを整形して保存
    const jsonString = JSON.stringify(explainData, null, 2);
    await fs.writeFile(outputPath, jsonString, 'utf-8');
    
    console.log(`explain.json saved to: ${outputPath}`);
    console.log(`Aggregate Confidence: ${explainData.aggregateConfidence.toFixed(3)}`);
    
    // 品質チェック結果を出力
    this.printQualityReport(explainData);
  }
  
  /**
   * explain.jsonデータを構築
   */
  private buildExplainData(result: MatchingResult): ExplainData {
    // 推奨パターンを取得
    const pattern = this.getRecommendedPattern(result);
    
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      aggregateConfidence: pattern.evaluation.aggregateConfidence,
      
      decisions: pattern.decisions.map(d => ({
        id: d.id,
        time: d.time,
        shot: d.shot.id,
        confidence: d.confidence,
        reason: this.generateReason(d),
        scores: {
          visual: d.scores.visual,
          sync: d.scores.sync,
          semantic: d.scores.semantic,
          stability: d.scores.stability,
          overall: d.scores.overall,
        },
        context: {
          segment: d.matchingDetails.segmentName,
          weights: d.matchingDetails.weights,
          editPointType: d.matchingDetails.editPoint?.type,
          musicalContext: d.matchingDetails.musicalContext,
          transition: d.transition ? {
            isValid: d.transition.validation.isValid,
            maxChange: d.transition.validation.maxChange,
            changeDimension: d.transition.validation.changeDimension,
            changes: d.transition.validation.changes,
          } : undefined,
          shotQuality: {
            sharpness: d.shot.quality.sharpness,
            shake: d.shot.quality.shake,
            lighting: d.shot.quality.lighting,
            composition: d.shot.quality.composition,
            overallScore: d.shot.quality.overallScore,
            isHeroShot: d.shot.isHeroShot,
          },
        },
      })),
      
      qualityMetrics: {
        musicSync: pattern.evaluation.musicalAlignment,
        visualFlow: pattern.evaluation.visualFlow,
        narrativeCoherence: pattern.evaluation.narrativeCohesion,
        technicalQuality: pattern.evaluation.aggregateConfidence,
        thirtyPercentCompliance: pattern.evaluation.transitionQuality,
      },
      
      segmentAnalysis: pattern.segmentEvaluations.map(se => ({
        segment: se.segmentName,
        timeRange: [se.startTime, se.endTime] as [number, number],
        appliedWeights: this.getSegmentWeights(pattern, se.segmentName),
        performance: {
          targetScore: 1.0,
          actualScore: se.score,
          gap: 1.0 - se.score,
        },
        issues: se.issues,
      })),
      
      statistics: {
        totalDecisions: pattern.decisions.length,
        avgConfidence: this.calculateAverage(pattern.decisions.map(d => d.confidence)),
        avgFlexibility: this.calculateAverage(pattern.decisions.map(d => d.flexibility)),
        shotUsage: this.calculateShotUsage(pattern.decisions),
        editPointTypes: this.calculateEditPointTypes(pattern.decisions),
        segmentDistribution: this.calculateSegmentDistribution(pattern.decisions),
      },
      
      patternComparison: {
        selected: result.recommendedPattern,
        reason: result.recommendationReason,
        alternatives: this.comparePatterns(result.patterns),
      },
      
      recommendations: this.generateRecommendations(result),
    };
  }
  
  /**
   * 推奨パターンを取得
   */
  private getRecommendedPattern(result: MatchingResult): EditPattern {
    switch (result.recommendedPattern) {
      case 'dynamic_cut':
        return result.patterns.dynamicCut;
      case 'narrative_flow':
        return result.patterns.narrativeFlow;
      case 'hybrid_balance':
        return result.patterns.hybridBalance;
      default:
        return result.patterns.hybridBalance;
    }
  }
  
  /**
   * 決定理由を生成
   */
  private generateReason(decision: any): string {
    const reasons: string[] = [];
    
    // 編集点タイプ
    if (decision.matchingDetails.editPoint) {
      const ep = decision.matchingDetails.editPoint;
      reasons.push(`${ep.type}: ${ep.reason}`);
    } else {
      reasons.push('Manual selection');
    }
    
    // セグメント戦略
    reasons.push(`Segment: ${decision.matchingDetails.segmentName}`);
    
    // 音楽コンテキスト
    if (decision.matchingDetails.musicalContext?.isDownbeat) {
      reasons.push('Downbeat alignment');
    }
    
    // ショット品質
    if (decision.shot.isHeroShot) {
      reasons.push('Hero shot');
    }
    
    // 30%ルール
    if (decision.transition) {
      const valid = decision.transition.validation.isValid;
      reasons.push(`30% rule: ${valid ? 'Pass' : 'Fail'}`);
    }
    
    // スコア情報
    reasons.push(`Overall score: ${decision.scores.overall.toFixed(2)}`);
    
    return reasons.join(' | ');
  }
  
  /**
   * セグメント重みを取得
   */
  private getSegmentWeights(pattern: EditPattern, segmentName: string): any {
    const decision = pattern.decisions.find(d => 
      d.matchingDetails.segmentName === segmentName
    );
    
    return decision?.matchingDetails.weights || {
      visual: 0.25,
      sync: 0.25,
      semantic: 0.25,
      stability: 0.25,
    };
  }
  
  /**
   * 平均を計算
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * ショット使用統計
   */
  private calculateShotUsage(decisions: any[]): Record<string, number> {
    const usage: Record<string, number> = {};
    
    for (const decision of decisions) {
      const shotId = decision.shot.id;
      usage[shotId] = (usage[shotId] || 0) + 1;
    }
    
    return usage;
  }
  
  /**
   * 編集点タイプ統計
   */
  private calculateEditPointTypes(decisions: any[]): Record<string, number> {
    const types: Record<string, number> = {};
    
    for (const decision of decisions) {
      const type = decision.matchingDetails.editPoint?.type || 'manual';
      types[type] = (types[type] || 0) + 1;
    }
    
    return types;
  }
  
  /**
   * セグメント分布
   */
  private calculateSegmentDistribution(decisions: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const decision of decisions) {
      const segment = decision.matchingDetails.segmentName;
      distribution[segment] = (distribution[segment] || 0) + 1;
    }
    
    return distribution;
  }
  
  /**
   * パターンを比較
   */
  private comparePatterns(patterns: MatchingResult['patterns']): Array<{
    name: string;
    confidence: number;
    strengths: string[];
    weaknesses: string[];
  }> {
    const comparisons: Array<{
      name: string;
      confidence: number;
      strengths: string[];
      weaknesses: string[];
    }> = [];
    
    for (const [name, pattern] of Object.entries(patterns)) {
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      
      // 強みを特定
      if (pattern.evaluation.aggregateConfidence >= 0.88) {
        strengths.push('High confidence');
      }
      if (pattern.evaluation.musicalAlignment > 0.8) {
        strengths.push('Excellent music sync');
      }
      if (pattern.evaluation.transitionQuality > 0.9) {
        strengths.push('Smooth transitions');
      }
      if (pattern.evaluation.narrativeCohesion > 0.7) {
        strengths.push('Good narrative flow');
      }
      
      // 弱点を特定
      if (pattern.evaluation.aggregateConfidence < 0.7) {
        weaknesses.push('Low confidence');
      }
      if (pattern.evaluation.musicalAlignment < 0.5) {
        weaknesses.push('Poor music sync');
      }
      if (pattern.evaluation.transitionQuality < 0.6) {
        weaknesses.push('Rough transitions');
      }
      if (pattern.evaluation.cutFrequency > 3) {
        weaknesses.push('Too many cuts');
      }
      
      comparisons.push({
        name,
        confidence: pattern.evaluation.aggregateConfidence,
        strengths,
        weaknesses,
      });
    }
    
    return comparisons;
  }
  
  /**
   * 推奨事項を生成
   */
  private generateRecommendations(result: MatchingResult): string[] {
    const recommendations: string[] = [];
    
    // 全体品質に基づく推奨
    if (result.overallQuality.score < 0.7) {
      recommendations.push('Consider reviewing shot selection criteria');
    }
    
    // 特定の問題に対する推奨
    for (const weakness of result.overallQuality.weaknesses) {
      if (weakness.includes('confidence')) {
        recommendations.push('Adjust edit point detection sensitivity');
      }
      if (weakness.includes('transition')) {
        recommendations.push('Ensure shot variety meets 30% change rule');
      }
      if (weakness.includes('musical')) {
        recommendations.push('Fine-tune beat detection parameters');
      }
    }
    
    // 改善提案を追加
    recommendations.push(...result.overallQuality.suggestions);
    
    // 重複を除去
    return [...new Set(recommendations)];
  }
  
  /**
   * データをバリデート
   */
  private validateExplainData(data: ExplainData): void {
    // 必須項目の確認
    if (typeof data.aggregateConfidence !== 'number') {
      throw new Error('aggregateConfidence is required');
    }
    
    // 品質基準チェック
    if (data.aggregateConfidence < 0.88) {
      console.warn(`WARNING: aggregateConfidence (${data.aggregateConfidence}) is below threshold (0.88)`);
    }
    
    // 決定データの確認
    if (!Array.isArray(data.decisions) || data.decisions.length === 0) {
      throw new Error('decisions array is required and must not be empty');
    }
    
    // 各決定の妥当性確認
    for (const decision of data.decisions) {
      if (!decision.id || !decision.shot || typeof decision.confidence !== 'number') {
        throw new Error('Invalid decision data');
      }
      
      if (decision.confidence < 0 || decision.confidence > 1) {
        throw new Error(`Invalid confidence value: ${decision.confidence}`);
      }
    }
    
    // メトリクスの範囲確認
    const metrics = data.qualityMetrics;
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value !== 'number' || value < 0 || value > 1) {
        throw new Error(`Invalid metric ${key}: ${value}`);
      }
    }
  }
  
  /**
   * 品質レポートを出力
   */
  private printQualityReport(data: ExplainData): void {
    console.log('\n=== Quality Report ===');
    console.log(`✓ Aggregate Confidence: ${(data.aggregateConfidence * 100).toFixed(1)}%`);
    console.log(`✓ Music Sync: ${(data.qualityMetrics.musicSync * 100).toFixed(1)}%`);
    console.log(`✓ Visual Flow: ${(data.qualityMetrics.visualFlow * 100).toFixed(1)}%`);
    console.log(`✓ 30% Rule Compliance: ${(data.qualityMetrics.thirtyPercentCompliance * 100).toFixed(1)}%`);
    console.log(`✓ Total Decisions: ${data.statistics.totalDecisions}`);
    
    // 品質基準の達成状況
    const meetsStandard = data.aggregateConfidence >= 0.88;
    console.log(`\n${meetsStandard ? '✅' : '⚠️'} Quality Standard: ${meetsStandard ? 'PASS' : 'FAIL'}`);
    
    // 問題のあるセグメント
    const problematicSegments = data.segmentAnalysis.filter(s => s.performance.gap > 0.3);
    if (problematicSegments.length > 0) {
      console.log('\n⚠️ Segments needing attention:');
      for (const segment of problematicSegments) {
        console.log(`  - ${segment.segment}: ${(segment.performance.actualScore * 100).toFixed(1)}%`);
        if (segment.issues) {
          for (const issue of segment.issues) {
            console.log(`    • ${issue}`);
          }
        }
      }
    }
    
    // 推奨事項
    if (data.recommendations && data.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of data.recommendations) {
        console.log(`  • ${rec}`);
      }
    }
    
    console.log('======================\n');
  }
}