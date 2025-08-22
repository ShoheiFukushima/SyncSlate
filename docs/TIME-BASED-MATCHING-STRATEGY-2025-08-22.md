# 時間軸別マッチング戦略設計書
Version: v1.0
Date: 2025-08-22
Status: Implementation Ready

## エグゼクティブサマリー

SNSショート動画（60秒以内）において、冒頭・中盤・終盤で異なる編集戦略を適用する時間軸別マッチングシステムの設計書。視聴者の心理的フローに合わせて動的に編集方針を切り替える。

## 1. 基本設計思想

### 1.1 なぜ時間軸別戦略が必要か

```yaml
視聴者の心理フロー:
  0-3秒:    "見るか判断" → 最大インパクト
  3-10秒:   "興味を持つ" → リズムに乗せる
  10-30秒:  "内容を理解" → ストーリー展開
  30-50秒:  "感情移入"   → クライマックス
  50-60秒:  "満足/共有"  → 余韻とループ
```

### 1.2 設計原則

- **セグメント独立性**: 各時間帯で独立した戦略を適用可能
- **動的適応**: 音楽構造に応じて戦略を動的に調整
- **設定可能性**: MVP後も設定ファイルで調整可能
- **後方互換性**: 既存の3パターン戦略と共存

## 2. セグメント定義

### 2.1 標準セグメント構成

```typescript
interface SegmentDefinition {
  opening: {
    range: [0, 3000],           // 0-3秒
    purpose: "hook",            // フック
    priority: "visual_impact"   // 視覚的インパクト優先
  },
  
  development: {
    range: [3000, 10000],       // 3-10秒
    purpose: "engagement",      // エンゲージメント
    priority: "rhythm_sync"     // リズム同期優先
  },
  
  middle: {
    range: [10000, 30000],      // 10-30秒
    purpose: "narrative",       // 物語展開
    priority: "semantic_flow"   // 意味的な流れ優先
  },
  
  climax: {
    range: [30000, 50000],      // 30-50秒
    purpose: "peak",            // ピーク
    priority: "emotional_sync"  // 感情と音楽の同期
  },
  
  ending: {
    range: [50000, 60000],      // 50-60秒
    purpose: "resolution",      // 解決・余韻
    priority: "loop_ready"      // ループ準備
  }
}
```

### 2.2 セグメント別重み付け

```typescript
interface SegmentWeights {
  opening: {
    sync: 0.20,      // 音楽同期は低め
    visual: 0.50,    // 視覚重視
    semantic: 0.20,  // 何の動画か
    stability: 0.10  // ブレ許容
  },
  
  development: {
    sync: 0.40,      // リズム重視
    visual: 0.30,    
    semantic: 0.20,
    stability: 0.10
  },
  
  middle: {
    sync: 0.25,
    visual: 0.25,
    semantic: 0.35,  // ストーリー重視
    stability: 0.15
  },
  
  climax: {
    sync: 0.40,      // 完全同期
    visual: 0.35,    // 最高の画
    semantic: 0.15,
    stability: 0.10
  },
  
  ending: {
    sync: 0.10,
    visual: 0.30,
    semantic: 0.25,
    stability: 0.35  // 安定重視
  }
}
```

## 3. マッチングエンジン実装

### 3.1 コアエンジン

```typescript
class TimeBasedMatchingEngine {
  private config: SegmentConfig;
  private musicAnalysis: MusicAnalysis;
  private videoAnalysis: VideoAnalysis;
  
  constructor(config?: SegmentConfig) {
    // デフォルト設定または外部設定を読み込み
    this.config = config || this.loadDefaultConfig();
  }
  
  // メインマッチング処理
  async match(
    currentTime: number,
    availableClips: Clip[],
    context: MatchingContext
  ): Promise<MatchingDecision> {
    // 1. 現在のセグメントを判定
    const segment = this.getCurrentSegment(currentTime);
    
    // 2. 音楽フェーズとの調整
    const musicPhase = this.getMusicPhase(currentTime);
    
    // 3. 動的に戦略を調整
    const strategy = this.adjustStrategy(segment, musicPhase);
    
    // 4. クリップをスコアリング
    const scoredClips = this.scoreClips(
      availableClips,
      strategy,
      context
    );
    
    // 5. 最適なクリップを選択
    return this.selectOptimalClip(scoredClips, strategy);
  }
  
  // セグメント判定
  private getCurrentSegment(time: number): Segment {
    for (const [name, segment] of Object.entries(this.config.segments)) {
      if (time >= segment.range[0] && time < segment.range[1]) {
        return { name, ...segment };
      }
    }
    return this.config.segments.middle; // デフォルト
  }
  
  // 音楽構造による調整
  private adjustStrategy(
    segment: Segment,
    musicPhase: MusicPhase
  ): AdjustedStrategy {
    const baseWeights = { ...segment.weights };
    
    // サビの場合は音楽同期を強化
    if (musicPhase.type === 'chorus') {
      baseWeights.sync *= 1.5;
      baseWeights.visual *= 1.2;
    }
    
    // ブレイクダウンの場合は安定性重視
    if (musicPhase.type === 'breakdown') {
      baseWeights.stability *= 1.5;
      baseWeights.sync *= 0.8;
    }
    
    // 相対的な正規化
    return this.normalizeWeights(baseWeights);
  }
}
```

