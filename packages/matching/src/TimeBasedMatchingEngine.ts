import { ConfigLoader, ConfigUtils } from '@autoedittate/config';
import type { 
  Segment, 
  SegmentWeights, 
  Pattern,
  MatchingSegmentsConfig 
} from '@autoedittate/config';
import type { 
  MusicAnalysisResult, 
  EditPoint, 
  RelativeDynamics 
} from '@autoedittate/music-analysis';
import type { 
  VideoAnalysisResult, 
  Shot, 
  TransitionValidation 
} from '@autoedittate/video-analysis';
import type {
  EditDecision,
  EditPattern,
  MatchingResult,
  MatchingOptions,
  ExplainData,
} from './types.js';

/**
 * 時間軸別マッチングエンジン
 * 音楽と映像を時間軸セグメントごとの戦略で最適にマッチング
 */
export class TimeBasedMatchingEngine {
  private readonly configLoader: ConfigLoader;
  private readonly options: MatchingOptions;
  private segmentConfig?: MatchingSegmentsConfig;
  
  constructor(options?: MatchingOptions) {
    this.configLoader = ConfigLoader.getInstance();
    this.options = {
      minConfidence: 0.5,
      maxFlexibility: 100,
      optimizationMethod: 'dynamic_programming',
      iterations: 100,
      convergenceThreshold: 0.01,
      constraints: {
        minShotDuration: 500,
        maxShotDuration: 10000,
        maxConsecutiveSameShot: 3,
        requireHeroShotInOpening: true,
      },
      verbose: false,
      explainDetails: true,
      ...options,
    };
  }
  
  /**
   * 音楽と映像をマッチング
   */
  public async match(
    music: MusicAnalysisResult,
    video: VideoAnalysisResult
  ): Promise<MatchingResult> {
    console.log('Starting time-based matching...');
    
    // 設定を読み込み
    this.segmentConfig = await this.configLoader.getMatchingSegments();
    
    // 3つのパターンを生成
    const patterns = await Promise.all([
      this.generatePattern('dynamic_cut', music, video),
      this.generatePattern('narrative_flow', music, video),
      this.generatePattern('hybrid_balance', music, video),
    ]);
    
    // 推奨パターンを決定
    const recommendation = this.selectRecommendedPattern(patterns);
    
    // 全体評価
    const overallQuality = this.evaluateOverallQuality(patterns);
    
    // explain.json用データを生成
    const explainData = this.generateExplainData(patterns, recommendation);
    
    return {
      patterns: {
        dynamicCut: patterns[0],
        narrativeFlow: patterns[1],
        hybridBalance: patterns[2],
      },
      recommendedPattern: recommendation.pattern,
      recommendationReason: recommendation.reason,
      overallQuality,
      explainData,
    };
  }
  
  /**
   * パターンを生成
   */
  private async generatePattern(
    patternName: 'dynamic_cut' | 'narrative_flow' | 'hybrid_balance',
    music: MusicAnalysisResult,
    video: VideoAnalysisResult
  ): Promise<EditPattern> {
    if (this.options.verbose) {
      console.log(`Generating ${patternName} pattern...`);
    }
    
    // パターン設定を取得
    const patternConfig = this.getPatternConfig(patternName);
    
    // 編集決定を生成
    const decisions = await this.generateEditDecisions(
      music,
      video,
      patternConfig
    );
    
    // パターンを評価
    const evaluation = this.evaluatePattern(decisions, music, video);
    
    // セグメントごとの評価
    const segmentEvaluations = this.evaluateSegments(decisions, music);
    
    return {
      name: patternName,
      description: patternConfig.description,
      decisions,
      evaluation,
      segmentEvaluations,
    };
  }
  
