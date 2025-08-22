import type { 
  EditPattern, 
  MatchingResult, 
  ExplainData 
} from '@autoedittate/matching';
import type { PremiereXML } from '@autoedittate/xml-io';

/**
 * QAバリデーションスイート
 * 品質保証のための総合検証システム
 */
export class QAValidationSuite {
  private validators: QAValidator[] = [];
  private results: ValidationResult[] = [];
  
  constructor() {
    // バリデーターを登録
    this.registerValidators();
  }
  
  /**
   * 完全なQA検証を実行
   */
  public async runFullValidation(
    matchingResult: MatchingResult,
    explainData: ExplainData,
    xml?: PremiereXML
  ): Promise<QAReport> {
    console.log('Running full QA validation suite...');
    
    this.results = [];
    
    // 各バリデーターを実行
    for (const validator of this.validators) {
      try {
        const result = await validator.validate({
          matchingResult,
          explainData,
          xml,
        });
        
        this.results.push(result);
        
        console.log(`✓ ${validator.name}: ${result.status}`);
        
        if (result.status === 'FAILED') {
          console.warn(`  Issues: ${result.issues.length}`);
          for (const issue of result.issues.slice(0, 3)) {
            console.warn(`    - ${issue.message}`);
          }
        }
      } catch (error) {
        this.results.push({
          validatorName: validator.name,
          status: 'ERROR',
          score: 0,
          issues: [{
            severity: 'CRITICAL',
            code: 'VALIDATOR_ERROR',
            message: `Validator failed: ${error}`,
            category: 'SYSTEM',
            context: {},
          }],
          metrics: {},
        });
      }
    }
    
    // レポートを生成
    return this.generateReport();
  }
  
  /**
   * バリデーターを登録
   */
  private registerValidators(): void {
    this.validators = [
      new ConfidenceValidator(),
      new ThirtyPercentRuleValidator(),
      new SegmentTransitionValidator(),
      new XMLStructureValidator(),
      new TimecodeValidator(),
      new PerformanceValidator(),
      new QualityMetricsValidator(),
    ];
  }
  
  /**
   * レポートを生成
   */
  private generateReport(): QAReport {
    const passedCount = this.results.filter(r => r.status === 'PASSED').length;
    const failedCount = this.results.filter(r => r.status === 'FAILED').length;
    const errorCount = this.results.filter(r => r.status === 'ERROR').length;
    
    // 全体スコアを計算
    const totalScore = this.results.length > 0 ? 
      this.results.reduce((sum, r) => sum + r.score, 0) / this.results.length : 0;
    
    // 重要度の高い問題を抽出
    const criticalIssues = this.results.flatMap(r => 
      r.issues.filter(i => i.severity === 'CRITICAL')
    );
    
    const warningIssues = this.results.flatMap(r => 
      r.issues.filter(i => i.severity === 'WARNING')
    );
    
    // 全体ステータスを決定
    let overallStatus: QAReport['status'] = 'PASSED';
    if (errorCount > 0 || criticalIssues.length > 0) {
      overallStatus = 'FAILED';
    } else if (warningIssues.length > 0) {
      overallStatus = 'PASSED_WITH_WARNINGS';
    }
    
    return {
      timestamp: new Date().toISOString(),
      status: overallStatus,
      overallScore: totalScore,
      summary: {
        totalValidators: this.validators.length,
        passed: passedCount,
        failed: failedCount,
        errors: errorCount,
      },
      validationResults: this.results,
      criticalIssues,
      warningIssues,
      recommendations: this.generateRecommendations(),
      metrics: this.aggregateMetrics(),
    };
  }
  
  /**
   * 推奨事項を生成
   */
  private generateRecommendations(): string[] {
    const recommendations = new Set<string>();
    
    // 失敗したバリデーターから推奨事項を抽出
    for (const result of this.results) {
      if (result.status === 'FAILED') {
        for (const issue of result.issues) {
          switch (issue.code) {
            case 'LOW_CONFIDENCE':
              recommendations.add('Consider adjusting edit point detection sensitivity');
              break;
            case 'TRANSITION_INVALID':
              recommendations.add('Review shot selection for better 30% rule compliance');
              break;
            case 'SEGMENT_GAP':
              recommendations.add('Ensure continuous timeline coverage');
              break;
            case 'TIMECODE_INVALID':
              recommendations.add('Verify frame rate consistency');
              break;
            case 'PERFORMANCE_SLOW':
              recommendations.add('Optimize processing parameters');
              break;
          }
        }
      }
    }
    
    return Array.from(recommendations);
  }
  
