/**
 * AutoEditTATE 設定型定義
 */

// セグメント重み
export interface SegmentWeights {
  visual: number;      // 視覚的インパクト
  sync: number;        // リズム同期
  semantic: number;    // 意味的な繋がり
  stability: number;   // 安定性
}

// セグメント制約
export interface SegmentConstraints {
  minimumShotLength: number;      // 最小ショット長（ms）
  maximumShotLength: number;      // 最大ショット長（ms）
  preferHeroShots?: boolean;      // ヒーローショット優先
  requiredVisualChange?: number;  // 必要な視覚変化率
  beatSyncTolerance?: number;     // ビート同期許容誤差
  transitionEnergy?: number;      // トランジション強度
  narrativeCoherence?: number;    // 物語性の一貫性
  allowSlowMotion?: boolean;      // スローモーション許可
  intensityThreshold?: number;    // 強度閾値
  emotionalPeak?: boolean;        // 感情的ピーク
  fadeOutOption?: boolean;        // フェードアウトオプション
  loopReady?: boolean;            // ループ対応
}

// セグメント定義
export interface Segment {
  label: string;
  range: [number, number];  // [開始ms, 終了ms]
  weights: SegmentWeights;
  constraints: SegmentConstraints;
}

// 動的調整ルール
export interface Adjustment {
  condition: string;
  description: string;
  multiply?: Partial<SegmentWeights>;
  modify?: Record<string, any>;
}

// トランジションルール
export interface TransitionRules {
  minimumChange: number;
  dimensions: string[];
  enforcement: 'strict' | 'flexible' | 'off';
}

// マッチングセグメント設定
export interface MatchingSegmentsConfig {
  segments: Record<string, Segment>;
  adjustments: Adjustment[];
  transitionRules: TransitionRules;
  performance: {
    parallelAnalysis: boolean;
    cacheResults: boolean;
    maxMemoryUsage: number;
    targetProcessingTime: number;
  };
}

// 音楽解析設定
export interface MusicAnalysisConfig {
  analysis: {
    extractBPM: boolean;
    extractBeats: boolean;
    extractOnsets: boolean;
    extractTempo: boolean;
    extractKey: boolean;
    extractChroma: boolean;
    extractMFCC: boolean;
    extractSpectralCentroid: boolean;
    extractRMS: boolean;
    detectSegments: boolean;
    detectChorus: boolean;
    detectVerse: boolean;
  };
  parameters: {
    fftSize: number;
    hopLength: number;
    sampleRate: number;
    beatTrackingMethod: string;
    onsetMethod: string;
    normalization: boolean;
    dynamicRange: [number, number];
  };
  thresholds: {
    onsetThreshold: number;
    beatStrength: number;
    tempoChangeThreshold: number;
  };
}

// 映像解析設定
export interface VideoAnalysisConfig {
  analysis: {
    extractShots: boolean;
    extractScenes: boolean;
    extractColors: boolean;
    extractMotion: boolean;
    extractFaces: boolean;
    detectBlur: boolean;
    detectShake: boolean;
    detectLighting: boolean;
    extractComposition: boolean;
    extractEdgeComplexity: boolean;
    extract30PercentChange: boolean;
  };
  parameters: {
    frameSkip: number;
    shotDetectionThreshold: number;
    sceneDetectionThreshold: number;
    opticalFlowMethod: string;
    motionVectorScale: number;
    colorSpace: string;
    colorBins: number;
  };
  quality: {
    minimumSharpness: number;
    maximumShake: number;
    minimumLighting: number;
    heroShotCriteria: {
      edgeComplexity: number;
      sharpness: number;
      composition: number;
    };
  };
}

// パターン定義
export interface Pattern {
  name: string;
  description: string;
  modifiers: Record<string, number>;
}

// 解析設定全体
export interface AnalysisSettingsConfig {
  music: MusicAnalysisConfig;
  video: VideoAnalysisConfig;
  lyrics: {
    enabled: boolean;
    analysis?: {
      extractTimestamps: boolean;
      extractSentiment: boolean;
      extractKeywords: boolean;
    };
    synchronization?: {
      method: string;
      tolerance: number;
    };
  };
  matching: {
    scoring: {
      method: string;
      confidenceThreshold: number;
      flexibilityRange: number;
    };
    optimization: {
      method: string;
      iterations: number;
      convergenceThreshold: number;
    };
    patterns: Pattern[];
  };
  export: {
    formats: {
      xml: {
        enabled: boolean;
        version: string;
        includeMetadata: boolean;
      };
      json: {
        enabled: boolean;
        pretty: boolean;
        includeExplanation: boolean;
      };
    };
    paths: {
      outputDirectory: string;
      tempDirectory: string;
      cacheDirectory: string;
    };
  };
  system: {
    logging: {
      level: string;
      file: string;
      console: boolean;
    };
    performance: {
      maxWorkers: number;
      memoryLimit: number;
      gpuAcceleration: boolean;
    };
    validation: {
      strict: boolean;
      validateInput: boolean;
      validateOutput: boolean;
    };
  };
}