  /**
   * パターン設定を取得
   */
  private getPatternConfig(patternName: string): Pattern {
    const analysisSettings = this.configLoader.getAnalysisSettings();
    const patterns = analysisSettings.then(s => s.matching.patterns);
    const pattern = patterns.then(p => p.find(pat => pat.name === patternName));
    
    // デフォルトパターン
    const defaults: Record<string, Pattern> = {
      dynamic_cut: {
        name: 'dynamic_cut',
        description: 'ダイナミックカット（リズム重視）',
        modifiers: { sync: 1.3, visual: 1.1 },
      },
      narrative_flow: {
        name: 'narrative_flow',
        description: 'ナラティブフロー（ストーリー重視）',
        modifiers: { semantic: 1.4, stability: 1.2 },
      },
      hybrid_balance: {
        name: 'hybrid_balance',
        description: 'ハイブリッドバランス（バランス型）',
        modifiers: { all: 1.0 },
      },
    };
    
    return defaults[patternName];
  }
  
  /**
   * 編集決定を生成
   */
  private async generateEditDecisions(
    music: MusicAnalysisResult,
    video: VideoAnalysisResult,
    pattern: Pattern
  ): Promise<EditDecision[]> {
    const decisions: EditDecision[] = [];
    const usedShots = new Map<string, number>(); // ショット使用回数
    
    // 時間軸をセグメントに分割
    const segments = await this.divideIntoSegments(music.duration);
    
    for (const segment of segments) {
      const segmentDecisions = await this.generateSegmentDecisions(
        segment,
        music,
        video,
        pattern,
        usedShots
      );
      decisions.push(...segmentDecisions);
    }
    
    // 最適化
    const optimized = await this.optimizeDecisions(decisions, music, video);
    
    // トランジション検証
    this.validateTransitions(optimized, video);
    
    return optimized;
  }
  
  /**
   * セグメントに分割
   */
  private async divideIntoSegments(duration: number): Promise<Array<{
    name: string;
    segment: Segment;
    startTime: number;
    endTime: number;
  }>> {
    const segments: Array<{
      name: string;
      segment: Segment;
      startTime: number;
      endTime: number;
    }> = [];
    
    if (!this.segmentConfig) {
      throw new Error('Segment configuration not loaded');
    }
    
    // 設定されたセグメントを時間軸に配置
    for (const [name, segment] of Object.entries(this.segmentConfig.segments)) {
      const [start, end] = segment.range;
      
      // 実際の動画長に合わせて調整
      if (start < duration) {
        segments.push({
          name,
          segment,
          startTime: start,
          endTime: Math.min(end, duration),
        });
      }
    }
    
    return segments;
  }
  
  /**
   * セグメント内の編集決定を生成
   */
  private async generateSegmentDecisions(
    segmentInfo: {
      name: string;
      segment: Segment;
      startTime: number;
      endTime: number;
    },
    music: MusicAnalysisResult,
    video: VideoAnalysisResult,
    pattern: Pattern,
    usedShots: Map<string, number>
  ): Promise<EditDecision[]> {
    const decisions: EditDecision[] = [];
    const { segment, startTime, endTime } = segmentInfo;
    
    // セグメント内の編集点を取得
    const editPoints = music.editPoints.filter(ep => 
      ep.time >= startTime && ep.time < endTime
    );
    
    // パターンモディファイアを適用した重みを計算
    const weights = ConfigUtils.applyPatternModifiers(segment.weights, pattern);
    
    // 各編集点に対してショットを割り当て
    for (let i = 0; i < editPoints.length; i++) {
      const editPoint = editPoints[i];
      const nextPoint = editPoints[i + 1];
      const duration = nextPoint ? nextPoint.time - editPoint.time : endTime - editPoint.time;
      
      // 制約チェック
      if (duration < this.options.constraints!.minShotDuration!) {
        continue;
      }
      
      // 最適なショットを選択
      const shot = this.selectBestShot(
        editPoint.time,
        duration,
        video.shots,
        weights,
        music.dynamics,
        segmentInfo.name,
        usedShots
      );
      
      if (!shot) continue;
      
      // 編集決定を作成
      const decision = this.createEditDecision(
        editPoint,
        shot,
        duration,
        weights,
        segmentInfo.name
      );
      
      decisions.push(decision);
      
      // ショット使用回数を更新
      usedShots.set(shot.id, (usedShots.get(shot.id) || 0) + 1);
    }
    
    return decisions;
  }
  
