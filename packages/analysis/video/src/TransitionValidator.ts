import type { 
  Shot, 
  TransitionValidation,
  FrameAnalysis,
  Color 
} from './types.js';

/**
 * トランジションバリデーター
 * 30%変化の法則に基づいてカット間の妥当性を検証
 */
export class TransitionValidator {
  private readonly MIN_CHANGE_THRESHOLD = 0.3; // 30%変化
  
  /**
   * 2つのショット間のトランジションを検証
   */
  public validateTransition(
    fromShot: Shot,
    toShot: Shot,
    fromFrames: FrameAnalysis[],
    toFrames: FrameAnalysis[]
  ): TransitionValidation {
    // 各ショットの最後/最初のフレームを比較
    const fromLastFrame = fromFrames[fromFrames.length - 1];
    const toFirstFrame = toFrames[0];
    
    if (!fromLastFrame || !toFirstFrame) {
      return this.createInvalidResult(fromShot.id, toShot.id);
    }
    
    // 各次元の変化を計算
    const changes = {
      position: this.calculatePositionChange(fromLastFrame, toFirstFrame),
      size: this.calculateSizeChange(fromLastFrame, toFirstFrame),
      color: this.calculateColorChange(fromLastFrame, toFirstFrame),
      motion: this.calculateMotionChange(fromFrames, toFrames),
    };
    
    // 最大変化を特定
    let maxChange = 0;
    let changeDimension = '';
    
    for (const [dimension, change] of Object.entries(changes)) {
      if (change > maxChange) {
        maxChange = change;
        changeDimension = dimension;
      }
    }
    
    // 30%ルールの判定
    const isValid = maxChange >= this.MIN_CHANGE_THRESHOLD;
    
    return {
      fromShot: fromShot.id,
      toShot: toShot.id,
      changes,
      isValid,
      maxChange,
      changeDimension,
    };
  }
  
  /**
   * 位置変化を計算
   */
  private calculatePositionChange(
    fromFrame: FrameAnalysis,
    toFrame: FrameAnalysis
  ): number {
    // 主要オブジェクトの位置変化を推定
    // エッジ分布の重心から位置変化を計算
    
    const fromCentroid = this.calculateEdgeCentroid(fromFrame);
    const toCentroid = this.calculateEdgeCentroid(toFrame);
    
    // 正規化された距離を計算（画面対角線で正規化）
    const dx = fromCentroid.x - toCentroid.x;
    const dy = fromCentroid.y - toCentroid.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 対角線長を1として正規化
    const normalizedDistance = distance / Math.sqrt(2);
    
    return Math.min(normalizedDistance, 1.0);
  }
  
  /**
   * サイズ変化を計算
   */
  private calculateSizeChange(
    fromFrame: FrameAnalysis,
    toFrame: FrameAnalysis
  ): number {
    // エッジ密度からオブジェクトサイズの変化を推定
    const fromDensity = fromFrame.edges.density;
    const toDensity = toFrame.edges.density;
    
    // 密度の変化率
    const changeRatio = Math.abs(toDensity - fromDensity) / 
                       Math.max(fromDensity, toDensity, 0.01);
    
    // エッジ数の変化も考慮
    const fromCount = fromFrame.edges.count;
    const toCount = toFrame.edges.count;
    const countChange = Math.abs(toCount - fromCount) / 
                       Math.max(fromCount, toCount, 1);
    
    // 複合的なサイズ変化指標
    return (changeRatio * 0.6 + countChange * 0.4);
  }
  
  /**
   * 色変化を計算
   */
  private calculateColorChange(
    fromFrame: FrameAnalysis,
    toFrame: FrameAnalysis
  ): number {
    const fromColor = fromFrame.colors.dominant;
    const toColor = toFrame.colors.dominant;
    
    // HSV空間での色差を計算
    const hueDiff = this.calculateHueDifference(fromColor.h, toColor.h);
    const satDiff = Math.abs(fromColor.s - toColor.s);
    const valDiff = Math.abs(fromColor.v - toColor.v);
    
    // 重み付き色差
    const colorDiff = (
      hueDiff * 0.5 +    // 色相の変化を重視
      satDiff * 0.3 +    // 彩度の変化
      valDiff * 0.2      // 明度の変化
    );
    
    // パレット全体の変化も考慮
    const paletteChange = this.calculatePaletteChange(
      fromFrame.colors.palette,
      toFrame.colors.palette
    );
    
    return (colorDiff * 0.7 + paletteChange * 0.3);
  }
  
  /**
   * モーション変化を計算
   */
  private calculateMotionChange(
    fromFrames: FrameAnalysis[],
    toFrames: FrameAnalysis[]
  ): number {
    // 最後の数フレームと最初の数フレームのモーションを比較
    const windowSize = 5;
    
    const fromWindow = fromFrames.slice(-windowSize);
    const toWindow = toFrames.slice(0, windowSize);
    
    // 平均モーションを計算
    const fromMotion = this.calculateAverageMotion(fromWindow);
    const toMotion = this.calculateAverageMotion(toWindow);
    
    // 大きさの変化
    const magnitudeChange = Math.abs(toMotion.magnitude - fromMotion.magnitude);
    
    // 方向の変化（0-1に正規化）
    const directionChange = Math.abs(toMotion.direction - fromMotion.direction) / 180;
    
    return (magnitudeChange * 0.6 + directionChange * 0.4);
  }
  
