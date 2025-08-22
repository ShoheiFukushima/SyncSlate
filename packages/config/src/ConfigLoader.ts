import { readFile, watch } from 'fs/promises';
import { parse } from 'yaml';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import type { 
  MatchingSegmentsConfig, 
  AnalysisSettingsConfig 
} from './types.js';
import { SegmentValidator } from './validators/SegmentValidator.js';
import { AnalysisValidator } from './validators/AnalysisValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 設定ローダー
 * YAMLファイルの読み込み、バリデーション、ホットリロードを提供
 */
export class ConfigLoader {
  private static instance: ConfigLoader;
  private matchingSegmentsConfig?: MatchingSegmentsConfig;
  private analysisSettingsConfig?: AnalysisSettingsConfig;
  private watchers: Map<string, any> = new Map();
  private readonly configDir: string;
  private readonly isDev: boolean;

  private constructor() {
    this.configDir = path.resolve(__dirname, '..');
    this.isDev = process.env.NODE_ENV !== 'production';
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * マッチングセグメント設定を取得
   */
  public async getMatchingSegments(): Promise<MatchingSegmentsConfig> {
    if (!this.matchingSegmentsConfig) {
      await this.loadMatchingSegments();
    }
    return this.matchingSegmentsConfig!;
  }

  /**
   * 解析設定を取得
   */
  public async getAnalysisSettings(): Promise<AnalysisSettingsConfig> {
    if (!this.analysisSettingsConfig) {
      await this.loadAnalysisSettings();
    }
    return this.analysisSettingsConfig!;
  }

  /**
   * 特定セグメントの設定を取得
   */
  public async getSegmentConfig(segmentName: string) {
    const config = await this.getMatchingSegments();
    const segment = config.segments[segmentName];
    if (!segment) {
      throw new Error(`Segment "${segmentName}" not found in configuration`);
    }
    return segment;
  }

  /**
   * 時間からセグメントを判定
   */
  public async getSegmentByTime(timeMs: number) {
    const config = await this.getMatchingSegments();
    for (const [name, segment] of Object.entries(config.segments)) {
      const [start, end] = segment.range;
      if (timeMs >= start && timeMs < end) {
        return { name, ...segment };
      }
    }
    throw new Error(`No segment found for time ${timeMs}ms`);
  }

  /**
   * 動的調整を適用
   */
  public async applyAdjustments(
    segmentName: string,
    context: Record<string, any>
  ) {
    const config = await this.getMatchingSegments();
    const segment = { ...config.segments[segmentName] };
    
    for (const adjustment of config.adjustments) {
      if (this.evaluateCondition(adjustment.condition, context)) {
        // 重みの乗算
        if (adjustment.multiply) {
          for (const [key, multiplier] of Object.entries(adjustment.multiply)) {
            if (key in segment.weights) {
              (segment.weights as any)[key] *= multiplier;
            }
          }
        }
        
        // 制約の変更
        if (adjustment.modify) {
          for (const [path, value] of Object.entries(adjustment.modify)) {
            this.setNestedValue(segment, path, value);
          }
        }
      }
    }
    
    // 重みを正規化（合計1.0に）
    const totalWeight = Object.values(segment.weights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(segment.weights)) {
      (segment.weights as any)[key] /= totalWeight;
    }
    
    return segment;
  }

  /**
   * マッチングセグメント設定を読み込み
   */
  private async loadMatchingSegments() {
    const filePath = path.join(this.configDir, 'matching-segments.yaml');
    const content = await readFile(filePath, 'utf-8');
    const rawConfig = parse(content);
    
    // バリデーション
    const validator = new SegmentValidator();
    this.matchingSegmentsConfig = validator.validate(rawConfig);
    
    // 開発環境ではホットリロードを有効化
    if (this.isDev) {
      this.setupWatcher(filePath, () => this.loadMatchingSegments());
    }
  }

  /**
   * 解析設定を読み込み
   */
  private async loadAnalysisSettings() {
    const filePath = path.join(this.configDir, 'analysis-settings.yaml');
    const content = await readFile(filePath, 'utf-8');
    const rawConfig = parse(content);
    
    // バリデーション
    const validator = new AnalysisValidator();
    this.analysisSettingsConfig = validator.validate(rawConfig);
    
    // 開発環境ではホットリロードを有効化
    if (this.isDev) {
      this.setupWatcher(filePath, () => this.loadAnalysisSettings());
    }
  }

  /**
   * ファイル監視を設定
   */
  private async setupWatcher(filePath: string, callback: () => Promise<void>) {
    // 既存のウォッチャーをクリーンアップ
    if (this.watchers.has(filePath)) {
      const watcher = this.watchers.get(filePath);
      watcher.close();
    }
    
    // 新しいウォッチャーを作成
    const watcher = watch(filePath);
    this.watchers.set(filePath, watcher);
    
    // ファイル変更時の処理
    (async () => {
      for await (const event of watcher) {
        if (event.eventType === 'change') {
          console.log(`Config file changed: ${filePath}`);
          try {
            await callback();
            console.log(`Config reloaded: ${filePath}`);
          } catch (error) {
            console.error(`Failed to reload config: ${error}`);
          }
        }
      }
    })();
  }

  /**
   * 条件式を評価
   */
  private evaluateCondition(condition: string, context: Record<string, any>): boolean {
    // シンプルな条件評価（実際の実装では式パーサーを使用）
    const [left, operator, right] = condition.split(/\s+/);
    const leftValue = this.getNestedValue(context, left);
    const rightValue = this.parseValue(right);
    
    switch (operator) {
      case '==': return leftValue === rightValue;
      case '!=': return leftValue !== rightValue;
      case '>': return leftValue > rightValue;
      case '>=': return leftValue >= rightValue;
      case '<': return leftValue < rightValue;
      case '<=': return leftValue <= rightValue;
      default: return false;
    }
  }

  /**
   * ネストされた値を取得
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * ネストされた値を設定
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    
    // 相対値の場合は乗算
    if (typeof value === 'number' && value < 1 && value > 0) {
      target[lastKey] = (target[lastKey] || 1) * value;
    } else {
      target[lastKey] = value;
    }
  }

  /**
   * 値をパース
   */
  private parseValue(value: string): any {
    // 文字列リテラル
    if (value.startsWith("'") || value.startsWith('"')) {
      return value.slice(1, -1);
    }
    // 数値
    if (!isNaN(Number(value))) {
      return Number(value);
    }
    // ブール値
    if (value === 'true') return true;
    if (value === 'false') return false;
    // null
    if (value === 'null') return null;
    
    return value;
  }

  /**
   * リソースをクリーンアップ
   */
  public async cleanup() {
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();
  }
}