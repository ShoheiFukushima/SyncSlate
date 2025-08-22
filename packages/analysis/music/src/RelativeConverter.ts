import type { 
  DynamicFeatures, 
  RelativeDynamics,
  SpectralFeatures 
} from './types.js';

/**
 * 相対値変換器
 * 楽曲内での相対的な強度・複雑性・変化量を計算
 */
export class RelativeConverter {
  /**
   * 動的特徴を相対的ダイナミズムに変換
   */
  public convertToRelativeDynamics(
    dynamicFeatures: DynamicFeatures[],
    spectralFeatures: SpectralFeatures[]
  ): RelativeDynamics[] {
    // 統計情報を計算
    const stats = this.calculateStatistics(dynamicFeatures, spectralFeatures);
    
    // 各時点での相対値を計算
    const relativeDynamics: RelativeDynamics[] = [];
    
    for (let i = 0; i < dynamicFeatures.length; i++) {
      const dynamic = dynamicFeatures[i];
      const spectral = spectralFeatures[i];
      
      // 相対強度（エネルギーとラウドネスの組み合わせ）
      const relativeEnergy = this.normalize(
        dynamic.energy, 
        stats.energy.min, 
        stats.energy.max
      );
      const relativeLoudness = this.normalize(
        dynamic.loudness,
        stats.loudness.min,
        stats.loudness.max
      );
      const intensity = (relativeEnergy * 0.6 + relativeLoudness * 0.4);
      
      // 相対複雑性（スペクトル特徴から）
      const relativeCentroid = this.normalize(
        spectral.centroid,
        stats.centroid.min,
        stats.centroid.max
      );
      const relativeSpread = this.normalize(
        spectral.spread,
        stats.spread.min,
        stats.spread.max
      );
      const complexity = (relativeCentroid * 0.5 + relativeSpread * 0.3 + 
                         spectral.flatness * 0.2);
      
      // 変化量（前フレームとの差分）
      let variation = 0;
      if (i > 0) {
        const prevDynamic = dynamicFeatures[i - 1];
        const prevSpectral = spectralFeatures[i - 1];
        
        const energyChange = Math.abs(dynamic.energy - prevDynamic.energy) / 
                            (stats.energy.max - stats.energy.min);
        const centroidChange = Math.abs(spectral.centroid - prevSpectral.centroid) / 
                              (stats.centroid.max - stats.centroid.min);
        const fluxNormalized = this.normalize(
          spectral.flux,
          stats.flux.min,
          stats.flux.max
        );
        
        variation = (energyChange * 0.3 + centroidChange * 0.3 + fluxNormalized * 0.4);
      }
      
      // 感情価と覚醒度（簡易推定）
      const emotionalValence = this.estimateValence(spectral, dynamic);
      const arousal = this.estimateArousal(intensity, complexity, variation);
      
      relativeDynamics.push({
        time: dynamic.time,
        intensity: this.clamp(intensity),
        complexity: this.clamp(complexity),
        variation: this.clamp(variation),
        emotionalValence: this.clamp(emotionalValence, -1, 1),
        arousal: this.clamp(arousal),
      });
    }
    
    // スムージング（急激な変化を緩和）
    return this.smoothDynamics(relativeDynamics);
  }
  
  /**
   * 統計情報を計算
   */
  private calculateStatistics(
    dynamicFeatures: DynamicFeatures[],
    spectralFeatures: SpectralFeatures[]
  ) {
    const stats = {
      energy: { min: Infinity, max: -Infinity, mean: 0, std: 0 },
      loudness: { min: Infinity, max: -Infinity, mean: 0, std: 0 },
      centroid: { min: Infinity, max: -Infinity, mean: 0, std: 0 },
      spread: { min: Infinity, max: -Infinity, mean: 0, std: 0 },
      flux: { min: Infinity, max: -Infinity, mean: 0, std: 0 },
    };
    
    // 最小値・最大値・平均を計算
    for (let i = 0; i < dynamicFeatures.length; i++) {
      const dynamic = dynamicFeatures[i];
      const spectral = spectralFeatures[i];
      
      stats.energy.min = Math.min(stats.energy.min, dynamic.energy);
      stats.energy.max = Math.max(stats.energy.max, dynamic.energy);
      stats.energy.mean += dynamic.energy;
      
      stats.loudness.min = Math.min(stats.loudness.min, dynamic.loudness);
      stats.loudness.max = Math.max(stats.loudness.max, dynamic.loudness);
      stats.loudness.mean += dynamic.loudness;
      
      stats.centroid.min = Math.min(stats.centroid.min, spectral.centroid);
      stats.centroid.max = Math.max(stats.centroid.max, spectral.centroid);
      stats.centroid.mean += spectral.centroid;
      
      stats.spread.min = Math.min(stats.spread.min, spectral.spread);
      stats.spread.max = Math.max(stats.spread.max, spectral.spread);
      stats.spread.mean += spectral.spread;
      
      stats.flux.min = Math.min(stats.flux.min, spectral.flux);
      stats.flux.max = Math.max(stats.flux.max, spectral.flux);
      stats.flux.mean += spectral.flux;
    }
    
    const count = dynamicFeatures.length;
    stats.energy.mean /= count;
    stats.loudness.mean /= count;
    stats.centroid.mean /= count;
    stats.spread.mean /= count;
    stats.flux.mean /= count;
    
    // 標準偏差を計算
    for (let i = 0; i < dynamicFeatures.length; i++) {
      const dynamic = dynamicFeatures[i];
      const spectral = spectralFeatures[i];
      
      stats.energy.std += Math.pow(dynamic.energy - stats.energy.mean, 2);
      stats.loudness.std += Math.pow(dynamic.loudness - stats.loudness.mean, 2);
      stats.centroid.std += Math.pow(spectral.centroid - stats.centroid.mean, 2);
      stats.spread.std += Math.pow(spectral.spread - stats.spread.mean, 2);
      stats.flux.std += Math.pow(spectral.flux - stats.flux.mean, 2);
    }
    
    stats.energy.std = Math.sqrt(stats.energy.std / count);
    stats.loudness.std = Math.sqrt(stats.loudness.std / count);
    stats.centroid.std = Math.sqrt(stats.centroid.std / count);
    stats.spread.std = Math.sqrt(stats.spread.std / count);
    stats.flux.std = Math.sqrt(stats.flux.std / count);
    
    return stats;
  }
  