### 3.2 セグメント遷移の管理

```typescript
class SegmentTransitionManager {
  // セグメント間の滑らかな遷移
  async handleTransition(
    fromSegment: Segment,
    toSegment: Segment,
    transitionDuration: number = 500
  ): Promise<TransitionPlan> {
    // 遷移タイプの決定
    const transitionType = this.determineTransitionType(
      fromSegment,
      toSegment
    );
    
    // 重みの補間計画
    const interpolationPlan = this.createInterpolationPlan(
      fromSegment.weights,
      toSegment.weights,
      transitionDuration
    );
    
    // 視覚的連続性の確保
    const continuityCheck = this.validateVisualContinuity(
      fromSegment.lastClip,
      toSegment.firstClip
    );
    
    return {
      type: transitionType,
      duration: transitionDuration,
      interpolation: interpolationPlan,
      continuity: continuityCheck
    };
  }
  
  private determineTransitionType(
    from: Segment,
    to: Segment
  ): TransitionType {
    // オープニング→デベロップメント: スムーズ
    if (from.name === 'opening' && to.name === 'development') {
      return 'smooth';
    }
    
    // ミドル→クライマックス: カット
    if (from.name === 'middle' && to.name === 'climax') {
      return 'cut';
    }
    
    // デフォルト: クロスフェード
    return 'crossfade';
  }
}
```

## 4. 3パターンとの統合

### 4.1 パターン別セグメント調整

```typescript
interface PatternSegmentOverrides {
  dynamic_cut: {
    // より攻撃的な冒頭
    opening: {
      weights: { visual: 0.6, sync: 0.3 },
      constraints: { minimumShotLength: 2 }
    },
    // 高速カット維持
    middle: {
      weights: { sync: 0.45 },
      constraints: { maximumShotLength: 12 }
    }
  },
  
  narrative_flow: {
    // じっくり導入
    opening: {
      weights: { semantic: 0.4, stability: 0.3 },
      constraints: { minimumShotLength: 8 }
    },
    // ストーリー重視の中盤
    middle: {
      weights: { semantic: 0.45 },
      constraints: { avoidJumpCuts: true }
    }
  },
  
  hybrid_balance: {
    // セグメントごとに最適化
    opening: { useDefault: true },
    middle: { adaptive: true },
    climax: { balanceAll: true }
  }
}
```

### 4.2 統合実装

```typescript
class IntegratedMatchingEngine extends TimeBasedMatchingEngine {
  private pattern: EditingPattern;
  
  constructor(pattern: 'dynamic' | 'narrative' | 'hybrid') {
    super();
    this.pattern = pattern;
    this.applyPatternOverrides();
  }
  
  private applyPatternOverrides(): void {
    const overrides = PatternSegmentOverrides[this.pattern];
    
    for (const [segmentName, override] of Object.entries(overrides)) {
      if (override.weights) {
        this.config.segments[segmentName].weights = {
          ...this.config.segments[segmentName].weights,
          ...override.weights
        };
      }
      
      if (override.constraints) {
        this.config.segments[segmentName].constraints = {
          ...this.config.segments[segmentName].constraints,
          ...override.constraints
        };
      }
    }
  }
}
```

## 5. 設定ファイル仕様

### 5.1 YAML設定

```yaml
# config/matching-segments.yaml
version: "1.0"
segments:
  opening:
    range: [0, 3000]
    weights:
      sync: 0.20
      visual: 0.50
      semantic: 0.20
      stability: 0.10
    constraints:
      minimumShotLength: 3
      preferHeroShots: true
      allowJumpCuts: true
    
  development:
    range: [3000, 10000]
    weights:
      sync: 0.40
      visual: 0.30
      semantic: 0.20
      stability: 0.10
    constraints:
      minimumShotLength: 6
      maintainRhythm: true
      
  # ... 他のセグメント

# 動的調整ルール
adjustments:
  - condition: "music.phase == 'chorus'"
    segment: "any"
    multiply:
      sync: 1.5
      visual: 1.2
      
  - condition: "music.intensity > 0.8"
    segment: "climax"
    multiply:
      sync: 1.3
      
  - condition: "available_hero_shot"
    segment: "opening"
    multiply:
      visual: 2.0
```