  /**
   * 最適なショットを選択
   */
  private selectBestShot(
    time: number,
    duration: number,
    shots: Shot[],
    weights: SegmentWeights,
    dynamics: RelativeDynamics[],
    segmentName: string,
    usedShots: Map<string, number>
  ): Shot | null {
    // 使用可能なショットをフィルタリング
    const availableShots = shots.filter(shot => {
      // 長さチェック
      if (shot.duration < duration) return false;
      
      // 使用可能時間チェック
      if (segmentName === 'opening' && time < 3000) {
        // オープニングは安定したショットが必要
        if (shot.stableFrom > shot.startTime + duration) return false;
      } else {
        // その他は1秒後から使用可能
        if (shot.usableFrom > shot.startTime + duration) return false;
      }
      
      // 連続使用回数チェック
      const useCount = usedShots.get(shot.id) || 0;
      if (useCount >= this.options.constraints!.maxConsecutiveSameShot!) {
        return false;
      }
      
      return true;
    });
    
    if (availableShots.length === 0) return null;
    
    // ヒーローショット優先（オープニング）
    if (segmentName === 'opening' && this.options.constraints!.requireHeroShotInOpening) {
      const heroShots = availableShots.filter(s => s.isHeroShot);
      if (heroShots.length > 0) {
        availableShots.splice(0, availableShots.length, ...heroShots);
      }
    }
    
    // 各ショットをスコアリング
    const scoredShots = availableShots.map(shot => {
      const score = this.scoreShot(shot, time, dynamics, weights);
      return { shot, score };
    });
    
    // スコア順にソート
    scoredShots.sort((a, b) => b.score.overall - a.score.overall);
    
    return scoredShots[0]?.shot || null;
  }
  
  /**
   * ショットをスコアリング
   */
  private scoreShot(
    shot: Shot,
    time: number,
    dynamics: RelativeDynamics[],
    weights: SegmentWeights
  ): EditDecision['scores'] {
    // 時間に対応するダイナミクスを取得
    const dynamic = dynamics.find(d => Math.abs(d.time - time) < 100) || dynamics[0];
    
    // 視覚スコア（ショット品質とエッジ複雑性）
    const visual = shot.quality.overallScore * 0.6 + shot.heroShotScore * 0.4;
    
    // 同期スコア（音楽の強度とショットの動きの一致）
    const sync = this.calculateSyncScore(shot, dynamic);
    
    // 意味的スコア（感情価の一致）
    const semantic = this.calculateSemanticScore(shot, dynamic);
    
    // 安定性スコア（手ブレの少なさ）
    const stability = 1 - shot.quality.shake;
    
    // 重み付き総合スコア
    const overall = 
      visual * weights.visual +
      sync * weights.sync +
      semantic * weights.semantic +
      stability * weights.stability;
    
    return {
      visual,
      sync,
      semantic,
      stability,
      overall,
    };
  }
  
  /**
   * 同期スコアを計算
   */
  private calculateSyncScore(shot: Shot, dynamic: RelativeDynamics): number {
    // 音楽の強度とショットの品質の相関
    const intensityMatch = 1 - Math.abs(dynamic.intensity - shot.quality.overallScore);
    
    // 音楽の複雑性とショットのエッジ複雑性の相関
    const complexityMatch = 1 - Math.abs(dynamic.complexity - shot.heroShotScore);
    
    return (intensityMatch + complexityMatch) / 2;
  }
  
  /**
   * 意味的スコアを計算
   */
  private calculateSemanticScore(shot: Shot, dynamic: RelativeDynamics): number {
    // 感情価とショットの明るさの相関
    const valenceMatch = dynamic.emotionalValence > 0 ? 
      shot.quality.lighting : 
      1 - shot.quality.lighting;
    
    // 覚醒度とショットの構図の相関
    const arousalMatch = 1 - Math.abs(dynamic.arousal - shot.quality.composition);
    
    return (valenceMatch + arousalMatch) / 2;
  }
  
