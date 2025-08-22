# AutoEditTATE 実装引き継ぎ書

Version: v1.0
Date: 2025-08-22
Status: Ready for Implementation

## エグゼクティブサマリー

AutoEditTATEは、SNSショート動画（60秒以内）の自動編集システムである。音楽・映像・歌詞を解析し、視聴者心理に基づいた時間軸別戦略で最適な編集を生成する。本書は、実装チームへの引き継ぎのため、設計思想と実装優先順位を明確化する。

## 1. プロジェクト現状

### 1.1 完成状況
```yaml
全体進捗: 25%
基盤インフラ: 100% ✅
QAスイート基盤: 60% 🟡
ドメイン層: 30% 🟡
コア編集エンジン: 0% ❌
Adobe Premiere連携: 0% ❌
UI実装: 5% ❌
```

### 1.2 開発環境
- **フレームワーク**: Electron + React + TypeScript
- **モノレポ構造**: packages/配下に機能別モジュール
- **QAスイート**: ローカル実行環境構築済み（Gemini Actions連携）
- **ビルドシステム**: npm scripts設定済み

## 2. 核心設計思想（必読）

### 2.1 相対的ダイナミズム原則
**すべての解析値は楽曲・素材内での相対値として扱う**

```typescript
// ❌ 悪い実装
if (bpm > 120) return "fast";

// ✅ 良い実装
const relativeIntensity = (current - song.min) / (song.max - song.min);
if (relativeIntensity > 0.8) return "この曲の中では激しい";
```

### 2.2 時間軸別マッチング戦略
```yaml
0-3秒:   フック（視覚的インパクト優先）
3-10秒:  エンゲージメント（リズム同期優先）
10-30秒: ストーリー展開（意味的な流れ優先）
30-50秒: クライマックス（感情と音楽の同期）
50-60秒: 余韻とループ準備（安定性優先）
```

### 2.3 柔軟なスコアリング
- **提案であって命令ではない**: confidence scoreは編集の提案強度
- **良い素材を優先**: 技術的スコアより実際の映像品質を重視
- **30%変化の法則**: カット間で位置・サイズ・色の30%以上変化が必要

## 3. 実装優先順位（MVP向け10週間計画）

### Phase 1: 基礎実装（3週間）🔴 最優先

#### Week 1-2: 開発環境と設定管理
```typescript
// タスク1: 設定管理システム
packages/
  config/
    src/
      ConfigLoader.ts        // 設定ローダー
      validators/
        SegmentValidator.ts  // セグメント設定検証
    matching-segments.yaml   // 時間軸別設定
    analysis-settings.yaml   // 解析パラメータ

// 実装のポイント
class ConfigLoader {
  // ホットリロード対応（開発時）
  // バリデーション機能
  // 外部設定ファイルで調整可能
}
```

#### Week 3: 音楽解析エンジン（相対的ダイナミズム対応）
```typescript
// タスク3: MusicAnalyzer実装
packages/
  analysis/
    music/
      MusicAnalyzer.ts
      RelativeConverter.ts   // 相対値変換
      EditPointDetector.ts   // 編集点検出

// 必須機能
- BPM検出（参考値として保持）
- ビート/オンセット検出
- 相対的強度計算（0-1スケール）
- 編集点候補の抽出（confidence + flexibility）
```

### Phase 2: マッチングエンジン（2週間）🔴 最優先

#### Week 4: 映像解析エンジン
```typescript
// タスク4: VideoAnalyzer実装
packages/
  analysis/
    video/
      VideoAnalyzer.ts
      ShotUsabilityChecker.ts  // ショット使用可能性
      TransitionValidator.ts   // 30%変化の法則

// 重要な判定
- ショット使用可能時間（1秒から使用可、4秒で安定）
- 30%変化の法則でカット評価
- ヒーローショット判定（エッジ複雑性）
```

#### Week 5: TimeBasedMatchingEngine実装
```typescript
// タスク6: 時間軸別マッチング
packages/
  matching/
    TimeBasedMatchingEngine.ts
    SegmentTransitionManager.ts
    PatternIntegrator.ts

// セグメント別重み（config/matching-segments.yamlから読み込み）
opening:   { visual: 0.5, sync: 0.2, semantic: 0.2, stability: 0.1 }
development: { sync: 0.4, visual: 0.3, semantic: 0.2, stability: 0.1 }
middle:    { semantic: 0.35, sync: 0.25, visual: 0.25, stability: 0.15 }
climax:    { sync: 0.4, visual: 0.35, semantic: 0.15, stability: 0.1 }
ending:    { stability: 0.35, visual: 0.3, semantic: 0.25, sync: 0.1 }
```

### Phase 3: XML入出力（2週間）🔴 必須

#### Week 6: Premiere XML パーサー
```typescript
// タスク9: XML入力処理
packages/
  io/
    xml/
      PremiereXMLParser.ts
      MaterialResolver.ts     // 素材パス解決
      CuePointExtractor.ts    // In/Out点抽出
```

#### Week 7: XML生成とexplain.json
```typescript
// タスク10: 出力処理
packages/
  io/
    xml/
      XMLGenerator.ts
      ExplainJsonBuilder.ts   // 判断根拠の記録

// explain.json必須項目
{
  "aggregateConfidence": 0.88,  // 必須: >= 0.88
  "decisions": [...],            // 各編集判断の根拠
  "qualityMetrics": {...}        // 品質指標
}
```

### Phase 4: QAスイート（1週間）🔴 必須