  /**
   * エッジ分布の重心を計算
   */
  private calculateEdgeCentroid(frame: FrameAnalysis): { x: number; y: number } {
    // 簡略化：画面を9分割（3x3）して各領域のエッジ密度から重心を推定
    // 実際の実装ではより詳細な解析が必要
    
    // ここでは仮の実装として画面中心を返す
    // 実際はエッジマップから重心を計算
    return { x: 0.5, y: 0.5 };
  }
  
  /**
   * 色相の差を計算（循環を考慮）
   */
  private calculateHueDifference(h1: number, h2: number): number {
    const diff = Math.abs(h1 - h2);
    // 色相は循環するので、短い方の差を使用
    return Math.min(diff, 360 - diff) / 180; // 0-1に正規化
  }
  
  /**
   * パレット全体の変化を計算
   */
  private calculatePaletteChange(
    fromPalette: Color[],
    toPalette: Color[]
  ): number {
    if (fromPalette.length === 0 || toPalette.length === 0) {
      return 1.0; // 完全に異なる
    }
    
    // 各色の最小距離を計算
    let totalDistance = 0;
    let count = 0;
    
    for (const fromColor of fromPalette) {
      let minDistance = Infinity;
      
      for (const toColor of toPalette) {
        const distance = this.calculateColorDistance(fromColor, toColor);
        minDistance = Math.min(minDistance, distance);
      }
      
      totalDistance += minDistance * fromColor.weight;
      count += fromColor.weight;
    }
    
    return count > 0 ? totalDistance / count : 0;
  }
  
  /**
   * 2つの色の距離を計算
   */
  private calculateColorDistance(c1: Color, c2: Color): number {
    const hueDiff = this.calculateHueDifference(c1.h, c2.h);
    const satDiff = Math.abs(c1.s - c2.s);
    const valDiff = Math.abs(c1.v - c2.v);
    
    return Math.sqrt(
      hueDiff * hueDiff +
      satDiff * satDiff +
      valDiff * valDiff
    ) / Math.sqrt(3); // 正規化
  }
  
  /**
   * 平均モーションを計算
   */
  private calculateAverageMotion(
    frames: FrameAnalysis[]
  ): { magnitude: number; direction: number } {
    const motions = frames
      .filter(f => f.motion)
      .map(f => f.motion!);
    
    if (motions.length === 0) {
      return { magnitude: 0, direction: 0 };
    }
    
    // ベクトル平均を計算
    let sumX = 0;
    let sumY = 0;
    
    for (const motion of motions) {
      const rad = (motion.direction * Math.PI) / 180;
      sumX += motion.magnitude * Math.cos(rad);
      sumY += motion.magnitude * Math.sin(rad);
    }
    
    sumX /= motions.length;
    sumY /= motions.length;
    
    const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
    const direction = (Math.atan2(sumY, sumX) * 180) / Math.PI;
    
    return {
      magnitude: Math.min(magnitude, 1.0),
      direction: direction < 0 ? direction + 360 : direction,
    };
  }
  
  /**
   * 無効な結果を作成
   */
  private createInvalidResult(fromId: string, toId: string): TransitionValidation {
    return {
      fromShot: fromId,
      toShot: toId,
      changes: {
        position: 0,
        size: 0,
        color: 0,
        motion: 0,
      },
      isValid: false,
      maxChange: 0,
      changeDimension: 'none',
    };
  }
  
  /**
   * バッチ検証（複数のトランジションを一度に検証）
   */
  public validateTransitions(
    shots: Shot[],
    frameAnalyses: Map<string, FrameAnalysis[]>
  ): TransitionValidation[] {
    const validations: TransitionValidation[] = [];
    
    for (let i = 0; i < shots.length - 1; i++) {
      const fromShot = shots[i];
      const toShot = shots[i + 1];
      
      const fromFrames = frameAnalyses.get(fromShot.id);
      const toFrames = frameAnalyses.get(toShot.id);
      
      if (fromFrames && toFrames) {
        validations.push(
          this.validateTransition(fromShot, toShot, fromFrames, toFrames)
        );
      }
    }
    
    return validations;
  }
  
  /**
   * 推奨トランジションを提案
   */
  public suggestImprovement(
    validation: TransitionValidation,
    alternativeShots: Shot[]
  ): Shot | null {
    if (validation.isValid) {
      return null; // 改善不要
    }
    
    // 変化が不足している次元
    const weakestDimension = this.findWeakestDimension(validation.changes);
    
    // その次元で大きく異なるショットを探す
    // （実装簡略化のため、ランダムに選択）
    const candidates = alternativeShots.filter(s => 
      s.id !== validation.fromShot && s.id !== validation.toShot
    );
    
    if (candidates.length > 0) {
      // 品質スコアが高いものを優先
      candidates.sort((a, b) => b.quality.overallScore - a.quality.overallScore);
      return candidates[0];
    }
    
    return null;
  }
  
  /**
   * 最も変化が少ない次元を特定
   */
  private findWeakestDimension(changes: TransitionValidation['changes']): string {
    let minChange = Infinity;
    let weakestDimension = '';
    
    for (const [dimension, change] of Object.entries(changes)) {
      if (change < minChange) {
        minChange = change;
        weakestDimension = dimension;
      }
    }
    
    return weakestDimension;
  }
}