  /**
   * 編集決定を作成
   */
  private createEditDecision(
    editPoint: EditPoint,
    shot: Shot,
    duration: number,
    weights: SegmentWeights,
    segmentName: string
  ): EditDecision {
    // ショット内の使用範囲を決定
    const inPoint = shot.inPoint;
    const outPoint = Math.min(shot.outPoint, inPoint + duration);
    
    return {
      id: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      time: editPoint.time,
      shot,
      inPoint,
      outPoint,
      duration: outPoint - inPoint,
      confidence: editPoint.confidence,
      flexibility: editPoint.flexibility,
      scores: {
        visual: 0,
        sync: 0,
        semantic: 0,
        stability: 0,
        overall: 0,
      },
      matchingDetails: {
        segmentName,
        weights,
        editPoint,
        musicalContext: editPoint.musicalContext,
      },
    };
  }
  
  /**
   * 決定を最適化
   */
  private async optimizeDecisions(
    decisions: EditDecision[],
    music: MusicAnalysisResult,
    video: VideoAnalysisResult
  ): Promise<EditDecision[]> {
    if (this.options.optimizationMethod === 'dynamic_programming') {
      return this.optimizeWithDP(decisions, music, video);
    } else if (this.options.optimizationMethod === 'genetic') {
      return this.optimizeWithGA(decisions, music, video);
    } else {
      return this.optimizeGreedy(decisions, music, video);
    }
  }
  
  /**
   * 動的計画法による最適化
   */
  private optimizeWithDP(
    decisions: EditDecision[],
    music: MusicAnalysisResult,
    video: VideoAnalysisResult
  ): EditDecision[] {
    // 簡略化された実装
    // 実際は完全な動的計画法アルゴリズムが必要
    
    const optimized: EditDecision[] = [];
    const n = decisions.length;
    
    // コスト行列を構築
    const dp: number[][] = Array(n).fill(0).map(() => Array(n).fill(Infinity));
    const parent: number[][] = Array(n).fill(0).map(() => Array(n).fill(-1));
    
    // 初期化
    for (let i = 0; i < n; i++) {
      dp[i][i] = 1 - decisions[i].confidence;
    }
    
    // 最適パスを探索
    for (let len = 2; len <= n; len++) {
      for (let i = 0; i <= n - len; i++) {
        const j = i + len - 1;
        for (let k = i; k < j; k++) {
          const cost = dp[i][k] + dp[k + 1][j] + this.transitionCost(decisions[k], decisions[k + 1]);
          if (cost < dp[i][j]) {
            dp[i][j] = cost;
            parent[i][j] = k;
          }
        }
      }
    }
    
    // 最適解を復元
    return this.reconstructPath(decisions, parent, 0, n - 1);
  }
  
  /**
   * 遺伝的アルゴリズムによる最適化
   */
  private optimizeWithGA(
    decisions: EditDecision[],
    music: MusicAnalysisResult,
    video: VideoAnalysisResult
  ): EditDecision[] {
    // 簡略化された実装
    return decisions;
  }
  
  /**
   * 貪欲法による最適化
   */
  private optimizeGreedy(
    decisions: EditDecision[],
    music: MusicAnalysisResult,
    video: VideoAnalysisResult
  ): EditDecision[] {
    // 信頼度順にソートして選択
    const sorted = [...decisions].sort((a, b) => b.confidence - a.confidence);
    const selected: EditDecision[] = [];
    let lastTime = -Infinity;
    
    for (const decision of sorted) {
      if (decision.time - lastTime >= this.options.constraints!.minShotDuration!) {
        selected.push(decision);
        lastTime = decision.time + decision.duration;
      }
    }
    
    // 時間順に再ソート
    selected.sort((a, b) => a.time - b.time);
    
    return selected;
  }
  
  /**
   * トランジションコスト
   */
  private transitionCost(from: EditDecision, to: EditDecision): number {
    // 30%変化の法則に基づくコスト
    if (!from.transition?.validation.isValid) {
      return 0.5; // ペナルティ
    }
    
    // 時間的ギャップ
    const timeGap = to.time - (from.time + from.duration);
    if (timeGap > 1000) {
      return 0.3;
    }
    
    return 0;
  }
  
