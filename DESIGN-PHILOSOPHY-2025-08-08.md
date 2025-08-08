# 設計思想: 品質透明性契約 (Quality Transparency Contract)

## 中核理念
**「品質は約束、透明性は信頼」**

AutoEditTATEは、動画編集を単なる自動化ではなく、**説明可能な品質保証プロセス**として再定義する。

## 3つの基本原則

### 1. 品質前置主義 (Quality-First Imperative)
```
実装 < QAスイート < ユーザー体験
```
- **QAスイートが先、実装が後**: テストが定義できないものは実装しない
- **完全成功原則**: 部分的な成功は失敗と同義
- **aggregateConfidence ≥ 0.88**: 明確な品質基準線

### 2. 透明性による信頼 (Trust Through Transparency)
```json
{
  "pattern": "選択した編集パターン",
  "subscores": "4つの評価軸",
  "reasons": "人間が理解できる5つの理由",
  "project_seed": "完全再現性の保証"
}
```
- **explain.json**: すべての決定を説明可能に
- **観測可能性**: logger + explainSinkによる完全追跡
- **エラーも資産**: error_report.jsonも同じ扱い

### 3. 決定論的創造性 (Deterministic Creativity)
```
同じ入力 + 同じproject_seed = 同じ出力
```
- **再現可能な芸術**: クリエイティブでも科学的
- **3パターン生成**: 多様性と効率の両立（GQA）
- **時間セグメント学習**: 0-3秒、30-50秒など部分改善可能

## アーキテクチャ原則

### レイヤー間契約
```
Domain層 ← スキーマ契約 → Application層
    ↑                        ↓
  不変条件              観測可能性層
```

### 失敗の扱い
- **Fast Fail**: 早期発見、早期停止
- **No Silent Failure**: すべての失敗を記録
- **Graceful Degradation禁止**: 中途半端な成功を許さない

## 実装指針

### コード品質
```typescript
// 悪い例: 部分的成功を許容
if (score > 0.5) return "ok";

// 良い例: 明確な基準
if (aggregateConfidence >= 0.88) {
  await storeExplain(explain);
  return { success: true, explain };
} else {
  await storeErrorReport(errors);
  throw new QAFailureError(errors);
}
```

### CI/CD統合
```yaml
# 必須: QAゲート
- name: Run QA Suite
  run: npx tsx qa-runner.ts
  # continue-on-error: false ← 絶対にfalse
```

## なぜこの思想なのか

### 従来の自動編集の問題
- **ブラックボックス**: なぜその編集？
- **不安定**: 毎回違う結果
- **修正不可**: どこを直せばいい？

### 本設計の解決
- **説明可能**: explain.jsonで全決定を開示
- **再現可能**: project_seedで完全再現
- **改善可能**: 時間セグメント別フィードバック

## 実践例

### 開発時
```bash
# 1. まずQAスイートを書く
echo "新機能のQA項目定義" > qa-specs/new-feature.md

# 2. QAが通るまで実装
npm run dev

# 3. explain.jsonを確認
cat qa-results/explain.json
```

### 運用時
```typescript
// ユーザーフィードバック
{
  "segment": "30-50s",
  "feedback": "クライマックスのカット割りが単調",
  "pattern": "dynamic_cut"
}
// → この範囲のみ学習・改善
```

## 技術的負債との向き合い方

### 許容しない負債
- テストのない機能
- explain.jsonのない出力
- 再現不可能な処理

### 許容する負債
- 最適化前のコード（品質保証済み）
- 冗長だが明確なコード
- 将来の拡張用Hook

## まとめ

**「品質透明性契約」は、クリエイティブツールに科学的厳密性を持ち込む設計思想。**

ユーザーは：
- 何が起きているか理解できる
- 同じ結果を再現できる
- 具体的な改善要望を伝えられる

開発者は：
- QAスイートという安全網がある
- observabilityで問題を即座に特定
- 技術的負債を作らない

これは単なる品質管理ではなく、**ユーザーとシステムの間の信頼契約**である。