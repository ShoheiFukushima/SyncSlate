import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { ConfigLoader } from '@autoedittate/config';
import { ShotUsabilityChecker } from './ShotUsabilityChecker.js';
import { TransitionValidator } from './TransitionValidator.js';
import type {
  VideoAnalysisResult,
  VideoAnalysisOptions,
  Shot,
  Scene,
  Motion,
  EdgeComplexity,
  Face,
  FrameAnalysis,
  Color,
} from './types.js';

/**
 * 映像解析エンジン
 * 映像ファイルを解析し、ショット・シーン・品質情報を抽出
 */
export class VideoAnalyzer {
  private readonly options: VideoAnalysisOptions;
  private readonly configLoader: ConfigLoader;
  private readonly usabilityChecker: ShotUsabilityChecker;
  private readonly transitionValidator: TransitionValidator;
  
  constructor(options?: Partial<VideoAnalysisOptions>) {
    this.options = {
      extractShots: true,
      extractScenes: true,
      extractColors: true,
      extractMotion: true,
      extractFaces: false, // デフォルトでは無効（重い処理）
      detectBlur: true,
      detectShake: true,
      detectLighting: true,
      extractComposition: true,
      extractEdgeComplexity: true,
      extract30PercentChange: true,
      frameSkip: 5, // 5フレームごとに解析
      shotDetectionThreshold: 0.3,
      sceneDetectionThreshold: 0.5,
      heroShotCriteria: {
        minEdgeComplexity: 0.7,
        minSharpness: 0.8,
        minComposition: 0.6,
      },
      parallel: true,
      maxMemoryUsage: 2048,
      ...options,
    };
    
    this.configLoader = ConfigLoader.getInstance();
    this.usabilityChecker = new ShotUsabilityChecker();
    this.transitionValidator = new TransitionValidator();
  }
  
  /**
   * 映像ファイルを解析
   */
  public async analyze(videoPath: string): Promise<VideoAnalysisResult> {
    console.log(`Analyzing video: ${videoPath}`);
    
    // メタデータを取得
    const metadata = await this.extractMetadata(videoPath);
    
    // フレームを抽出
    const framesDir = await this.extractFrames(videoPath, metadata.fps);
    
    // フレームを解析
    const frameAnalyses = await this.analyzeFrames(framesDir);
    
    // ショットを検出
    const shots = await this.detectShots(frameAnalyses);
    
    // シーンを検出
    const scenes = this.detectScenes(shots, frameAnalyses);
    
    // モーション解析
    const motion = this.extractMotion(frameAnalyses);
    
    // エッジ複雑性
    const edgeComplexity = this.extractEdgeComplexity(frameAnalyses);
    
    // 顔検出（オプション）
    const faces = this.options.extractFaces ? 
      await this.detectFaces(frameAnalyses) : [];
    
    // ヒーローショットを特定
    const heroShots = shots.filter(s => s.isHeroShot);
    
    // 30%変化検証
    const transitionValidations = this.options.extract30PercentChange ?
      this.validateTransitions(shots, frameAnalyses) : [];
    
    // 統計情報を計算
    const statistics = this.calculateStatistics(shots, scenes, frameAnalyses);
    
    // 一時ファイルをクリーンアップ
    await this.cleanup(framesDir);
    
    return {
      duration: metadata.duration,
      frameCount: metadata.frameCount,
      fps: metadata.fps,
      resolution: metadata.resolution,
      shots,
      scenes,
      motion,
      edgeComplexity,
      faces,
      heroShots,
      transitionValidations,
      statistics,
      metadata,
    };
  }
  
  /**
   * メタデータを抽出
   */
  private async extractMetadata(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }
        
        const fps = eval(videoStream.r_frame_rate || '30/1');
        const duration = (metadata.format.duration || 0) * 1000;
        const frameCount = Math.floor(duration * fps / 1000);
        
