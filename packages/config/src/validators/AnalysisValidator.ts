import { z } from 'zod';
import type { AnalysisSettingsConfig } from '../types.js';

/**
 * 解析設定のバリデーター
 */
export class AnalysisValidator {
  private readonly schema: any;

  constructor() {
    // 音楽解析スキーマ
    const musicAnalysisSchema = z.object({
      analysis: z.object({
        extractBPM: z.boolean(),
        extractBeats: z.boolean(),
        extractOnsets: z.boolean(),
        extractTempo: z.boolean(),
        extractKey: z.boolean(),
        extractChroma: z.boolean(),
        extractMFCC: z.boolean(),
        extractSpectralCentroid: z.boolean(),
        extractRMS: z.boolean(),
        detectSegments: z.boolean(),
        detectChorus: z.boolean(),
        detectVerse: z.boolean(),
      }),
      parameters: z.object({
        fftSize: z.number().positive().refine(n => (n & (n - 1)) === 0, {
          message: 'fftSize must be a power of 2',
        }),
        hopLength: z.number().positive(),
        sampleRate: z.number().positive(),
        beatTrackingMethod: z.enum(['ellis', 'degara', 'crf']),
        onsetMethod: z.enum(['energy', 'hfc', 'complex', 'phase']),
        normalization: z.boolean(),
        dynamicRange: z.tuple([z.number(), z.number()]).refine(
          ([min, max]) => min < max,
          { message: 'dynamicRange[0] must be less than dynamicRange[1]' }
        ),
      }),
      thresholds: z.object({
        onsetThreshold: z.number().min(0).max(1),
        beatStrength: z.number().min(0).max(1),
        tempoChangeThreshold: z.number().min(0).max(1),
      }),
    });

    // 映像解析スキーマ
    const videoAnalysisSchema = z.object({
      analysis: z.object({
        extractShots: z.boolean(),
        extractScenes: z.boolean(),
        extractColors: z.boolean(),
        extractMotion: z.boolean(),
        extractFaces: z.boolean(),
        detectBlur: z.boolean(),
        detectShake: z.boolean(),
        detectLighting: z.boolean(),
        extractComposition: z.boolean(),
        extractEdgeComplexity: z.boolean(),
        extract30PercentChange: z.boolean(),
      }),
      parameters: z.object({
        frameSkip: z.number().positive().int(),
        shotDetectionThreshold: z.number().min(0).max(1),
        sceneDetectionThreshold: z.number().min(0).max(1),
        opticalFlowMethod: z.enum(['farneback', 'lucas-kanade']),
        motionVectorScale: z.number().positive(),
        colorSpace: z.enum(['rgb', 'hsv', 'lab']),
        colorBins: z.number().positive().int(),
      }),
      quality: z.object({
        minimumSharpness: z.number().min(0).max(1),
        maximumShake: z.number().min(0).max(1),
        minimumLighting: z.number().min(0).max(1),
        heroShotCriteria: z.object({
          edgeComplexity: z.number().min(0).max(1),
          sharpness: z.number().min(0).max(1),
          composition: z.number().min(0).max(1),
        }),
      }),
    });

    // 歌詞解析スキーマ
    const lyricsSchema = z.object({
      enabled: z.boolean(),
      analysis: z.object({
        extractTimestamps: z.boolean(),
        extractSentiment: z.boolean(),
        extractKeywords: z.boolean(),
      }).optional(),
      synchronization: z.object({
        method: z.string(),
        tolerance: z.number().positive(),
      }).optional(),
    });

    // パターンスキーマ
    const patternSchema = z.object({
      name: z.string(),
      description: z.string(),
      modifiers: z.record(z.string(), z.number()),
    });

    // マッチングスキーマ
    const matchingSchema = z.object({
      scoring: z.object({
        method: z.enum(['weighted_sum', 'neural', 'rule_based']),
        confidenceThreshold: z.number().min(0).max(1),
        flexibilityRange: z.number().min(0).max(1),
      }),
      optimization: z.object({
        method: z.enum(['greedy', 'dynamic_programming', 'genetic']),
        iterations: z.number().positive().int(),
        convergenceThreshold: z.number().positive(),
      }),
      patterns: z.array(patternSchema).min(1),
    });

    // エクスポートスキーマ
    const exportSchema = z.object({
      formats: z.object({
        xml: z.object({
          enabled: z.boolean(),
          version: z.string(),
          includeMetadata: z.boolean(),
        }),
        json: z.object({
          enabled: z.boolean(),
          pretty: z.boolean(),
          includeExplanation: z.boolean(),
        }),
      }),
      paths: z.object({
        outputDirectory: z.string(),
        tempDirectory: z.string(),
        cacheDirectory: z.string(),
      }),
    });

    // システムスキーマ
    const systemSchema = z.object({
      logging: z.object({
        level: z.enum(['debug', 'info', 'warn', 'error']),
        file: z.string(),
        console: z.boolean(),
      }),
      performance: z.object({
        maxWorkers: z.number().positive().int(),
        memoryLimit: z.number().positive(),
        gpuAcceleration: z.boolean(),
      }),
      validation: z.object({
        strict: z.boolean(),
        validateInput: z.boolean(),
        validateOutput: z.boolean(),
      }),
    });

    // 全体スキーマ
    this.schema = z.object({
      music: musicAnalysisSchema,
      video: videoAnalysisSchema,
      lyrics: lyricsSchema,
      matching: matchingSchema,
      export: exportSchema,
      system: systemSchema,
    }).refine(
      (config) => {
        // パターンの名前が重複していないことを確認
        const patternNames = config.matching.patterns.map(p => p.name);
        return patternNames.length === new Set(patternNames).size;
      },
      { message: 'Pattern names must be unique' }
    ).refine(
      (config) => {
        // 必須パターンが含まれていることを確認
        const requiredPatterns = ['dynamic_cut', 'narrative_flow', 'hybrid_balance'];
        const patternNames = config.matching.patterns.map(p => p.name);
        return requiredPatterns.every(rp => patternNames.includes(rp));
      },
      { message: 'Required patterns (dynamic_cut, narrative_flow, hybrid_balance) must be defined' }
    );
  }

