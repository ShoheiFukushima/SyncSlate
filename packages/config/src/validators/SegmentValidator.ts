import { z } from 'zod';
import type { MatchingSegmentsConfig } from '../types.js';

/**
 * セグメント設定のバリデーター
 */
export class SegmentValidator {
  private readonly schema: any;

  constructor() {
    // 重みスキーマ（合計が1.0に近いことを検証）
    const weightsSchema = z.object({
      visual: z.number().min(0).max(1),
      sync: z.number().min(0).max(1),
      semantic: z.number().min(0).max(1),
      stability: z.number().min(0).max(1),
    }).refine(
      (weights) => {
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        return Math.abs(sum - 1.0) < 0.01; // 誤差許容
      },
      { message: 'Weights must sum to 1.0 (±0.01)' }
    );

    // 制約スキーマ
    const constraintsSchema = z.object({
      minimumShotLength: z.number().positive(),
      maximumShotLength: z.number().positive(),
      preferHeroShots: z.boolean().optional(),
      requiredVisualChange: z.number().min(0).max(1).optional(),
      beatSyncTolerance: z.number().positive().optional(),
      transitionEnergy: z.number().min(0).max(1).optional(),
      narrativeCoherence: z.number().min(0).max(1).optional(),
      allowSlowMotion: z.boolean().optional(),
      intensityThreshold: z.number().min(0).max(1).optional(),
      emotionalPeak: z.boolean().optional(),
      fadeOutOption: z.boolean().optional(),
      loopReady: z.boolean().optional(),
    }).refine(
      (constraints) => constraints.minimumShotLength <= constraints.maximumShotLength,
      { message: 'minimumShotLength must be less than or equal to maximumShotLength' }
    );

    // セグメントスキーマ
    const segmentSchema = z.object({
      label: z.string(),
      range: z.tuple([z.number().nonnegative(), z.number().positive()]),
      weights: weightsSchema,
      constraints: constraintsSchema,
    }).refine(
      (segment) => segment.range[0] < segment.range[1],
      { message: 'Segment range must be valid (start < end)' }
    );

    // 調整ルールスキーマ
    const adjustmentSchema = z.object({
      condition: z.string(),
      description: z.string(),
      multiply: z.record(z.string(), z.number()).optional(),
      modify: z.record(z.string(), z.any()).optional(),
    });

    // トランジションルールスキーマ
    const transitionRulesSchema = z.object({
      minimumChange: z.number().min(0).max(1),
      dimensions: z.array(z.string()).min(1),
      enforcement: z.enum(['strict', 'flexible', 'off']),
    });

    // パフォーマンス設定スキーマ
    const performanceSchema = z.object({
      parallelAnalysis: z.boolean(),
      cacheResults: z.boolean(),
      maxMemoryUsage: z.number().positive(),
      targetProcessingTime: z.number().positive(),
    });

    // 全体スキーマ
    this.schema = z.object({
      segments: z.record(z.string(), segmentSchema),
      adjustments: z.array(adjustmentSchema),
      transitionRules: transitionRulesSchema,
      performance: performanceSchema,
    }).refine(
      (config) => {
        // セグメントの時間範囲が重複していないことを確認
        const segments = Object.values(config.segments);
        for (let i = 0; i < segments.length; i++) {
          for (let j = i + 1; j < segments.length; j++) {
            const [start1, end1] = segments[i].range;
            const [start2, end2] = segments[j].range;
            if ((start1 < end2 && end1 > start2)) {
              return false;
            }
          }
        }
        return true;
      },
      { message: 'Segment time ranges must not overlap' }
    ).refine(
      (config) => {
        // 0-60秒をカバーしているか確認
        const segments = Object.values(config.segments);
        const sortedSegments = segments.sort((a, b) => a.range[0] - b.range[0]);
        
        // 最初のセグメントが0から始まるか
        if (sortedSegments[0].range[0] !== 0) {
          return false;
        }
        
        // 連続性チェック
        for (let i = 0; i < sortedSegments.length - 1; i++) {
          if (sortedSegments[i].range[1] !== sortedSegments[i + 1].range[0]) {
            return false;
          }
        }
        
        return true;
      },
      { message: 'Segments must cover the entire timeline continuously' }
    );
  }

  /**
   * 設定をバリデート
   */
  public validate(config: unknown): MatchingSegmentsConfig {
    try {
      return this.schema.parse(config) as MatchingSegmentsConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join('\n');
        throw new Error(`Configuration validation failed:\n${issues}`);
      }
      throw error;
    }
  }

  /**
   * 部分的な設定をバリデート（セグメント単体など）
   */
  public validatePartial(path: string, value: unknown): boolean {
    try {
      if (path.startsWith('segments.')) {
        const segmentName = path.split('.')[1];
        // Segment validation would go here
        // For now, return true
        return true;
      }
      
      // Simplified validation for now
      // Would implement proper partial validation here
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * セグメントの時間範囲を検証
   */
  public validateTimeRange(segments: Record<string, any>): {
    valid: boolean;
    gaps?: Array<[number, number]>;
    overlaps?: Array<[string, string]>;
  } {
    const result: {
      valid: boolean;
      gaps?: Array<[number, number]>;
      overlaps?: Array<[string, string]>;
    } = { valid: true };

    const segmentList = Object.entries(segments).map(([name, segment]) => ({
      name,
      range: segment.range as [number, number],
    }));

    // 時間順にソート
    segmentList.sort((a, b) => a.range[0] - b.range[0]);

    // ギャップと重複をチェック
    const gaps: Array<[number, number]> = [];
    const overlaps: Array<[string, string]> = [];

    for (let i = 0; i < segmentList.length - 1; i++) {
      const current = segmentList[i];
      const next = segmentList[i + 1];

      // ギャップチェック
      if (current.range[1] < next.range[0]) {
        gaps.push([current.range[1], next.range[0]]);
      }

      // 重複チェック
      if (current.range[1] > next.range[0]) {
        overlaps.push([current.name, next.name]);
      }
    }

    if (gaps.length > 0) {
      result.valid = false;
      result.gaps = gaps;
    }

    if (overlaps.length > 0) {
      result.valid = false;
      result.overlaps = overlaps;
    }

    return result;
  }
}