  /**
   * パスを復元
   */
  private reconstructPath(
    decisions: EditDecision[],
    parent: number[][],
    i: number,
    j: number
  ): EditDecision[] {
    if (i === j) {
      return [decisions[i]];
    }
    
    const k = parent[i][j];
    if (k === -1) {
      return decisions.slice(i, j + 1);
    }
    
    return [
      ...this.reconstructPath(decisions, parent, i, k),
      ...this.reconstructPath(decisions, parent, k + 1, j),
    ];
  }
  
  /**
   * トランジションを検証
   */
  private validateTransitions(
    decisions: EditDecision[],
    video: VideoAnalysisResult
  ): void {
    for (let i = 0; i < decisions.length - 1; i++) {
      const from = decisions[i];
      const to = decisions[i + 1];
      
      // 対応するトランジション検証を探す
      const validation = video.transitionValidations.find(v =>
        v.fromShot === from.shot.id && v.toShot === to.shot.id
      );
      
      if (validation) {
        to.transition = {
          fromShot: from.shot,
          validation,
          improvement: validation.isValid ? undefined : 
            `Need more ${validation.changeDimension} change`,
        };
      }
    }
  }
  
  /**
   * パターンを評価
   */
  private evaluatePattern(
    decisions: EditDecision[],
    music: MusicAnalysisResult,
    video: VideoAnalysisResult
  ): EditPattern['evaluation'] {
    // 全体の確信度
    const aggregateConfidence = decisions.length > 0 ?
      decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length : 0;
    
    // 平均ショット長
    const avgShotDuration = decisions.length > 0 ?
      decisions.reduce((sum, d) => sum + d.duration, 0) / decisions.length : 0;
    
    // カット頻度
    const cutFrequency = decisions.length / (music.duration / 1000);
    
    // トランジション品質
    const validTransitions = decisions.filter(d => 
      d.transition?.validation.isValid !== false
    ).length;
    const transitionQuality = decisions.length > 1 ? 
      validTransitions / (decisions.length - 1) : 1;
    
    // 音楽同期度
    const musicalAlignment = this.calculateMusicalAlignment(decisions, music);
    
    // 視覚的流れ
    const visualFlow = this.calculateVisualFlow(decisions);
    
    // 物語的一貫性
    const narrativeCohesion = this.calculateNarrativeCohesion(decisions);
    
    return {
      aggregateConfidence,
      avgShotDuration,
      cutFrequency,
      transitionQuality,
      musicalAlignment,
      visualFlow,
      narrativeCohesion,
    };
  }
  
  /**
   * 音楽同期度を計算
   */
  private calculateMusicalAlignment(
    decisions: EditDecision[],
    music: MusicAnalysisResult
  ): number {
    if (decisions.length === 0) return 0;
    
    let alignmentScore = 0;
    
    for (const decision of decisions) {
      if (decision.matchingDetails.editPoint) {
        // ビートとの同期
        if (decision.matchingDetails.editPoint.type === 'beat') {
          alignmentScore += 0.3;
        }
        // ダウンビートとの同期
        if (decision.matchingDetails.musicalContext?.isDownbeat) {
          alignmentScore += 0.2;
        }
      }
    }
    
    return Math.min(alignmentScore / decisions.length, 1.0);
  }
  
  /**
   * 視覚的流れを計算
   */
  private calculateVisualFlow(decisions: EditDecision[]): number {
    if (decisions.length < 2) return 1;
    
    let flowScore = 0;
    
    for (let i = 1; i < decisions.length; i++) {
      const transition = decisions[i].transition;
      if (transition?.validation.isValid) {
        flowScore += 1;
      } else if (transition?.validation.maxChange > 0.2) {
        flowScore += 0.5;
      }
    }
    
    return flowScore / (decisions.length - 1);
  }
  
