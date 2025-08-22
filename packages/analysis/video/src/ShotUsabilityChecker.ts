import type { Shot, FrameAnalysis } from './types.js';

/**
 * ショット使用可能性チェッカー
 * ショットの使用可能時間と品質を判定
 */
export class ShotUsabilityChecker {
  private readonly USABLE_AFTER_MS = 1000;    // 1秒後から使用可能
  private readonly STABLE_AFTER_MS = 4000;    // 4秒後から安定
  private readonly MIN_SHOT_DURATION = 500;   // 最小ショット長
  
  /**
   * ショットの使用可能性を評価
   */
  public evaluateShot(
    startTime: number,
    endTime: number,
    frameAnalyses: FrameAnalysis[]
  ): Partial<Shot> {
    const duration = endTime - startTime;
    
    // 使用可能時間を計算
    const usableFrom = startTime + this.USABLE_AFTER_MS;
    const stableFrom = startTime + this.STABLE_AFTER_MS;
    
    // In/Out点を決定
    let inPoint = startTime;
    let outPoint = endTime;
    
    // 短すぎるショットは使用不可
    if (duration < this.MIN_SHOT_DURATION) {
      return {
        startTime,
        endTime,
        duration,
        inPoint,
        outPoint,
        usableFrom: endTime, // 使用不可
        stableFrom: endTime,  // 使用不可
        quality: {
          sharpness: 0,
          shake: 1,
          lighting: 0,
          composition: 0,
          overallScore: 0,
        },
        isHeroShot: false,
        heroShotScore: 0,
      };
    }
    
    // 1秒以上のショットなら使用可能
    if (duration >= this.USABLE_AFTER_MS) {
      inPoint = usableFrom;
      
      // 最初と最後の不安定部分を除外
      const trimStart = this.findStableStart(frameAnalyses);
      const trimEnd = this.findStableEnd(frameAnalyses);
      
      if (trimStart > 0) {
        inPoint = Math.max(inPoint, startTime + trimStart);
      }
      if (trimEnd > 0) {
        outPoint = Math.min(outPoint, endTime - trimEnd);
      }
    }
    
    // 品質を評価
    const quality = this.evaluateQuality(frameAnalyses);
    
    // ヒーローショット判定
    const { isHero, score } = this.evaluateHeroShot(quality, frameAnalyses);
    
    return {
      startTime,
      endTime,
      duration,
      inPoint,
      outPoint,
      usableFrom,
      stableFrom,
      quality,
      isHeroShot: isHero,
      heroShotScore: score,
    };
  }
  
  /**
   * 安定開始点を見つける
   */
  private findStableStart(frames: FrameAnalysis[]): number {
    if (frames.length < 10) return 0;
    
    // 最初の10フレームの品質を確認
    const initialFrames = frames.slice(0, 10);
    const avgSharpness = this.average(initialFrames.map(f => f.sharpness));
    const avgMotion = this.averageMotion(initialFrames);
    
    // 不安定な場合はトリミング
    if (avgSharpness < 0.3 || avgMotion > 0.7) {
      // 安定するフレームを探す
      for (let i = 10; i < Math.min(30, frames.length); i++) {
        const windowFrames = frames.slice(i - 5, i + 5);
        const windowSharpness = this.average(windowFrames.map(f => f.sharpness));
        const windowMotion = this.averageMotion(windowFrames);
        
        if (windowSharpness > 0.5 && windowMotion < 0.5) {
          return i * (1000 / 30); // フレーム数をミリ秒に変換（30fps想定）
        }
      }
      
      return 1000; // デフォルト1秒トリミング
    }
    
    return 0;
  }
  
  /**
   * 安定終了点を見つける
   */
  private findStableEnd(frames: FrameAnalysis[]): number {
    if (frames.length < 10) return 0;
    
    // 最後の10フレームの品質を確認
    const finalFrames = frames.slice(-10);
    const avgSharpness = this.average(finalFrames.map(f => f.sharpness));
    const avgMotion = this.averageMotion(finalFrames);
    
    // 不安定な場合はトリミング
    if (avgSharpness < 0.3 || avgMotion > 0.7) {
      // 安定するフレームを探す（逆順）
      for (let i = frames.length - 10; i >= Math.max(frames.length - 30, 0); i--) {
        const windowFrames = frames.slice(Math.max(0, i - 5), Math.min(frames.length, i + 5));
        const windowSharpness = this.average(windowFrames.map(f => f.sharpness));
        const windowMotion = this.averageMotion(windowFrames);
        
        if (windowSharpness > 0.5 && windowMotion < 0.5) {
          return (frames.length - i) * (1000 / 30);
        }
      }
      
      return 500; // デフォルト0.5秒トリミング
    }
    
    return 0;
  }
  
