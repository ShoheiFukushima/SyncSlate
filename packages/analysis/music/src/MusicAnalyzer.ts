import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import { ConfigLoader } from '@autoedittate/config';
import { RelativeConverter } from './RelativeConverter.js';
import { EditPointDetector } from './EditPointDetector.js';
import type {
  MusicAnalysisResult,
  MusicAnalysisOptions,
  Beat,
  Onset,
  MusicSegment,
  TempoInfo,
  SpectralFeatures,
  DynamicFeatures,
} from './types.js';

/**
 * 音楽解析エンジン
 * 音楽ファイルを解析し、編集点候補と相対的ダイナミズムを抽出
 */
export class MusicAnalyzer {
  private readonly options: MusicAnalysisOptions;
  private readonly configLoader: ConfigLoader;
  private readonly relativeConverter: RelativeConverter;
  private readonly editPointDetector: EditPointDetector;
  
  constructor(options?: Partial<MusicAnalysisOptions>) {
    // デフォルトオプションとマージ
    this.options = {
      extractBeats: true,
      extractOnsets: true,
      extractTempo: true,
      extractSegments: true,
      extractSpectral: true,
      extractDynamic: true,
      fftSize: 2048,
      hopLength: 512,
      windowFunction: 'hann',
      editPointSensitivity: 0.5,
      minEditPointInterval: 500,
      parallel: true,
      cacheIntermediateResults: true,
      ...options,
    };
    
    this.configLoader = ConfigLoader.getInstance();
    this.relativeConverter = new RelativeConverter();
    this.editPointDetector = new EditPointDetector(this.options);
  }
  
  /**
   * 音楽ファイルを解析
   */
  public async analyze(audioPath: string): Promise<MusicAnalysisResult> {
    console.log(`Analyzing audio: ${audioPath}`);
    
    // 音声ファイルのメタデータを取得
    const metadata = await this.extractMetadata(audioPath);
    
    // WAVに変換（解析用）
    const wavPath = await this.convertToWav(audioPath);
    
    // 音声データを読み込み
    const audioData = await this.loadAudioData(wavPath);
    
    // 並列で各種解析を実行
    const [
      tempo,
      beats,
      onsets,
      segments,
      spectralFeatures,
      dynamicFeatures,
    ] = await Promise.all([
      this.options.extractTempo ? this.extractTempo(audioData) : this.getDefaultTempo(),
      this.options.extractBeats ? this.extractBeats(audioData) : [],
      this.options.extractOnsets ? this.extractOnsets(audioData) : [],
      this.options.extractSegments ? this.extractSegments(audioData) : [],
      this.options.extractSpectral ? this.extractSpectralFeatures(audioData) : [],
      this.options.extractDynamic ? this.extractDynamicFeatures(audioData) : [],
    ]);
    
    // 相対的ダイナミズムを計算
    const dynamics = this.relativeConverter.convertToRelativeDynamics(
      dynamicFeatures,
      spectralFeatures
    );
    
    // 編集点を検出
    const editPoints = this.editPointDetector.detectEditPoints(
      beats,
      onsets,
      segments,
      dynamics,
      metadata.duration
    );
    
    // 統計情報を計算
    const statistics = this.calculateStatistics(dynamicFeatures, spectralFeatures);
    
    // 一時ファイルをクリーンアップ
    if (wavPath !== audioPath) {
      await fs.unlink(wavPath).catch(() => {});
    }
    
    return {
      duration: metadata.duration,
      tempo,
      beats,
      onsets,
      segments,
      editPoints,
      dynamics,
      spectralFeatures,
      dynamicFeatures,
      statistics,
      metadata,
    };
  }
  