  /**
   * メトリクスを集約
   */
  private aggregateMetrics(): Record<string, any> {
    const aggregated: Record<string, any> = {};
    
    for (const result of this.results) {
      for (const [key, value] of Object.entries(result.metrics)) {
        if (typeof value === 'number') {
          if (!aggregated[key]) {
            aggregated[key] = { sum: 0, count: 0, avg: 0 };
          }
          aggregated[key].sum += value;
          aggregated[key].count += 1;
          aggregated[key].avg = aggregated[key].sum / aggregated[key].count;
        }
      }
    }
    
    return aggregated;
  }
}

// 型定義
export interface QAValidator {
  name: string;
  validate(data: {
    matchingResult: MatchingResult;
    explainData: ExplainData;
    xml?: PremiereXML;
  }): Promise<ValidationResult>;
}

export interface ValidationResult {
  validatorName: string;
  status: 'PASSED' | 'FAILED' | 'ERROR';
  score: number; // 0.0-1.0
  issues: ValidationIssue[];
  metrics: Record<string, any>;
}

export interface ValidationIssue {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  code: string;
  message: string;
  category: 'CONFIDENCE' | 'TRANSITION' | 'TIMING' | 'STRUCTURE' | 'PERFORMANCE' | 'SYSTEM';
  context: Record<string, any>;
}

export interface QAReport {
  timestamp: string;
  status: 'PASSED' | 'PASSED_WITH_WARNINGS' | 'FAILED';
  overallScore: number;
  summary: {
    totalValidators: number;
    passed: number;
    failed: number;
    errors: number;
  };
  validationResults: ValidationResult[];
  criticalIssues: ValidationIssue[];
  warningIssues: ValidationIssue[];
  recommendations: string[];
  metrics: Record<string, any>;
}

// 個別バリデーター実装

/**
 * 確信度バリデーター
 */
class ConfidenceValidator implements QAValidator {
  name = 'Confidence Validator';
  
  async validate(data: any): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const { explainData } = data;
    
    // 集約確信度チェック
    if (explainData.aggregateConfidence < 0.88) {
      issues.push({
        severity: 'CRITICAL',
        code: 'LOW_AGGREGATE_CONFIDENCE',
        message: `Aggregate confidence ${explainData.aggregateConfidence.toFixed(3)} is below required threshold 0.88`,
        category: 'CONFIDENCE',
        context: { 
          actual: explainData.aggregateConfidence,
          required: 0.88,
        },
      });
    }
    
    // 個別決定の確信度チェック
    const lowConfidenceDecisions = explainData.decisions.filter(d => d.confidence < 0.5);
    if (lowConfidenceDecisions.length > 0) {
      issues.push({
        severity: 'WARNING',
        code: 'LOW_CONFIDENCE',
        message: `${lowConfidenceDecisions.length} decisions have confidence < 0.5`,
        category: 'CONFIDENCE',
        context: {
          count: lowConfidenceDecisions.length,
          decisions: lowConfidenceDecisions.map(d => d.id),
        },
      });
    }
    
    const score = explainData.aggregateConfidence;
    const status = issues.filter(i => i.severity === 'CRITICAL').length > 0 ? 'FAILED' : 'PASSED';
    
    return {
      validatorName: this.name,
      status,
      score,
      issues,
      metrics: {
        aggregateConfidence: explainData.aggregateConfidence,
        lowConfidenceCount: lowConfidenceDecisions.length,
        avgConfidence: explainData.statistics.avgConfidence,
      },
    };
  }
}

/**
 * 30%変化ルールバリデーター
 */
class ThirtyPercentRuleValidator implements QAValidator {
  name = '30% Rule Validator';
  
  async validate(data: any): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const { explainData } = data;
    
    // 30%ルール準拠率をチェック
    const compliance = explainData.qualityMetrics.thirtyPercentCompliance;
    
    if (compliance < 0.8) {
      issues.push({
        severity: 'CRITICAL',
        code: 'TRANSITION_INVALID',
        message: `30% rule compliance ${(compliance * 100).toFixed(1)}% is below 80%`,
        category: 'TRANSITION',
        context: {
          compliance,
          required: 0.8,
        },
      });
    }
    
