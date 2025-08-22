import type { 
  Segment, 
  SegmentWeights,
  AnalysisSettingsConfig,
  Pattern 
} from '../types.js';

/**
 * 設定関連のユーティリティ関数
 */
export class ConfigUtils {
  /**
   * 時間（秒）をミリ秒に変換
   */
  static secondsToMs(seconds: number): number {
    return Math.round(seconds * 1000);
  }

  /**
   * ミリ秒を時間（秒）に変換
   */
  static msToSeconds(ms: number): number {
    return ms / 1000;
  }

  /**
   * タイムコードをミリ秒に変換
   * @param timecode "00:00:00.000" 形式
   */
  static timecodeToMs(timecode: string): number {
    const parts = timecode.split(':');
    if (parts.length !== 3) {
      throw new Error(`Invalid timecode format: ${timecode}`);
    }
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const secondsAndMs = parts[2].split('.');
    const seconds = parseInt(secondsAndMs[0], 10);
    const ms = secondsAndMs[1] ? parseInt(secondsAndMs[1].padEnd(3, '0'), 10) : 0;
    
    return (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;
  }

  /**
   * ミリ秒をタイムコードに変換
   */
  static msToTimecode(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    
    return `${hours.toString().padStart(2, '0')}:` +
           `${minutes.toString().padStart(2, '0')}:` +
           `${seconds.toString().padStart(2, '0')}.` +
           `${milliseconds.toString().padStart(3, '0')}`;
  }

  /**
   * 重みを正規化（合計を1.0にする）
   */
  static normalizeWeights(weights: Partial<SegmentWeights>): SegmentWeights {
    const defaultWeights: SegmentWeights = {
      visual: 0.25,
      sync: 0.25,
      semantic: 0.25,
      stability: 0.25,
    };
    
    const merged = { ...defaultWeights, ...weights };
    const sum = Object.values(merged).reduce((a, b) => a + b, 0);
    
    if (sum === 0) {
      return defaultWeights;
    }
    
    return {
      visual: merged.visual / sum,
      sync: merged.sync / sum,
      semantic: merged.semantic / sum,
      stability: merged.stability / sum,
    };
  }

  /**
   * パターンのモディファイアを適用
   */
  static applyPatternModifiers(
    baseWeights: SegmentWeights,
    pattern: Pattern
  ): SegmentWeights {
    const result = { ...baseWeights };
    
    for (const [key, modifier] of Object.entries(pattern.modifiers)) {
      if (key === 'all') {
        // すべての重みに適用
        for (const weightKey of Object.keys(result)) {
          (result as any)[weightKey] *= modifier;
        }
      } else if (key in result) {
        // 特定の重みに適用
        (result as any)[key] *= modifier;
      }
    }
    
    // 正規化
    return this.normalizeWeights(result);
  }

  /**
   * 相対値に変換（0-1の範囲に正規化）
   */
  static toRelativeValue(
    value: number,
    min: number,
    max: number,
    clamp: boolean = true
  ): number {
    if (max === min) return 0.5;
    
    let relative = (value - min) / (max - min);
    
    if (clamp) {
      relative = Math.max(0, Math.min(1, relative));
    }
    
    return relative;
  }

  /**
   * 相対値から実値に変換
   */
  static fromRelativeValue(
    relative: number,
    min: number,
    max: number
  ): number {
    return min + relative * (max - min);
  }

  /**
   * 30%変化の判定
   */
  static calculate30PercentChange(
    changes: Record<string, number>
  ): {
    isValid: boolean;
    maxChange: number;
    dimension: string | null;
  } {
    let maxChange = 0;
    let maxDimension: string | null = null;
    
    for (const [dimension, change] of Object.entries(changes)) {
      if (change > maxChange) {
        maxChange = change;
        maxDimension = dimension;
      }
    }
    
    return {
      isValid: maxChange >= 0.3,
      maxChange,
      dimension: maxDimension,
    };
  }

  /**
   * セグメント間の遷移をスムーズにする
   */
  static smoothSegmentTransition(
    fromSegment: Segment,
    toSegment: Segment,
    transitionDuration: number = 500 // ms
  ): {
    weights: SegmentWeights[];
    timestamps: number[];
  } {
    const steps = Math.ceil(transitionDuration / 100); // 100ms刻み
    const weights: SegmentWeights[] = [];
    const timestamps: number[] = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps; // 0.0 〜 1.0
      const eased = this.easeInOutCubic(t);
      
      weights.push({
        visual: this.lerp(fromSegment.weights.visual, toSegment.weights.visual, eased),
        sync: this.lerp(fromSegment.weights.sync, toSegment.weights.sync, eased),
        semantic: this.lerp(fromSegment.weights.semantic, toSegment.weights.semantic, eased),
        stability: this.lerp(fromSegment.weights.stability, toSegment.weights.stability, eased),
      });
      
      timestamps.push(fromSegment.range[1] - transitionDuration + (i * 100));
    }
    
    return { weights, timestamps };
  }

  /**
   * 線形補間
   */
  private static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * イージング関数（ease-in-out-cubic）
   */
  private static easeInOutCubic(t: number): number {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * メモリ使用量を推定
   */
  static estimateMemoryUsage(
    videoDuration: number, // 秒
    resolution: { width: number; height: number },
    fps: number
  ): {
    estimated: number; // MB
    warning: string | null;
  } {
    // 基本的な推定（1フレームあたりの解析データ）
    const bytesPerPixel = 4; // RGBA
    const frameSize = resolution.width * resolution.height * bytesPerPixel;
    const totalFrames = videoDuration * fps;
    
    // 解析データのオーバーヘッド（約10%）
    const analysisOverhead = 1.1;
    
    // キャッシュとワーキングメモリ（約2倍）
    const workingMemoryMultiplier = 2;
    
    const estimatedBytes = frameSize * totalFrames * analysisOverhead * workingMemoryMultiplier;
    const estimatedMB = Math.ceil(estimatedBytes / (1024 * 1024));
    
    let warning: string | null = null;
    if (estimatedMB > 4096) {
      warning = `High memory usage estimated (${estimatedMB}MB). Consider reducing resolution or frame rate.`;
    }
    
    return {
      estimated: estimatedMB,
      warning,
    };
  }

  /**
   * 処理時間を推定
   */
  static estimateProcessingTime(
    videoDuration: number, // 秒
    config: AnalysisSettingsConfig
  ): {
    estimated: number; // 秒
    breakdown: Record<string, number>;
  } {
    const breakdown: Record<string, number> = {};
    
    // 基本処理時間（動画長の約2倍）
    const baseTime = videoDuration * 2;
    
    // 音楽解析（高速）
    if (config.music.analysis.extractBeats) {
      breakdown.music = videoDuration * 0.5;
    }
    
    // 映像解析（重い）
    if (config.video.analysis.extractShots) {
      breakdown.video = videoDuration * 1.5;
    }
    
    // マッチング処理
    if (config.matching.optimization.method === 'dynamic_programming') {
      breakdown.matching = videoDuration * 0.8;
    } else if (config.matching.optimization.method === 'genetic') {
      breakdown.matching = videoDuration * 1.2;
    } else {
      breakdown.matching = videoDuration * 0.3;
    }
    
    // 並列処理による高速化
    const speedup = config.system.performance.maxWorkers > 1 ? 0.6 : 1.0;
    
    const total = Object.values(breakdown).reduce((a, b) => a + b, baseTime);
    const estimated = Math.ceil(total * speedup);
    
    return {
      estimated,
      breakdown,
    };
  }
}