  /**
   * 物語的一貫性を計算
   */
  private calculateNarrativeCohesion(decisions: EditDecision[]): number {
    // ショットの再利用パターンを分析
    const shotUsage = new Map<string, number>();
    
    for (const decision of decisions) {
      const count = shotUsage.get(decision.shot.id) || 0;
      shotUsage.set(decision.shot.id, count + 1);
    }
    
    // 適度な再利用があるほど一貫性が高い
    const reuseRate = Array.from(shotUsage.values()).filter(c => c > 1).length / shotUsage.size;
    
    return Math.min(reuseRate * 2, 1.0);
  }
  
  /**
   * セグメントを評価
   */
  private evaluateSegments(
    decisions: EditDecision[],
    music: MusicAnalysisResult
  ): EditPattern['segmentEvaluations'] {
    const evaluations: EditPattern['segmentEvaluations'] = [];
    
    if (!this.segmentConfig) return evaluations;
    
    for (const [name, segment] of Object.entries(this.segmentConfig.segments)) {
      const [startTime, endTime] = segment.range;
      
      // セグメント内の決定を取得
      const segmentDecisions = decisions.filter(d =>
        d.time >= startTime && d.time < endTime
      );
      
      const issues: string[] = [];
      let score = 0;
      
      // 評価基準
      if (segmentDecisions.length === 0) {
        issues.push('No edit decisions in segment');
      } else {
        // 平均確信度
        const avgConfidence = segmentDecisions.reduce((sum, d) => 
          sum + d.confidence, 0) / segmentDecisions.length;
        score += avgConfidence * 0.5;
        
        if (avgConfidence < 0.6) {
          issues.push(`Low confidence (${avgConfidence.toFixed(2)})`);
        }
        
        // 制約チェック
        if (name === 'opening' && segment.constraints.preferHeroShots) {
          const hasHeroShot = segmentDecisions.some(d => d.shot.isHeroShot);
          if (!hasHeroShot) {
            issues.push('No hero shot in opening');
          } else {
            score += 0.3;
          }
        }
        
        // ショット長チェック
        const avgDuration = segmentDecisions.reduce((sum, d) => 
          sum + d.duration, 0) / segmentDecisions.length;
        
        if (avgDuration < segment.constraints.minimumShotLength) {
          issues.push('Shots too short');
        } else if (avgDuration > segment.constraints.maximumShotLength) {
          issues.push('Shots too long');
        } else {
          score += 0.2;
        }
      }
      
      evaluations.push({
        segmentName: name,
        startTime,
        endTime,
        score: Math.min(score, 1.0),
        issues,
      });
    }
    
    return evaluations;
  }
  
  /**
   * 推奨パターンを選択
   */
  private selectRecommendedPattern(patterns: EditPattern[]): {
    pattern: 'dynamic_cut' | 'narrative_flow' | 'hybrid_balance';
    reason: string;
  } {
    // 各パターンのスコアを計算
    const scores = patterns.map(p => ({
      name: p.name,
      score: p.evaluation.aggregateConfidence * 0.4 +
             p.evaluation.transitionQuality * 0.3 +
             p.evaluation.musicalAlignment * 0.2 +
             p.evaluation.narrativeCohesion * 0.1,
    }));
    
    // 最高スコアのパターンを選択
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    
    // 推奨理由を生成
    let reason = `Highest overall score (${best.score.toFixed(2)})`;
    
    const pattern = patterns.find(p => p.name === best.name)!;
    if (pattern.evaluation.aggregateConfidence >= 0.88) {
      reason += '. Meets confidence threshold.';
    }
    if (pattern.evaluation.musicalAlignment > 0.8) {
      reason += ' Excellent music synchronization.';
    }
    if (pattern.evaluation.transitionQuality > 0.9) {
      reason += ' Smooth transitions.';
    }
    
    return {
      pattern: best.name as any,
      reason,
    };
  }
  
  /**
   * 全体品質を評価
   */
  private evaluateOverallQuality(patterns: EditPattern[]): MatchingResult['overallQuality'] {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];
    
    // 各パターンの平均スコアを計算
    const avgConfidence = patterns.reduce((sum, p) => 
      sum + p.evaluation.aggregateConfidence, 0) / patterns.length;
    
    const avgTransitionQuality = patterns.reduce((sum, p) => 
      sum + p.evaluation.transitionQuality, 0) / patterns.length;
    