  /**
   * 品質を評価
   */
  private evaluateQuality(frames: FrameAnalysis[]): Shot['quality'] {
    if (frames.length === 0) {
      return {
        sharpness: 0,
        shake: 1,
        lighting: 0,
        composition: 0,
        overallScore: 0,
      };
    }
    
    // 各指標の平均を計算
    const sharpness = this.average(frames.map(f => f.sharpness));
    const brightness = this.average(frames.map(f => f.brightness));
    const composition = this.average(frames.map(f => 
      (f.composition.ruleOfThirds + f.composition.balance + f.composition.leadingLines) / 3
    ));
    
    // 手ブレを推定（モーションの変動から）
    const shake = this.estimateShake(frames);
    
    // 照明品質（明るさとコントラストから）
    const contrast = this.average(frames.map(f => f.contrast));
    const lighting = this.evaluateLighting(brightness, contrast);
    
    // 総合スコア
    const overallScore = (
      sharpness * 0.3 +
      (1 - shake) * 0.2 +
      lighting * 0.2 +
      composition * 0.3
    );
    
    return {
      sharpness: this.clamp(sharpness),
      shake: this.clamp(shake),
      lighting: this.clamp(lighting),
      composition: this.clamp(composition),
      overallScore: this.clamp(overallScore),
    };
  }
  
  /**
   * ヒーローショット判定
   */
  private evaluateHeroShot(
    quality: Shot['quality'],
    frames: FrameAnalysis[]
  ): { isHero: boolean; score: number } {
    // エッジ複雑性の平均
    const avgEdgeComplexity = this.average(
      frames.map(f => f.edges.complexity)
    );
    
    // ヒーローショットの基準
    const criteria = {
      minEdgeComplexity: 0.7,
      minSharpness: 0.8,
      minComposition: 0.6,
      minOverallScore: 0.75,
    };
    
    // スコア計算
    const score = (
      (avgEdgeComplexity / criteria.minEdgeComplexity) * 0.3 +
      (quality.sharpness / criteria.minSharpness) * 0.3 +
      (quality.composition / criteria.minComposition) * 0.2 +
      (quality.overallScore / criteria.minOverallScore) * 0.2
    );
    
    // 判定
    const isHero = (
      avgEdgeComplexity >= criteria.minEdgeComplexity &&
      quality.sharpness >= criteria.minSharpness &&
      quality.composition >= criteria.minComposition &&
      quality.overallScore >= criteria.minOverallScore
    );
    
    return {
      isHero,
      score: this.clamp(score),
    };
  }
  
  /**
   * 手ブレを推定
   */
  private estimateShake(frames: FrameAnalysis[]): number {
    const motions = frames
      .filter(f => f.motion)
      .map(f => f.motion!.magnitude);
    
    if (motions.length < 2) return 0;
    
    // モーションの変動を計算
    const variations: number[] = [];
    for (let i = 1; i < motions.length; i++) {
      variations.push(Math.abs(motions[i] - motions[i - 1]));
    }
    
    // 変動が大きいほど手ブレ
    const avgVariation = this.average(variations);
    const maxVariation = Math.max(...variations);
    
    // 0-1にスケーリング
    const shake = (avgVariation * 0.7 + maxVariation * 0.3);
    
    return this.clamp(shake);
  }
  
  /**
   * 照明品質を評価
   */
  private evaluateLighting(brightness: number, contrast: number): number {
    // 理想的な明るさとコントラストに近いほど高スコア
    const idealBrightness = 0.5;
    const idealContrast = 0.6;
    
    const brightnessDiff = Math.abs(brightness - idealBrightness);
    const contrastDiff = Math.abs(contrast - idealContrast);
    
    // 差が小さいほど高スコア
    const brightnessScore = 1 - (brightnessDiff * 2);
    const contrastScore = 1 - (contrastDiff * 1.5);
    
    return this.clamp((brightnessScore + contrastScore) / 2);
  }
  
  /**
   * モーションの平均を計算
   */
  private averageMotion(frames: FrameAnalysis[]): number {
    const motions = frames
      .filter(f => f.motion)
      .map(f => f.motion!.magnitude);
    
    return motions.length > 0 ? this.average(motions) : 0;
  }
  
  /**
   * 平均を計算
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * 値を0-1の範囲にクランプ
   */
  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}