  /**
   * 正規化（0-1の範囲に変換）
   */
  private normalize(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  }
  
  /**
   * クランプ（範囲制限）
   */
  private clamp(value: number, min: number = 0, max: number = 1): number {
    return Math.max(min, Math.min(max, value));
  }
  
  /**
   * 感情価を推定（簡易版）
   */
  private estimateValence(spectral: SpectralFeatures, dynamic: DynamicFeatures): number {
    // 高周波成分が多く、エネルギーが高い → ポジティブ
    // 低周波成分が多く、エネルギーが低い → ネガティブ
    const highFreqRatio = spectral.centroid / 10000; // 10kHzで正規化
    const energyLevel = dynamic.energy;
    
    // クロマベクトルから調性の明るさを推定（メジャー/マイナー）
    let tonalBrightness = 0;
    if (spectral.chroma && spectral.chroma.length > 0) {
      // メジャーコードのパターンに近いほど明るい
      const majorPattern = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
      const similarity = this.chromaSimilarity(spectral.chroma, majorPattern);
      tonalBrightness = similarity * 2 - 1; // -1 to 1
    }
    
    return (highFreqRatio * 0.3 + energyLevel * 0.3 + tonalBrightness * 0.4) * 2 - 1;
  }
  
  /**
   * 覚醒度を推定
   */
  private estimateArousal(
    intensity: number, 
    complexity: number, 
    variation: number
  ): number {
    // 強度、複雑性、変化量が高いほど覚醒度が高い
    return intensity * 0.4 + complexity * 0.3 + variation * 0.3;
  }
  
  /**
   * クロマベクトルの類似度を計算
   */
  private chromaSimilarity(chroma: number[], pattern: number[]): number {
    if (chroma.length !== pattern.length) return 0.5;
    
    let similarity = 0;
    for (let i = 0; i < chroma.length; i++) {
      similarity += chroma[i] * pattern[i];
    }
    
    // コサイン類似度
    const chromaMag = Math.sqrt(chroma.reduce((sum, val) => sum + val * val, 0));
    const patternMag = Math.sqrt(pattern.reduce((sum, val) => sum + val * val, 0));
    
    if (chromaMag === 0 || patternMag === 0) return 0.5;
    return similarity / (chromaMag * patternMag);
  }
  
  /**
   * ダイナミクスをスムージング
   */
  private smoothDynamics(dynamics: RelativeDynamics[]): RelativeDynamics[] {
    const smoothed: RelativeDynamics[] = [];
    const windowSize = 5; // スムージングウィンドウサイズ
    
    for (let i = 0; i < dynamics.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(dynamics.length, i + Math.floor(windowSize / 2) + 1);
      
      let sumIntensity = 0;
      let sumComplexity = 0;
      let sumVariation = 0;
      let sumValence = 0;
      let sumArousal = 0;
      let count = 0;
      
      for (let j = start; j < end; j++) {
        const weight = 1 - Math.abs(j - i) / (windowSize / 2);
        sumIntensity += dynamics[j].intensity * weight;
        sumComplexity += dynamics[j].complexity * weight;
        sumVariation += dynamics[j].variation * weight;
        sumValence += dynamics[j].emotionalValence * weight;
        sumArousal += dynamics[j].arousal * weight;
        count += weight;
      }
      
      smoothed.push({
        time: dynamics[i].time,
        intensity: sumIntensity / count,
        complexity: sumComplexity / count,
        variation: sumVariation / count,
        emotionalValence: sumValence / count,
        arousal: sumArousal / count,
      });
    }
    
    return smoothed;
  }
}