    const avgMusicalAlignment = patterns.reduce((sum, p) => 
      sum + p.evaluation.musicalAlignment, 0) / patterns.length;
    
    // 強み
    if (avgConfidence >= 0.88) {
      strengths.push('High confidence in edit decisions');
    }
    if (avgTransitionQuality > 0.8) {
      strengths.push('Good transition quality (30% rule compliance)');
    }
    if (avgMusicalAlignment > 0.7) {
      strengths.push('Strong musical synchronization');
    }
    
    // 弱点
    if (avgConfidence < 0.7) {
      weaknesses.push('Low overall confidence');
      suggestions.push('Consider adjusting edit point sensitivity');
    }
    if (avgTransitionQuality < 0.6) {
      weaknesses.push('Poor transition quality');
      suggestions.push('Review shot selection for better visual variety');
    }
    if (avgMusicalAlignment < 0.5) {
      weaknesses.push('Weak musical alignment');
      suggestions.push('Increase beat detection sensitivity');
    }
    
    // 総合スコア
    const score = (avgConfidence + avgTransitionQuality + avgMusicalAlignment) / 3;
    
    return {
      score,
      strengths,
      weaknesses,
      suggestions,
    };
  }
  
  /**
   * explain.jsonデータを生成
   */
  private generateExplainData(
    patterns: EditPattern[],
    recommendation: { pattern: string; reason: string }
  ): ExplainData {
    const recommendedPattern = patterns.find(p => p.name === recommendation.pattern)!;
    
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      aggregateConfidence: recommendedPattern.evaluation.aggregateConfidence,
      
      decisions: recommendedPattern.decisions.map(d => ({
        id: d.id,
        time: d.time,
        shot: d.shot.id,
        confidence: d.confidence,
        reason: `${d.matchingDetails.editPoint?.reason || 'Manual selection'}`,
        scores: d.scores,
        context: {
          segment: d.matchingDetails.segmentName,
          musicalContext: d.matchingDetails.musicalContext,
          transition: d.transition?.validation,
        },
      })),
      
      qualityMetrics: {
        musicSync: recommendedPattern.evaluation.musicalAlignment,
        visualFlow: recommendedPattern.evaluation.visualFlow,
        narrativeCoherence: recommendedPattern.evaluation.narrativeCohesion,
        technicalQuality: recommendedPattern.evaluation.aggregateConfidence,
        thirtyPercentCompliance: recommendedPattern.evaluation.transitionQuality,
      },
      
      segmentAnalysis: recommendedPattern.segmentEvaluations.map(se => ({
        segment: se.segmentName,
        timeRange: [se.startTime, se.endTime] as [number, number],
        appliedWeights: this.segmentConfig!.segments[se.segmentName].weights,
        performance: {
          targetScore: 1.0,
          actualScore: se.score,
          gap: 1.0 - se.score,
        },
      })),
      
      statistics: {
        totalDecisions: recommendedPattern.decisions.length,
        avgConfidence: recommendedPattern.evaluation.aggregateConfidence,
        avgFlexibility: recommendedPattern.decisions.reduce((sum, d) => 
          sum + d.flexibility, 0) / recommendedPattern.decisions.length,
        shotUsage: this.calculateShotUsage(recommendedPattern.decisions),
        editPointTypes: this.calculateEditPointTypes(recommendedPattern.decisions),
      },
    };
  }
  
  /**
   * ショット使用統計
   */
  private calculateShotUsage(decisions: EditDecision[]): Record<string, number> {
    const usage: Record<string, number> = {};
    
    for (const decision of decisions) {
      usage[decision.shot.id] = (usage[decision.shot.id] || 0) + 1;
    }
    
    return usage;
  }
  
  /**
   * 編集点タイプ統計
   */
  private calculateEditPointTypes(decisions: EditDecision[]): Record<string, number> {
    const types: Record<string, number> = {};
    
    for (const decision of decisions) {
      const type = decision.matchingDetails.editPoint?.type || 'manual';
      types[type] = (types[type] || 0) + 1;
    }
    
    return types;
  }
}