#### Week 8: バリデーター実装
```typescript
// タスク11: 検証器群
packages/
  qa/
    validators/
      XMLStructureValidator.ts
      TimecodeValidator.ts
      ThirtyPercentRuleValidator.ts  // 新規：30%変化検証
      SegmentTransitionValidator.ts  // 新規：セグメント遷移検証
```

### Phase 5: UI実装（2週間）🟡 高優先

#### Week 9-10: 基本UI
```typescript
// タスク12: メインUI
app/
  renderer/
    components/
      MaterialImporter.tsx     // 素材インポート
      ProgressPanel.tsx        // 処理進捗
      PatternComparison.tsx    // 3パターン比較
      ExplainViewer.tsx        // explain.json表示
```

## 4. 実装時の注意事項

### 4.1 必ず守るべきルール

1. **相対値の徹底**
   ```typescript
   // すべての解析値を0-1の相対値に正規化
   const normalize = (value, min, max) => (value - min) / (max - min);
   ```

2. **スコアは提案**
   ```typescript
   // confidenceは0.0-1.0の提案強度
   editPoint.confidence = 0.8;  // 強い提案
   editPoint.flexibility = 0.1;  // ±0.1秒の柔軟性
   ```

3. **30%変化の法則**
   ```typescript
   // カット間で最低1つの要素が30%以上変化
   const changes = { position: 0.4, size: 0.2, color: 0.1 };
   const isValidTransition = Object.values(changes).some(c => c >= 0.3);
   ```

### 4.2 テスト要件

```yaml
ユニットテスト:
  カバレッジ: >= 70%
  重点領域:
    - 相対値変換ロジック
    - 30%変化の法則
    - セグメント判定
    - スコア計算

統合テスト:
  - 60秒動画の完全処理
  - 3パターン生成成功
  - explain.json検証
  - XML往復テスト

パフォーマンス:
  - 60秒動画: < 5分処理
  - メモリ使用: < 2GB
  - CPU使用率: < 80%
```

### 4.3 設定ファイル構造

```yaml
# config/matching-segments.yaml
segments:
  opening:
    range: [0, 3000]  # ミリ秒
    weights:
      visual: 0.5
      sync: 0.2
    constraints:
      minimumShotLength: 3
      preferHeroShots: true

# 動的調整ルール
adjustments:
  - condition: "music.phase == 'chorus'"
    multiply:
      sync: 1.5
      visual: 1.2
```

## 5. 既存リソース

### 5.1 実装済みコード
- `packages/app-cli/src/qa-runner.ts` - QAスイートのPoC実装
- `packages/observability/` - ロガーとexplainSink
- `app/main/` - Electronメインプロセス
- `app/renderer/` - React基盤（未実装）

### 5.2 設計ドキュメント
- `docs/ANALYSIS-PHASE-DESIGN-2025-08-22.md` - 解析フェーズ詳細設計
- `docs/TIME-BASED-MATCHING-STRATEGY-2025-08-22.md` - 時間軸別マッチング設計
- `docs/LEARNING-BASED-EDITING-SYSTEM-2025-08-22.md` - 将来の学習システム構想
- `docs/roadmap/MVP-IMPLEMENTATION-TASKS-2025-08-22.md` - 詳細タスクリスト

## 6. 推奨実装順序

```mermaid
graph LR
    A[設定管理] --> B[音楽解析]
    B --> C[映像解析]
    C --> D[マッチングエンジン]
    D --> E[XML I/O]
    E --> F[QAスイート]
    F --> G[UI]
    G --> H[テスト・調整]
```

## 7. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 音楽同期精度不足 | 高 | flexibilityパラメータで調整範囲を持たせる |
| 処理速度が遅い | 中 | 並列処理とキャッシング実装 |
| メモリ不足 | 中 | ストリーミング処理で大容量ファイル対応 |
| 30%変化の判定精度 | 高 | 早期プロトタイプで検証、閾値調整可能に |

## 8. コミュニケーション

### 8.1 用語定義
- **相対的ダイナミズム**: 楽曲・素材内での相対値で判断
- **セグメント**: 時間軸で分割した編集戦略の単位
- **ヒーローショット**: 冒頭で使う最高品質のショット
- **explain.json**: 編集判断の根拠を記録したファイル

### 8.2 質問・相談先
- 設計思想について: 本ドキュメントと設計書を参照
- 実装詳細: `docs/`配下の各設計書を参照
- テスト要件: QAスイート仕様を参照

## 9. MVP成功条件

### 必須要件 ✅
- [ ] Premiere XMLから60秒動画を処理
- [ ] 3パターン（dynamic_cut, narrative_flow, hybrid_balance）生成
- [ ] explain.json出力（aggregateConfidence >= 0.88）
- [ ] 処理時間 < 5分
- [ ] 時間軸別マッチング戦略の適用

### 品質基準 ✅
- [ ] クラッシュなし
- [ ] メモリリークなし
- [ ] 再現可能な出力
- [ ] 30%変化の法則を満たす

## 10. 開始前チェックリスト

- [ ] 本引き継ぎ書を完読
- [ ] 設計ドキュメント（4つ）を確認
- [ ] 開発環境セットアップ（npm install）
- [ ] QAスイートの動作確認
- [ ] 設定ファイルのテンプレート確認

## まとめ

AutoEditTATEは、技術的な数値を創造的な編集判断に変換するシステムである。相対的ダイナミズムと時間軸別戦略により、SNSショート動画に最適化された編集を実現する。

実装時は、**提案であって命令ではない**という柔軟性を保ちながら、**良い素材を活かす**ことを最優先に開発を進めること。

---
*実装開始時は本書を基準とし、不明点は設計ドキュメントを参照すること。*