### 5.2 JSON設定（代替）

```json
{
  "version": "1.0",
  "segments": {
    "opening": {
      "range": [0, 3000],
      "weights": {
        "sync": 0.20,
        "visual": 0.50,
        "semantic": 0.20,
        "stability": 0.10
      }
    }
  }
}
```

## 6. テスト戦略

### 6.1 ユニットテスト

```typescript
describe('TimeBasedMatchingEngine', () => {
  it('should apply correct weights for opening segment', () => {
    const engine = new TimeBasedMatchingEngine();
    const strategy = engine.getStrategyForTime(1500); // 1.5秒
    
    expect(strategy.weights.visual).toBeGreaterThan(0.4);
    expect(strategy.weights.sync).toBeLessThan(0.3);
  });
  
  it('should transition smoothly between segments', () => {
    const engine = new TimeBasedMatchingEngine();
    const transition = engine.getTransition(2900, 3100); // 境界
    
    expect(transition.type).toBe('smooth');
    expect(transition.duration).toBe(500);
  });
  
  it('should boost sync weight during chorus', () => {
    const engine = new TimeBasedMatchingEngine();
    const musicPhase = { type: 'chorus', confidence: 0.9 };
    const strategy = engine.adjustStrategy(segment, musicPhase);
    
    expect(strategy.weights.sync).toBeGreaterThan(
      segment.weights.sync * 1.4
    );
  });
});
```

### 6.2 統合テスト

```typescript
describe('Integration with 3 patterns', () => {
  it('dynamic_cut should have aggressive opening', () => {
    const engine = new IntegratedMatchingEngine('dynamic');
    const opening = engine.getSegmentConfig('opening');
    
    expect(opening.constraints.minimumShotLength).toBeLessThan(4);
  });
  
  it('narrative_flow should have stable middle', () => {
    const engine = new IntegratedMatchingEngine('narrative');
    const middle = engine.getSegmentConfig('middle');
    
    expect(middle.weights.semantic).toBeGreaterThan(0.3);
  });
});
```

## 7. パフォーマンス考慮

### 7.1 キャッシング戦略

```typescript
class SegmentCache {
  private cache = new Map<string, ComputedStrategy>();
  
  getCachedStrategy(
    time: number,
    musicPhase: string
  ): ComputedStrategy | null {
    const key = `${Math.floor(time/100)}_${musicPhase}`;
    return this.cache.get(key) || null;
  }
  
  setCachedStrategy(
    time: number,
    musicPhase: string,
    strategy: ComputedStrategy
  ): void {
    const key = `${Math.floor(time/100)}_${musicPhase}`;
    this.cache.set(key, strategy);
  }
}
```

## 8. 将来の拡張性

### 8.1 機械学習による最適化

```typescript
interface LearnedSegmentOptimization {
  // ユーザーフィードバックから学習
  applyLearnedWeights(
    segment: Segment,
    userPreferences: UserPreferences
  ): OptimizedSegment;
  
  // A/Bテスト結果の反映
  applyABTestResults(
    segment: Segment,
    testResults: ABTestResults
  ): OptimizedSegment;
}
```

### 8.2 プラットフォーム別調整

```typescript
interface PlatformSpecificSegments {
  tiktok: {
    opening: { range: [0, 1500] }  // より短い
  },
  reels: {
    opening: { range: [0, 2500] }
  },
  shorts: {
    opening: { range: [0, 3000] }  // 標準
  }
}
```

## 9. 実装チェックリスト

- [ ] `TimeBasedMatchingEngine`クラスの実装
- [ ] セグメント設定ファイルの作成
- [ ] 既存の3パターンとの統合
- [ ] セグメント遷移マネージャーの実装
- [ ] 音楽フェーズとの連携
- [ ] ユニットテストの作成
- [ ] 統合テストの作成
- [ ] パフォーマンステスト
- [ ] 設定ファイルのバリデーター
- [ ] ドキュメント更新

## 10. まとめ

時間軸別マッチング戦略により、SNSショート動画の視聴体験を最適化する。この設計は：

1. **柔軟性**: MVP後も設定ファイルで調整可能
2. **拡張性**: 将来の学習システムに対応
3. **互換性**: 既存の3パターンと共存
4. **テスト可能**: セグメントごとに独立してテスト可能

実装時は、まず基本的なセグメント分割から始め、段階的に音楽連携や動的調整を追加していく。

---
*本ドキュメントは実装の進捗に応じて更新される。*