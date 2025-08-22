/**
 * 映像解析の型定義
 */

// ショット情報
export interface Shot {
  id: string;
  startTime: number;      // ミリ秒
  endTime: number;        // ミリ秒
  duration: number;       // ミリ秒
  inPoint: number;        // 使用可能開始点（ミリ秒）
  outPoint: number;       // 使用可能終了点（ミリ秒）
  usableFrom: number;     // 安定使用可能時間（1秒後）
  stableFrom: number;     // 完全安定時間（4秒後）
  
  // 品質指標
  quality: {
    sharpness: number;    // 0.0-1.0（シャープネス）
    shake: number;        // 0.0-1.0（手ブレ度）
    lighting: number;     // 0.0-1.0（照明品質）
    composition: number;  // 0.0-1.0（構図スコア）
    overallScore: number; // 0.0-1.0（総合スコア）
  };
  
  // ヒーローショット判定
  isHeroShot: boolean;
  heroShotScore: number;  // 0.0-1.0
}

// シーン情報
export interface Scene {
  id: string;
  shots: Shot[];
  startTime: number;
  endTime: number;
  duration: number;
  
  // シーン特性
  characteristics: {
    avgMotion: number;      // 平均動き量
    colorPalette: Color[];  // 主要色
    dominantColor: Color;   // 支配的な色
    mood: 'bright' | 'dark' | 'neutral' | 'vibrant';
  };
}

// 色情報
export interface Color {
  r: number;
  g: number;
  b: number;
  h: number;  // Hue
  s: number;  // Saturation
  v: number;  // Value
  weight: number; // 0.0-1.0（出現頻度）
}

// モーション情報
export interface Motion {
  time: number;
  magnitude: number;      // 0.0-1.0（動きの大きさ）
  direction: number;      // 0-360（主要動き方向）
  complexity: number;     // 0.0-1.0（動きの複雑さ）
  type: 'static' | 'pan' | 'zoom' | 'complex';
}

// エッジ複雑性
export interface EdgeComplexity {
  time: number;
  score: number;          // 0.0-1.0
  edgeCount: number;      // エッジ数
  edgeDensity: number;    // エッジ密度
}

// 30%変化検証結果
export interface TransitionValidation {
  fromShot: string;
  toShot: string;
  changes: {
    position: number;     // 位置変化率
    size: number;         // サイズ変化率
    color: number;        // 色変化率
    motion: number;       // 動き変化率
  };
  isValid: boolean;       // 30%ルールを満たすか
  maxChange: number;      // 最大変化率
  changeDimension: string; // 最大変化の次元
}

// 顔検出情報
export interface Face {
  time: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  emotion?: string;       // 将来拡張用
}

// フレーム解析結果
export interface FrameAnalysis {
  frameNumber: number;
  time: number;
  
  // 基本特性
  sharpness: number;
  brightness: number;
  contrast: number;
  saturation: number;
  
  // 構図解析
  composition: {
    ruleOfThirds: number;   // 三分割法スコア
    balance: number;        // バランススコア
    leadingLines: number;   // リーディングラインスコア
  };
  
  // 色解析
  colors: {
    dominant: Color;
    palette: Color[];
    histogram: number[];
  };
  
  // エッジ解析
  edges: {
    count: number;
    density: number;
    complexity: number;
  };
  
  // モーション（前フレームとの比較）
  motion?: {
    vectors: Array<{x: number; y: number}>;
    magnitude: number;
    direction: number;
  };
}

// 映像解析結果
export interface VideoAnalysisResult {
  duration: number;           // 総時間（ミリ秒）
  frameCount: number;         // 総フレーム数
  fps: number;               // フレームレート
  resolution: {
    width: number;
    height: number;
  };
  
  // 解析結果
  shots: Shot[];             // ショットリスト
  scenes: Scene[];           // シーンリスト
  motion: Motion[];          // モーション解析結果
  edgeComplexity: EdgeComplexity[]; // エッジ複雑性
  faces: Face[];             // 顔検出結果
  
  // ヒーローショット
  heroShots: Shot[];         // ヒーローショット候補
  
  // 30%変化検証結果
  transitionValidations: TransitionValidation[];
  
  // 統計情報
  statistics: {
    avgShotDuration: number;
    avgMotion: number;
    avgSharpness: number;
    avgEdgeComplexity: number;
    shotCount: number;
    sceneCount: number;
  };
  
  // メタデータ
  metadata: {
    codec: string;
    bitrate: number;
    colorSpace: string;
  };
}

// 解析オプション
export interface VideoAnalysisOptions {
  // 基本設定
  extractShots: boolean;
  extractScenes: boolean;
  extractColors: boolean;
  extractMotion: boolean;
  extractFaces: boolean;
  
  // 品質解析
  detectBlur: boolean;
  detectShake: boolean;
  detectLighting: boolean;
  
  // 構成解析
  extractComposition: boolean;
  extractEdgeComplexity: boolean;
  extract30PercentChange: boolean;
  
  // 詳細設定
  frameSkip?: number;        // N フレームごとに解析
  shotDetectionThreshold?: number;
  sceneDetectionThreshold?: number;
  
  // ヒーローショット判定基準
  heroShotCriteria?: {
    minEdgeComplexity: number;
    minSharpness: number;
    minComposition: number;
  };
  
  // パフォーマンス設定
  parallel?: boolean;
  maxMemoryUsage?: number;
}