    // 個別トランジションをチェック
    const invalidTransitions = explainData.decisions.filter(d => 
      d.context.transition && !d.context.transition.isValid
    );
    
    if (invalidTransitions.length > 0) {
      issues.push({
        severity: 'WARNING',
        code: 'INVALID_TRANSITIONS',
        message: `${invalidTransitions.length} transitions violate 30% rule`,
        category: 'TRANSITION',
        context: {
          count: invalidTransitions.length,
          decisions: invalidTransitions.map(d => d.id),
        },
      });
    }
    
    const score = compliance;
    const status = compliance >= 0.8 ? 'PASSED' : 'FAILED';
    
    return {
      validatorName: this.name,
      status,
      score,
      issues,
      metrics: {
        compliance,
        invalidTransitionCount: invalidTransitions.length,
      },
    };
  }
}

/**
 * セグメント遷移バリデーター
 */
class SegmentTransitionValidator implements QAValidator {
  name = 'Segment Transition Validator';
  
  async validate(data: any): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const { explainData } = data;
    
    // セグメント分析をチェック
    for (const segment of explainData.segmentAnalysis) {
      if (segment.performance.gap > 0.4) {
        issues.push({
          severity: 'WARNING',
          code: 'SEGMENT_UNDERPERFORM',
          message: `Segment ${segment.segment} performance gap: ${(segment.performance.gap * 100).toFixed(1)}%`,
          category: 'TIMING',
          context: {
            segment: segment.segment,
            gap: segment.performance.gap,
            actualScore: segment.performance.actualScore,
          },
        });
      }
      
      if (segment.issues && segment.issues.length > 0) {
        issues.push({
          severity: 'INFO',
          code: 'SEGMENT_ISSUES',
          message: `Segment ${segment.segment} has ${segment.issues.length} issues`,
          category: 'TIMING',
          context: {
            segment: segment.segment,
            issues: segment.issues,
          },
        });
      }
    }
    
    // セグメント間のギャップチェック
    const segmentGaps = this.checkSegmentGaps(explainData.segmentAnalysis);
    for (const gap of segmentGaps) {
      issues.push({
        severity: 'CRITICAL',
        code: 'SEGMENT_GAP',
        message: `Gap detected between segments: ${gap.from} -> ${gap.to}`,
        category: 'TIMING',
        context: gap,
      });
    }
    
    const score = 1 - (issues.filter(i => i.severity === 'CRITICAL').length * 0.5);
    const status = segmentGaps.length > 0 ? 'FAILED' : 'PASSED';
    
    return {
      validatorName: this.name,
      status,
      score: Math.max(0, score),
      issues,
      metrics: {
        segmentCount: explainData.segmentAnalysis.length,
        gapCount: segmentGaps.length,
        avgPerformance: explainData.segmentAnalysis.reduce((sum, s) => 
          sum + s.performance.actualScore, 0) / explainData.segmentAnalysis.length,
      },
    };
  }
  
  private checkSegmentGaps(segments: any[]): Array<{
    from: string;
    to: string;
    gap: number;
  }> {
    const gaps: Array<{
      from: string;
      to: string;
      gap: number;
    }> = [];
    
    // セグメントを時間順にソート
    const sorted = [...segments].sort((a, b) => a.timeRange[0] - b.timeRange[0]);
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      
      const gap = next.timeRange[0] - current.timeRange[1];
      if (gap > 100) { // 100ms以上のギャップ
        gaps.push({
          from: current.segment,
          to: next.segment,
          gap,
        });
      }
    }
    
    return gaps;
  }
}

/**
 * XML構造バリデーター
 */
class XMLStructureValidator implements QAValidator {
  name = 'XML Structure Validator';
  
  async validate(data: any): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const { xml } = data;
    
    if (!xml) {
      return {
        validatorName: this.name,
        status: 'PASSED',
        score: 1,
        issues: [],
        metrics: { xmlProvided: false },
      };
    }
    
    // XML構造の基本チェック
    if (!xml.xmeml) {
      issues.push({
        severity: 'CRITICAL',
        code: 'INVALID_XML_STRUCTURE',
        message: 'Missing xmeml root element',
        category: 'STRUCTURE',
        context: {},
      });
    }
    