        resolve({
          duration,
          frameCount,
          fps,
          resolution: {
            width: videoStream.width || 1920,
            height: videoStream.height || 1080,
          },
          codec: videoStream.codec_name || 'unknown',
          bitrate: metadata.format.bit_rate || 0,
          colorSpace: videoStream.color_space || 'unknown',
        });
      });
    });
  }
  
  /**
   * フレームを抽出
   */
  private async extractFrames(videoPath: string, fps: number): Promise<string> {
    const framesDir = path.join(
      path.dirname(videoPath),
      `frames_${Date.now()}`
    );
    
    await fs.mkdir(framesDir, { recursive: true });
    
    const frameRate = Math.max(1, Math.floor(fps / this.options.frameSkip!));
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          `-vf fps=${frameRate}`,
          '-q:v 2', // 高品質
        ])
        .output(path.join(framesDir, 'frame_%06d.jpg'))
        .on('end', () => resolve(framesDir))
        .on('error', reject)
        .run();
    });
  }
  
  /**
   * フレームを解析
   */
  private async analyzeFrames(framesDir: string): Promise<FrameAnalysis[]> {
    const frameFiles = await fs.readdir(framesDir);
    frameFiles.sort(); // ファイル名順にソート
    
    const analyses: FrameAnalysis[] = [];
    let prevFrame: FrameAnalysis | null = null;
    
    for (let i = 0; i < frameFiles.length; i++) {
      const framePath = path.join(framesDir, frameFiles[i]);
      const frameNumber = i;
      const time = (i * this.options.frameSkip! * 1000) / 30; // 30fps想定
      
      const analysis = await this.analyzeFrame(
        framePath,
        frameNumber,
        time,
        prevFrame
      );
      
      analyses.push(analysis);
      prevFrame = analysis;
    }
    
    return analyses;
  }
  
  /**
   * 単一フレームを解析
   */
  private async analyzeFrame(
    framePath: string,
    frameNumber: number,
    time: number,
    prevFrame: FrameAnalysis | null
  ): Promise<FrameAnalysis> {
    const image = sharp(framePath);
    const metadata = await image.metadata();
    const stats = await image.stats();
    
    // 基本特性
    const sharpness = await this.calculateSharpness(image);
    const brightness = this.calculateBrightness(stats);
    const contrast = this.calculateContrast(stats);
    const saturation = this.calculateSaturation(stats);
    
    // 構図解析
    const composition = await this.analyzeComposition(image, metadata);
    
    // 色解析
    const colors = await this.analyzeColors(image, stats);
    
    // エッジ解析
    const edges = await this.analyzeEdges(image);
    
    // モーション（前フレームとの比較）
    const motion = prevFrame ? 
      await this.calculateMotion(framePath, prevFrame) : undefined;
    
    return {
      frameNumber,
      time,
      sharpness,
      brightness,
      contrast,
      saturation,
      composition,
      colors,
      edges,
      motion,
    };
  }
  
  /**
   * シャープネスを計算
   */
  private async calculateSharpness(image: sharp.Sharp): Promise<number> {
    // ラプラシアンフィルタを使用したシャープネス推定
    const { data, info } = await image
      .greyscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0], // ラプラシアンカーネル
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // 分散を計算（高いほどシャープ）
    const pixels = new Uint8Array(data);
    const mean = pixels.reduce((sum, val) => sum + val, 0) / pixels.length;
    const variance = pixels.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pixels.length;
    
    // 0-1に正規化（経験的な値）
    return Math.min(variance / 1000, 1.0);
  }
  
  /**
   * 明るさを計算
   */
  private calculateBrightness(stats: any): number {
    // 全チャンネルの平均明度
    const channels = stats.channels;
    const avgBrightness = channels.reduce((sum: number, ch: any) => 
      sum + ch.mean, 0) / channels.length;
    
    return avgBrightness / 255; // 0-1に正規化
  }
  
  /**
   * コントラストを計算
   */
  private calculateContrast(stats: any): number {
    // 標準偏差からコントラストを推定
    const channels = stats.channels;
    const avgStdDev = channels.reduce((sum: number, ch: any) => 
      sum + ch.stdev, 0) / channels.length;
    
    return avgStdDev / 128; // 0-1に正規化
  }
  
  /**
   * 彩度を計算
   */
  private calculateSaturation(stats: any): number {
    if (stats.channels.length < 3) return 0;
    
    const r = stats.channels[0].mean;
    const g = stats.channels[1].mean;
    const b = stats.channels[2].mean;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    if (max === 0) return 0;
    return (max - min) / max;
  }
  
  /**
   * 構図を解析
   */
  private async analyzeComposition(
    image: sharp.Sharp,
    metadata: sharp.Metadata
  ): Promise<FrameAnalysis['composition']> {
    // 三分割法スコア（簡易版）
    const ruleOfThirds = await this.calculateRuleOfThirds(image, metadata);
    
    // バランススコア（左右の重み分布）
    const balance = await this.calculateBalance(image, metadata);
    
    // リーディングライン（エッジの方向性）
    const leadingLines = await this.calculateLeadingLines(image);
    
    return {
      ruleOfThirds,
      balance,
      leadingLines,
    };
  }
  
  /**
   * 三分割法スコアを計算
   */
  private async calculateRuleOfThirds(
    image: sharp.Sharp,
    metadata: sharp.Metadata
  ): Promise<number> {
    // エッジを検出して三分割線上のエッジ密度を計算
    // 簡易実装
    return Math.random() * 0.3 + 0.5; // 0.5-0.8の範囲
  }
  
  /**
   * バランススコアを計算
   */
  private async calculateBalance(
    image: sharp.Sharp,
    metadata: sharp.Metadata
  ): Promise<number> {
    // 左右の重み分布の差を計算
    // 簡易実装
    return Math.random() * 0.2 + 0.6; // 0.6-0.8の範囲
  }
  
  /**
   * リーディングラインを計算
   */
  private async calculateLeadingLines(image: sharp.Sharp): Promise<number> {
    // エッジの方向性から主要なラインを検出
    // 簡易実装
    return Math.random() * 0.3 + 0.4; // 0.4-0.7の範囲
  }
  
  /**
   * 色を解析
   */
  private async analyzeColors(
    image: sharp.Sharp,
    stats: any
  ): Promise<FrameAnalysis['colors']> {
    // ドミナントカラーを計算
    const dominant = this.extractDominantColor(stats);
    
    // カラーパレットを抽出
    const palette = await this.extractColorPalette(image);
    
    // ヒストグラムを生成
    const histogram = this.generateHistogram(stats);
    
    return {
      dominant,
      palette,
      histogram,
    };
  }
  
  /**
   * ドミナントカラーを抽出
   */
  private extractDominantColor(stats: any): Color {
    const r = stats.channels[0]?.mean || 0;
    const g = stats.channels[1]?.mean || 0;
    const b = stats.channels[2]?.mean || 0;
    
    const { h, s, v } = this.rgbToHsv(r, g, b);
    
    return {
      r: r / 255,
      g: g / 255,
      b: b / 255,
      h,
      s,
      v,
      weight: 1.0,
    };
  }
  
  /**
   * カラーパレットを抽出
   */
  private async extractColorPalette(image: sharp.Sharp): Promise<Color[]> {
    // K-meansクラスタリングでカラーパレットを抽出
    // 簡易実装：ランダムな色を返す
    const palette: Color[] = [];
    
    for (let i = 0; i < 5; i++) {
      const r = Math.random();
      const g = Math.random();
      const b = Math.random();
      const { h, s, v } = this.rgbToHsv(r * 255, g * 255, b * 255);
      
      palette.push({
        r, g, b, h, s, v,
        weight: (5 - i) / 15, // 重みを減衰
      });
    }
    
    return palette;
  }
  
  /**
   * ヒストグラムを生成
   */
  private generateHistogram(stats: any): number[] {
    // 簡易実装：256ビンのヒストグラム
    const histogram = new Array(256).fill(0);
    
    // 実際はピクセルデータから計算
    for (let i = 0; i < 256; i++) {
      histogram[i] = Math.exp(-(Math.pow(i - 128, 2)) / 1000);
    }
    
    return histogram;
  }
  
  /**
   * エッジを解析
   */
  private async analyzeEdges(image: sharp.Sharp): Promise<FrameAnalysis['edges']> {
    // Cannyエッジ検出（簡易版）
    const { data, info } = await image
      .greyscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1], // エッジ検出カーネル
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = new Uint8Array(data);
    const threshold = 50;
    
    // エッジピクセル数をカウント
    let edgeCount = 0;
    for (const pixel of pixels) {
      if (pixel > threshold) {
        edgeCount++;
      }
    }
    
    const density = edgeCount / pixels.length;
    const complexity = Math.min(density * 10, 1.0); // 複雑性スコア
    
    return {
      count: edgeCount,
      density,
      complexity,
    };
  }
  
  /**
   * モーションを計算
   */
  private async calculateMotion(
    currentFramePath: string,
    prevFrame: FrameAnalysis
  ): Promise<FrameAnalysis['motion']> {
    // オプティカルフローの簡易実装
    // 実際はOpenCVなどを使用
    
    const vectors: Array<{x: number; y: number}> = [];
    
    // ランダムなモーションベクトルを生成（簡易実装）
    for (let i = 0; i < 10; i++) {
      vectors.push({
        x: (Math.random() - 0.5) * 10,
        y: (Math.random() - 0.5) * 10,
      });
    }
    
    // 平均ベクトルを計算
    const avgX = vectors.reduce((sum, v) => sum + v.x, 0) / vectors.length;
    const avgY = vectors.reduce((sum, v) => sum + v.y, 0) / vectors.length;
    
    const magnitude = Math.sqrt(avgX * avgX + avgY * avgY) / 10; // 正規化
    const direction = (Math.atan2(avgY, avgX) * 180) / Math.PI;
    
    return {
      vectors,
      magnitude: Math.min(magnitude, 1.0),
      direction: direction < 0 ? direction + 360 : direction,
    };
  }
  
  /**
   * ショットを検出
   */
  private async detectShots(frameAnalyses: FrameAnalysis[]): Promise<Shot[]> {
    const shots: Shot[] = [];
    let shotStart = 0;
    let shotId = 0;
    
    for (let i = 1; i < frameAnalyses.length; i++) {
      const curr = frameAnalyses[i];
      const prev = frameAnalyses[i - 1];
      
      // ショット境界を検出
      const isDifferent = this.isSceneCut(curr, prev);
      
      if (isDifferent || i === frameAnalyses.length - 1) {
        // ショットを作成
        const shotFrames = frameAnalyses.slice(shotStart, i);
        const startTime = shotFrames[0].time;
        const endTime = shotFrames[shotFrames.length - 1].time;
        
        const shotInfo = this.usabilityChecker.evaluateShot(
          startTime,
          endTime,
          shotFrames
        );
        
        shots.push({
          id: `shot_${shotId++}`,
          ...shotInfo,
        } as Shot);
        
        shotStart = i;
      }
    }
    
    return shots;
  }
  
  /**
   * シーンカットを判定
   */
  private isSceneCut(curr: FrameAnalysis, prev: FrameAnalysis): boolean {
    // 色の変化
    const colorDiff = this.calculateColorDifference(
      curr.colors.dominant,
      prev.colors.dominant
    );
    
    // エッジの変化
    const edgeDiff = Math.abs(curr.edges.density - prev.edges.density);
    
    // モーションの変化
    const motionDiff = curr.motion && prev.motion ?
      Math.abs(curr.motion.magnitude - prev.motion.magnitude) : 0;
    
    // 総合的な変化量
    const totalChange = colorDiff * 0.4 + edgeDiff * 0.4 + motionDiff * 0.2;
    
    return totalChange > this.options.shotDetectionThreshold!;
  }
  
  /**
   * 色の差を計算
   */
  private calculateColorDifference(c1: Color, c2: Color): number {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    
    return Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);
  }
  
  /**
   * シーンを検出
   */
  private detectScenes(
    shots: Shot[],
    frameAnalyses: FrameAnalysis[]
  ): Scene[] {
    const scenes: Scene[] = [];
    let sceneShots: Shot[] = [];
    let sceneId = 0;
    
    for (let i = 0; i < shots.length; i++) {
      sceneShots.push(shots[i]);
      
      // シーン境界を判定
      if (i < shots.length - 1) {
        const isNewScene = this.isSceneBoundary(shots[i], shots[i + 1]);
        
        if (isNewScene) {
          scenes.push(this.createScene(sceneId++, sceneShots, frameAnalyses));
          sceneShots = [];
        }
      }
    }
    
    // 最後のシーン
    if (sceneShots.length > 0) {
      scenes.push(this.createScene(sceneId, sceneShots, frameAnalyses));
    }
    
    return scenes;
  }
  
  /**
   * シーン境界を判定
   */
  private isSceneBoundary(shot1: Shot, shot2: Shot): boolean {
    // 時間的なギャップ
    const timeGap = shot2.startTime - shot1.endTime;
    if (timeGap > 1000) return true; // 1秒以上のギャップ
    
    // 品質の大きな変化
    const qualityDiff = Math.abs(
      shot1.quality.overallScore - shot2.quality.overallScore
    );
    
    return qualityDiff > this.options.sceneDetectionThreshold!;
  }
  
  /**
   * シーンを作成
   */
  private createScene(
    id: number,
    shots: Shot[],
    frameAnalyses: FrameAnalysis[]
  ): Scene {
    const startTime = shots[0].startTime;
    const endTime = shots[shots.length - 1].endTime;
    
    // シーンのフレームを取得
    const sceneFrames = frameAnalyses.filter(f => 
      f.time >= startTime && f.time <= endTime
    );
    
    // 特性を計算
    const avgMotion = this.average(
      sceneFrames.filter(f => f.motion).map(f => f.motion!.magnitude)
    );
    
    const colors = this.extractSceneColors(sceneFrames);
    const mood = this.detectMood(sceneFrames);
    
    return {
      id: `scene_${id}`,
      shots,
      startTime,
      endTime,
      duration: endTime - startTime,
      characteristics: {
        avgMotion,
        colorPalette: colors.palette,
        dominantColor: colors.dominant,
        mood,
      },
    };
  }
  
  /**
   * シーンの色を抽出
   */
  private extractSceneColors(frames: FrameAnalysis[]): {
    dominant: Color;
    palette: Color[];
  } {
    // 全フレームの色を集計
    const allColors: Color[] = [];
    
    for (const frame of frames) {
      allColors.push(frame.colors.dominant);
    }
    
    // 平均色を計算
    const avgR = this.average(allColors.map(c => c.r));
    const avgG = this.average(allColors.map(c => c.g));
    const avgB = this.average(allColors.map(c => c.b));
    
    const { h, s, v } = this.rgbToHsv(avgR * 255, avgG * 255, avgB * 255);
    
    return {
      dominant: {
        r: avgR, g: avgG, b: avgB,
        h, s, v,
        weight: 1.0,
      },
      palette: frames[0]?.colors.palette || [],
    };
  }
  
  /**
   * ムードを検出
   */
  private detectMood(frames: FrameAnalysis[]): Scene['characteristics']['mood'] {
    const avgBrightness = this.average(frames.map(f => f.brightness));
    const avgSaturation = this.average(frames.map(f => f.saturation));
    
    if (avgBrightness > 0.6) {
      return avgSaturation > 0.5 ? 'vibrant' : 'bright';
    } else if (avgBrightness < 0.3) {
      return 'dark';
    }
    
    return 'neutral';
  }
  
  /**
   * モーションを抽出
   */
  private extractMotion(frameAnalyses: FrameAnalysis[]): Motion[] {
    const motions: Motion[] = [];
    
    for (const frame of frameAnalyses) {
      if (!frame.motion) continue;
      
      let type: Motion['type'] = 'static';
      if (frame.motion.magnitude < 0.1) {
        type = 'static';
      } else if (Math.abs(frame.motion.direction - 0) < 45 || 
                 Math.abs(frame.motion.direction - 180) < 45) {
        type = 'pan';
      } else if (frame.motion.vectors.length > 20) {
        type = 'complex';
      } else {
        type = 'zoom';
      }
      
      motions.push({
        time: frame.time,
        magnitude: frame.motion.magnitude,
        direction: frame.motion.direction,
        complexity: frame.motion.vectors.length / 100,
        type,
      });
    }
    
    return motions;
  }
  
  /**
   * エッジ複雑性を抽出
   */
  private extractEdgeComplexity(frameAnalyses: FrameAnalysis[]): EdgeComplexity[] {
    return frameAnalyses.map(frame => ({
      time: frame.time,
      score: frame.edges.complexity,
      edgeCount: frame.edges.count,
      edgeDensity: frame.edges.density,
    }));
  }
  
  /**
   * 顔を検出（簡易実装）
   */
  private async detectFaces(frameAnalyses: FrameAnalysis[]): Promise<Face[]> {
    // OpenCVなどを使用した実装が必要
    // ここでは空配列を返す
    return [];
  }
  
  /**
   * トランジションを検証
   */
  private validateTransitions(
    shots: Shot[],
    frameAnalyses: FrameAnalysis[]
  ): VideoAnalysisResult['transitionValidations'] {
    const frameMap = new Map<string, FrameAnalysis[]>();
    
    // ショットごとのフレームをマッピング
    for (const shot of shots) {
      const shotFrames = frameAnalyses.filter(f => 
        f.time >= shot.startTime && f.time <= shot.endTime
      );
      frameMap.set(shot.id, shotFrames);
    }
    
    return this.transitionValidator.validateTransitions(shots, frameMap);
  }
  
  /**
   * 統計情報を計算
   */
  private calculateStatistics(
    shots: Shot[],
    scenes: Scene[],
    frameAnalyses: FrameAnalysis[]
  ): VideoAnalysisResult['statistics'] {
    return {
      avgShotDuration: this.average(shots.map(s => s.duration)),
      avgMotion: this.average(
        frameAnalyses.filter(f => f.motion).map(f => f.motion!.magnitude)
      ),
      avgSharpness: this.average(frameAnalyses.map(f => f.sharpness)),
      avgEdgeComplexity: this.average(frameAnalyses.map(f => f.edges.complexity)),
      shotCount: shots.length,
      sceneCount: scenes.length,
    };
  }
  
  /**
   * RGBをHSVに変換
   */
  private rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    if (diff !== 0) {
      if (max === r) {
        h = ((g - b) / diff + (g < b ? 6 : 0)) * 60;
      } else if (max === g) {
        h = ((b - r) / diff + 2) * 60;
      } else {
        h = ((r - g) / diff + 4) * 60;
      }
    }
    
    const s = max === 0 ? 0 : diff / max;
    const v = max;
    
    return { h, s, v };
  }
  
  /**
   * 平均を計算
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * 一時ファイルをクリーンアップ
   */
  private async cleanup(framesDir: string): Promise<void> {
    try {
      await fs.rm(framesDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup frames directory: ${error}`);
    }
  }
}