  /**
   * メタデータを抽出
   */
  private async extractMetadata(audioPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        if (!audioStream) {
          reject(new Error('No audio stream found'));
          return;
        }
        
        resolve({
          duration: (metadata.format.duration || 0) * 1000, // ミリ秒に変換
          sampleRate: typeof audioStream.sample_rate === 'number' 
            ? audioStream.sample_rate 
            : parseInt(audioStream.sample_rate || '44100'),
          channels: audioStream.channels || 2,
          bitDepth: audioStream.bits_per_sample || 16,
          codec: audioStream.codec_name || 'unknown',
        });
      });
    });
  }
  
  /**
   * WAVファイルに変換
   */
  private async convertToWav(audioPath: string): Promise<string> {
    // すでにWAVファイルの場合はそのまま返す
    if (path.extname(audioPath).toLowerCase() === '.wav') {
      return audioPath;
    }
    
    const outputPath = path.join(
      path.dirname(audioPath),
      `${path.basename(audioPath, path.extname(audioPath))}_temp.wav`
    );
    
    return new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(1) // モノラルに変換（解析を簡単にするため）
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }
  
  /**
   * 音声データを読み込み
   */
  private async loadAudioData(wavPath: string): Promise<Float32Array> {
    const buffer = await fs.readFile(wavPath);
    
    // WAVヘッダーをスキップして生データを取得
    const dataOffset = 44; // 標準的なWAVヘッダーサイズ
    const pcmData = buffer.slice(dataOffset);
    
    // 16bit PCMをFloat32に変換
    const samples = new Float32Array(pcmData.length / 2);
    for (let i = 0; i < samples.length; i++) {
      const sample = pcmData.readInt16LE(i * 2);
      samples[i] = sample / 32768.0; // -1.0 to 1.0に正規化
    }
    
    return samples;
  }
  
  /**
   * テンポを抽出
   */
  private async extractTempo(audioData: Float32Array): Promise<TempoInfo> {
    // 簡易的なテンポ検出（実際はlibrosaのような高度なアルゴリズムが必要）
    const tempo = this.detectTempoByCrossCorrelation(audioData);
    
    return {
      bpm: tempo,
      confidence: 0.8, // 仮の値
      variations: [], // 将来的に実装
    };
  }
  
  /**
   * デフォルトテンポ
   */
  private getDefaultTempo(): TempoInfo {
    return {
      bpm: 120,
      confidence: 0,
      variations: [],
    };
  }
  
  /**
   * ビートを抽出
   */
  private async extractBeats(audioData: Float32Array): Promise<Beat[]> {
    const beats: Beat[] = [];
    const sampleRate = 44100;
    const hopLength = this.options.hopLength || 512;
    
    // エネルギーベースの簡易ビート検出
    const energy = this.calculateEnergy(audioData, hopLength);
    const peaks = this.findPeaks(energy, 0.7); // 閾値0.7
    
    // 相対強度を計算
    const maxEnergy = Math.max(...energy);
    const minEnergy = Math.min(...energy);
    
    for (const peakIndex of peaks) {
      const time = (peakIndex * hopLength / sampleRate) * 1000; // ミリ秒
      const strength = (energy[peakIndex] - minEnergy) / (maxEnergy - minEnergy);
      
      beats.push({
        time,
        strength,
        confidence: 0.7, // 簡易実装なので固定値
      });
    }
    
    return beats;
  }
  
  /**
   * オンセットを抽出
   */
  private async extractOnsets(audioData: Float32Array): Promise<Onset[]> {
    const onsets: Onset[] = [];
    const sampleRate = 44100;
    const hopLength = this.options.hopLength || 512;
    
    // スペクトル変化量ベースのオンセット検出
    const spectralFlux = this.calculateSpectralFlux(audioData, hopLength);
    const peaks = this.findPeaks(spectralFlux, 0.5);
    
    // 相対強度を計算
    const maxFlux = Math.max(...spectralFlux);
    const minFlux = Math.min(...spectralFlux);
    
    for (const peakIndex of peaks) {
      const time = (peakIndex * hopLength / sampleRate) * 1000;
      const strength = (spectralFlux[peakIndex] - minFlux) / (maxFlux - minFlux);
      
      // 簡易的な周波数推定
      const frequency = this.estimateFrequency(
        audioData.slice(peakIndex * hopLength, (peakIndex + 1) * hopLength)
      );
      
      // タイプ判定（簡易版）
      let type: Onset['type'] = 'mixed';
      if (frequency < 200) {
        type = 'percussive';
      } else if (frequency > 1000) {
        type = 'harmonic';
      }
      
      onsets.push({
        time,
        strength,
        frequency,
        type,
      });
    }
    
    return onsets;
  }
  
  /**
   * セグメントを抽出
   */
  private async extractSegments(audioData: Float32Array): Promise<MusicSegment[]> {
    // 簡易的なセグメント検出（実際は機械学習モデルが必要）
    const segments: MusicSegment[] = [];
    const duration = (audioData.length / 44100) * 1000; // ミリ秒
    
    // 仮のセグメント構造（60秒の楽曲を想定）
    if (duration >= 60000) {
      segments.push({
        type: 'intro',
        startTime: 0,
        endTime: 8000,
        confidence: 0.7,
        energy: 0.3,
      });
      
      segments.push({
        type: 'verse',
        startTime: 8000,
        endTime: 24000,
        confidence: 0.8,
        energy: 0.5,
      });
      
      segments.push({
        type: 'chorus',
        startTime: 24000,
        endTime: 40000,
        confidence: 0.9,
        energy: 0.8,
      });
      
      segments.push({
        type: 'verse',
        startTime: 40000,
        endTime: 48000,
        confidence: 0.8,
        energy: 0.5,
      });
      
      segments.push({
        type: 'outro',
        startTime: 48000,
        endTime: 60000,
        confidence: 0.7,
        energy: 0.3,
      });
    }
    
    return segments;
  }
  
  /**
   * スペクトル特徴を抽出
   */
  private async extractSpectralFeatures(audioData: Float32Array): Promise<SpectralFeatures[]> {
    const features: SpectralFeatures[] = [];
    const hopLength = this.options.hopLength || 512;
    const fftSize = this.options.fftSize || 2048;
    const sampleRate = 44100;
    
    // フレームごとに特徴を計算
    for (let i = 0; i + fftSize < audioData.length; i += hopLength) {
      const frame = audioData.slice(i, i + fftSize);
      const spectrum = this.fft(frame);
      
      features.push({
        time: (i / sampleRate) * 1000,
        centroid: this.spectralCentroid(spectrum, sampleRate),
        spread: this.spectralSpread(spectrum, sampleRate),
        flux: i > 0 ? this.spectralFluxFrame(spectrum, features[features.length - 1]) : 0,
        rolloff: this.spectralRolloff(spectrum, sampleRate),
        flatness: this.spectralFlatness(spectrum),
        mfcc: this.calculateMFCC(spectrum),
        chroma: this.calculateChroma(spectrum),
      });
    }
    
    return features;
  }
  
  /**
   * 動的特徴を抽出
   */
  private async extractDynamicFeatures(audioData: Float32Array): Promise<DynamicFeatures[]> {
    const features: DynamicFeatures[] = [];
    const hopLength = this.options.hopLength || 512;
    const sampleRate = 44100;
    
    for (let i = 0; i + hopLength < audioData.length; i += hopLength) {
      const frame = audioData.slice(i, i + hopLength);
      
      features.push({
        time: (i / sampleRate) * 1000,
        rms: this.calculateRMS(frame),
        zcr: this.calculateZCR(frame),
        energy: this.calculateFrameEnergy(frame),
        loudness: this.calculateLoudness(frame),
      });
    }
    
    return features;
  }
  
  /**
   * エネルギーを計算
   */
  private calculateEnergy(audioData: Float32Array, hopLength: number): number[] {
    const energy: number[] = [];
    
    for (let i = 0; i + hopLength < audioData.length; i += hopLength) {
      const frame = audioData.slice(i, i + hopLength);
      energy.push(this.calculateFrameEnergy(frame));
    }
    
    return energy;
  }
  
  /**
   * フレームエネルギーを計算
   */
  private calculateFrameEnergy(frame: Float32Array): number {
    return frame.reduce((sum, sample) => sum + sample * sample, 0) / frame.length;
  }
  
  /**
   * RMSを計算
   */
  private calculateRMS(frame: Float32Array): number {
    const sumSquares = frame.reduce((sum, sample) => sum + sample * sample, 0);
    return Math.sqrt(sumSquares / frame.length);
  }
  
  /**
   * ゼロ交差率を計算
   */
  private calculateZCR(frame: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < frame.length; i++) {
      if ((frame[i] >= 0) !== (frame[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / frame.length;
  }
  
  /**
   * ラウドネスを計算（簡易版）
   */
  private calculateLoudness(frame: Float32Array): number {
    const rms = this.calculateRMS(frame);
    // A-weighting approximation
    return Math.log10(Math.max(rms, 1e-10)) * 20 + 40;
  }
  
  /**
   * スペクトルフラックスを計算
   */
  private calculateSpectralFlux(audioData: Float32Array, hopLength: number): number[] {
    const flux: number[] = [];
    let prevSpectrum: Float32Array | null = null;
    
    for (let i = 0; i + this.options.fftSize! < audioData.length; i += hopLength) {
      const frame = audioData.slice(i, i + this.options.fftSize!);
      const spectrum = this.fft(frame);
      
      if (prevSpectrum) {
        let sum = 0;
        for (let j = 0; j < spectrum.length; j++) {
          const diff = spectrum[j] - prevSpectrum[j];
          if (diff > 0) sum += diff * diff;
        }
        flux.push(Math.sqrt(sum));
      } else {
        flux.push(0);
      }
      
      prevSpectrum = spectrum;
    }
    
    return flux;
  }
  
  /**
   * ピークを検出
   */
  private findPeaks(data: number[], threshold: number): number[] {
    const peaks: number[] = [];
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const std = Math.sqrt(
      data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length
    );
    
    const adaptiveThreshold = mean + threshold * std;
    
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > adaptiveThreshold &&
          data[i] > data[i - 1] &&
          data[i] > data[i + 1]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * FFT（簡易版 - 実際はより高速なアルゴリズムを使用）
   */
  private fft(frame: Float32Array): Float32Array {
    // 簡易的なDFT実装（実際はFFTライブラリを使用すべき）
    const N = frame.length;
    const spectrum = new Float32Array(N / 2);
    
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += frame[n] * Math.cos(angle);
        imag += frame[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }
  
  /**
   * テンポを検出（相互相関法）
   */
  private detectTempoByCrossCorrelation(audioData: Float32Array): number {
    // 簡易版 - BPM 60-180の範囲で検出
    const sampleRate = 44100;
    const minBPM = 60;
    const maxBPM = 180;
    
    // エネルギーエンベロープを計算
    const envelope = this.calculateEnergy(audioData, 512);
    
    // 自己相関を計算
    let maxCorr = 0;
    let bestLag = 0;
    
    for (let bpm = minBPM; bpm <= maxBPM; bpm += 5) {
      const lag = Math.round((60 / bpm) * (sampleRate / 512));
      let corr = 0;
      
      for (let i = 0; i < envelope.length - lag; i++) {
        corr += envelope[i] * envelope[i + lag];
      }
      
      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }
    
    return Math.round(60 / (bestLag * 512 / sampleRate));
  }
  
  /**
   * 周波数を推定
   */
  private estimateFrequency(frame: Float32Array): number {
    const spectrum = this.fft(frame);
    let maxBin = 0;
    let maxValue = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > maxValue) {
        maxValue = spectrum[i];
        maxBin = i;
      }
    }
    
    return (maxBin * 44100) / (spectrum.length * 2);
  }
  
  /**
   * スペクトル重心
   */
  private spectralCentroid(spectrum: Float32Array, sampleRate: number): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const freq = (i * sampleRate) / (spectrum.length * 2);
      weightedSum += freq * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }
  
  /**
   * スペクトル広がり
   */
  private spectralSpread(spectrum: Float32Array, sampleRate: number): number {
    const centroid = this.spectralCentroid(spectrum, sampleRate);
    let weightedVariance = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const freq = (i * sampleRate) / (spectrum.length * 2);
      weightedVariance += Math.pow(freq - centroid, 2) * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    return magnitudeSum > 0 ? Math.sqrt(weightedVariance / magnitudeSum) : 0;
  }
  
  /**
   * スペクトルフラックス（フレーム間）
   */
  private spectralFluxFrame(spectrum: Float32Array, prevFeatures: SpectralFeatures): number {
    // 前フレームのスペクトルが必要（簡易版）
    return 0; // 実装簡略化
  }
  
  /**
   * スペクトルロールオフ
   */
  private spectralRolloff(spectrum: Float32Array, sampleRate: number): number {
    const totalEnergy = spectrum.reduce((sum, val) => sum + val * val, 0);
    const threshold = totalEnergy * 0.85;
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i] * spectrum[i];
      if (cumulativeEnergy >= threshold) {
        return (i * sampleRate) / (spectrum.length * 2);
      }
    }
    
    return sampleRate / 2;
  }
  
  /**
   * スペクトル平坦性
   */
  private spectralFlatness(spectrum: Float32Array): number {
    const geometricMean = Math.exp(
      spectrum.reduce((sum, val) => sum + Math.log(Math.max(val, 1e-10)), 0) / spectrum.length
    );
    const arithmeticMean = spectrum.reduce((sum, val) => sum + val, 0) / spectrum.length;
    
    return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
  }
  
  /**
   * MFCC係数を計算（簡易版）
   */
  private calculateMFCC(spectrum: Float32Array): number[] {
    // 13次元のMFCC（簡易版）
    const mfcc = new Array(13).fill(0);
    
    // メルフィルタバンクを適用（省略）
    // DCTを適用（省略）
    
    return mfcc;
  }
  
  /**
   * クロマベクトルを計算
   */
  private calculateChroma(spectrum: Float32Array): number[] {
    const chroma = new Array(12).fill(0);
    const sampleRate = 44100;
    
    for (let i = 0; i < spectrum.length; i++) {
      const freq = (i * sampleRate) / (spectrum.length * 2);
      if (freq > 80 && freq < 4000) { // 音楽的な周波数範囲
        const pitch = 12 * Math.log2(freq / 440) + 69;
        const chromaBin = Math.round(pitch) % 12;
        if (chromaBin >= 0 && chromaBin < 12) {
          chroma[chromaBin] += spectrum[i];
        }
      }
    }
    
    // 正規化
    const sum = chroma.reduce((s, v) => s + v, 0);
    if (sum > 0) {
      for (let i = 0; i < 12; i++) {
        chroma[i] /= sum;
      }
    }
    
    return chroma;
  }
  
  /**
   * 統計情報を計算
   */
  private calculateStatistics(
    dynamicFeatures: DynamicFeatures[],
    spectralFeatures: SpectralFeatures[]
  ): MusicAnalysisResult['statistics'] {
    const energyValues = dynamicFeatures.map(f => f.energy);
    const centroidValues = spectralFeatures.map(f => f.centroid);
    const loudnessValues = dynamicFeatures.map(f => f.loudness);
    
    return {
      energy: this.calculateStats(energyValues),
      spectralCentroid: this.calculateStats(centroidValues),
      loudness: this.calculateStats(loudnessValues),
    };
  }
  
  /**
   * 統計値を計算
   */
  private calculateStats(values: number[]): {
    min: number;
    max: number;
    mean: number;
    std: number;
  } {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    
    return { min, max, mean, std };
  }
}