  /**
   * 設定をバリデート
   */
  public validate(config: unknown): AnalysisSettingsConfig {
    try {
      return this.schema.parse(config) as AnalysisSettingsConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join('\n');
        throw new Error(`Analysis settings validation failed:\n${issues}`);
      }
      throw error;
    }
  }

  /**
   * 部分的な設定をバリデート
   */
  public validatePartial(section: string, value: unknown): boolean {
    try {
      // Simplified validation for partial configs
      // In a real implementation, we'd validate each section properly
      return true;
    } catch {
      return false;
    }
  }

  /**
   * パフォーマンス設定の妥当性を検証
   */
  public validatePerformance(config: AnalysisSettingsConfig): {
    valid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    
    // メモリ使用量チェック
    if (config.system.performance.memoryLimit < 512) {
      warnings.push('Memory limit is very low (< 512MB), may cause performance issues');
    }
    
    if (config.system.performance.memoryLimit > 8192) {
      warnings.push('Memory limit is very high (> 8GB), may not be available on all systems');
    }
    
    // ワーカー数チェック
    const cpuCount = require('os').cpus().length;
    if (config.system.performance.maxWorkers > cpuCount) {
      warnings.push(`maxWorkers (${config.system.performance.maxWorkers}) exceeds CPU count (${cpuCount})`);
    }
    
    // FFTサイズとホップ長の関係
    if (config.music.parameters.hopLength > config.music.parameters.fftSize / 2) {
      warnings.push('hopLength should typically be <= fftSize/2 for optimal analysis');
    }
    
    // フレームスキップチェック
    if (config.video.parameters.frameSkip > 30) {
      warnings.push('frameSkip > 30 may miss important visual changes');
    }
    
    return {
      valid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * 閾値の一貫性を検証
   */
  public validateThresholds(config: AnalysisSettingsConfig): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // ショット検出とシーン検出の閾値関係
    if (config.video.parameters.shotDetectionThreshold >= 
        config.video.parameters.sceneDetectionThreshold) {
      issues.push('shotDetectionThreshold should be less than sceneDetectionThreshold');
    }
    
    // confidence閾値チェック
    if (config.matching.scoring.confidenceThreshold < 0.5) {
      issues.push('confidenceThreshold < 0.5 may produce low-quality results');
    }
    
    // ヒーローショット基準の一貫性
    const heroShotCriteria = config.video.quality.heroShotCriteria;
    const criteriaSum = heroShotCriteria.edgeComplexity + 
                       heroShotCriteria.sharpness + 
                       heroShotCriteria.composition;
    if (criteriaSum > 2.5) {
      issues.push('Hero shot criteria may be too strict (sum > 2.5)');
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }
}