    if (!xml.xmeml?.sequence) {
      issues.push({
        severity: 'CRITICAL',
        code: 'MISSING_SEQUENCE',
        message: 'Missing sequence element',
        category: 'STRUCTURE',
        context: {},
      });
    }
    
    const score = issues.filter(i => i.severity === 'CRITICAL').length > 0 ? 0 : 1;
    const status = score > 0 ? 'PASSED' : 'FAILED';
    
    return {
      validatorName: this.name,
      status,
      score,
      issues,
      metrics: {
        xmlProvided: true,
        hasSequence: !!xml.xmeml?.sequence,
      },
    };
  }
}

/**
 * タイムコードバリデーター
 */
class TimecodeValidator implements QAValidator {
  name = 'Timecode Validator';
  
  async validate(data: any): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const { explainData } = data;
    
    // 決定の時間的一貫性をチェック
    let previousEndTime = 0;
    
    for (const decision of explainData.decisions) {
      if (decision.time < previousEndTime) {
        issues.push({
          severity: 'CRITICAL',
          code: 'TIMECODE_OVERLAP',
          message: `Decision ${decision.id} overlaps with previous decision`,
          category: 'TIMING',
          context: {
            decisionId: decision.id,
            time: decision.time,
            previousEndTime,
          },
        });
      }
      
      // 決定に対応するショット情報が必要
      previousEndTime = decision.time + (decision.context?.duration || 1000);
    }
    
    const score = issues.filter(i => i.severity === 'CRITICAL').length > 0 ? 0 : 1;
    const status = score > 0 ? 'PASSED' : 'FAILED';
    
    return {
      validatorName: this.name,
      status,
      score,
      issues,
      metrics: {
        totalDecisions: explainData.decisions.length,
        overlapCount: issues.filter(i => i.code === 'TIMECODE_OVERLAP').length,
      },
    };
  }
}

/**
 * パフォーマンスバリデーター
 */
class PerformanceValidator implements QAValidator {
  name = 'Performance Validator';
  
  async validate(data: any): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const { explainData } = data;
    
    // 処理時間のメトリクス（仮想値）
    const processingTime = Date.now() - new Date(explainData.timestamp).getTime();
    
    if (processingTime > 300000) { // 5分以上
      issues.push({
        severity: 'WARNING',
        code: 'PERFORMANCE_SLOW',
        message: `Processing time ${Math.round(processingTime / 1000)}s exceeds target 300s`,
        category: 'PERFORMANCE',
        context: {
          processingTime,
          target: 300000,
        },
      });
    }
    
    const score = processingTime <= 300000 ? 1 : 0.5;
    const status = 'PASSED'; // パフォーマンスは警告のみ
    
    return {
      validatorName: this.name,
      status,
      score,
      issues,
      metrics: {
        processingTime,
        targetTime: 300000,
      },
    };
  }
}

/**
 * 品質メトリクスバリデーター
 */
class QualityMetricsValidator implements QAValidator {
  name = 'Quality Metrics Validator';
  
  async validate(data: any): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const { explainData } = data;
    
    const metrics = explainData.qualityMetrics;
    
    // 各メトリクスの範囲チェック
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value !== 'number' || value < 0 || value > 1) {
        issues.push({
          severity: 'CRITICAL',
          code: 'INVALID_METRIC',
          message: `Invalid metric ${key}: ${value}`,
          category: 'SYSTEM',
          context: { metric: key, value },
        });
      }
    }
    
    // メトリクスの最小基準チェック
    if (metrics.musicSync < 0.5) {
      issues.push({
        severity: 'WARNING',
        code: 'LOW_MUSIC_SYNC',
        message: `Music sync ${(metrics.musicSync * 100).toFixed(1)}% is below 50%`,
        category: 'TIMING',
        context: { value: metrics.musicSync },
      });
    }
    
    const score = Object.values(metrics).reduce((sum: number, val: any) => 
      sum + (typeof val === 'number' ? val : 0), 0) / Object.keys(metrics).length;
    
    const status = issues.filter(i => i.severity === 'CRITICAL').length > 0 ? 'FAILED' : 'PASSED';
    
    return {
      validatorName: this.name,
      status,
      score,
      issues,
      metrics: {
        ...metrics,
        avgScore: score,
      },
    };
  }
}