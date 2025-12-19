# SMART CUES 機能 - 実装ドキュメント集

## 📁 ドキュメント構成

このフォルダには、SMART CUES機能の実装に必要なすべてのドキュメントが含まれています。

### 1. 実装計画 (`SMART_CUES_IMPLEMENTATION_PLAN.md`)
- **概要**: 機能全体の実装計画とチェックリスト
- **内容**:
  - 使用イメージとユースケース
  - Phase別の実装タスクリスト（チェックボックス付き）
  - 技術的課題と解決策
  - テストシナリオ
  - 推奨実装スケジュール

### 2. UI/UXデザイン (`SMART_CUES_UI_DESIGN.md`)
- **概要**: UIコンポーネントとデザインの詳細仕様
- **内容**:
  - カラーパレット定義
  - コンポーネント別のCSS設計
  - レスポンシブデザイン
  - アニメーション定義
  - アクセシビリティ対応

### 3. データアーキテクチャ (`SMART_CUES_DATA_ARCHITECTURE.md`)
- **概要**: データ構造とステート管理の設計
- **内容**:
  - TypeScript型定義（SmartCue, Session, etc.）
  - カスタムフック設計（useSmartCues, useAudioPlayback, useFileUpload）
  - LocalStorage操作ユーティリティ
  - データバリデーションとセキュリティ

### 4. 音声エンジン (`SMART_CUES_AUDIO_ENGINE.md`)
- **概要**: 音声再生ロジックの詳細設計
- **内容**:
  - カウントループの実装
  - 音声タイプ別の再生ロジック
  - タイミング制御（0.8秒制限、カウントスキップ）
  - プリロード＆キャッシュ戦略
  - 音声エンジンクラス設計

---

## 🚀 実装開始前のチェックリスト

実装を始める前に、以下を確認してください：

### ドキュメントレビュー
- [ ] `SMART_CUES_IMPLEMENTATION_PLAN.md` を読み、全体像を把握
- [ ] `SMART_CUES_UI_DESIGN.md` を読み、UIコンポーネントを理解
- [ ] `SMART_CUES_DATA_ARCHITECTURE.md` を読み、データ構造を確認
- [ ] `SMART_CUES_AUDIO_ENGINE.md` を読み、音声ロジックを理解

### 技術スタック確認
- [ ] React + TypeScript の環境が整っている
- [ ] Gemini API キーが設定されている（`VITE_GEMINI_API_KEY`）
- [ ] AudioContext API がサポートされているブラウザで開発

### 依存関係
- [ ] uuid（UUIDv4生成用）
- [ ] react-window（仮想スクロール用、50個以上のCUE時）
- [ ] Heroicons または同等のアイコンライブラリ

---

## 📋 Phase別実装ガイド

### Phase 1: 基本機能（最優先）

#### 1.1 型定義の作成
**ファイル**: `src/types/smart-cues.ts`
- SmartCue型、AudioType型、Session型を定義
- 参照: `SMART_CUES_DATA_ARCHITECTURE.md`

#### 1.2 マーカー打ちボタンのUI
**ファイル**: `src/components/PinButton.tsx`
- スレート実行中に表示
- ミュートボタンの右側に配置
- 参照: `SMART_CUES_UI_DESIGN.md` - Section 1

#### 1.3 基本的なCUE編集画面
**ファイル**: `src/components/SmartCuesEditor.tsx`
- SMART CUESセクションの追加
- CUEカードの表示（テキストタイプのみ）
- 参照: `SMART_CUES_UI_DESIGN.md` - Section 2, 3

#### 1.4 ステート管理
**ファイル**: `src/hooks/useSmartCues.ts`
- addCue, updateCue, deleteCue関数
- LocalStorageへの永続化
- 参照: `SMART_CUES_DATA_ARCHITECTURE.md` - useSmartCues

#### 1.5 テキスト読み上げ（0.8秒制限）
**ファイル**: `src/hooks/useAudioPlayback.ts`
- speakTextWithLimit関数
- 参照: `SMART_CUES_AUDIO_ENGINE.md` - Section 1

---

### Phase 2: コア機能の完成

#### 2.1 プリセット効果音
**ファイル**: `src/sounds/` (音声ファイル配置)
- gunshot.mp3, phone-ring.mp3
- 参照: `SMART_CUES_AUDIO_ENGINE.md` - Section 3

#### 2.2 電話コールコントロール
**ファイル**: `src/components/PhoneControl.tsx`
- スライダーでコール回数指定
- 参照: `SMART_CUES_UI_DESIGN.md` - Section 5

#### 2.3 LocalStorage永続化
**ファイル**: `src/utils/storage.ts`
- loadStorage, saveStorage, saveSession
- 参照: `SMART_CUES_DATA_ARCHITECTURE.md` - LocalStorage操作

---

### Phase 3: 高度な機能

#### 3.1 カスタム音声ファイルアップロード
**ファイル**: `src/hooks/useFileUpload.ts`
- uploadAudioFile関数
- ファイルサイズ制限（5MB）
- 参照: `SMART_CUES_DATA_ARCHITECTURE.md` - useFileUpload

#### 3.2 カスタム音声の長尺再生
**ファイル**: 音声エンジンに統合
- カウントスキップロジック
- 参照: `SMART_CUES_AUDIO_ENGINE.md` - カウントスキップロジック

#### 3.3 UI/UXの最終調整
- アニメーション追加
- レスポンシブ対応
- 参照: `SMART_CUES_UI_DESIGN.md` - アニメーション、レスポンシブデザイン

---

## 🎯 主要な技術的ポイント

### 1. 0.8秒制限の実装
テキスト読み上げは必ず0.8秒で強制ストップします。

```typescript
const stopTime = startTime + 0.8;
source.stop(stopTime);
```

**重要**: AudioContext.currentTimeベースで精密に制御する必要があります。

### 2. 1秒間隔の厳守
カウントは必ず1秒ごとに進みます。0.8秒の音声再生後も、1秒経過を待ってから次のカウントに進みます。

```typescript
const elapsed = audioContext.currentTime - loopStartTime;
const waitTime = Math.max(0, 1.0 - elapsed);
await sleep(waitTime * 1000);
```

### 3. カスタム音声の長尺再生
3秒や5秒の音声は最後まで再生し、その間のカウントをスキップします。

```typescript
const skipCount = Math.ceil(audioLength); // 3.2秒 → 4カウントスキップ
currentCount += skipCount;
```

### 4. 1秒に1回のマーカー制限
連打防止のため、最後のマーカーから1秒以上経過していないとマーカーを打てません。

```typescript
if (currentTime - lastPinTime < 1) {
  showError('1秒以上空けてください');
  return;
}
```

---

## 🧪 テスト計画

### 単体テスト
- [ ] SmartCue型のバリデーション
- [ ] useSmartCues フックの動作
- [ ] useAudioPlayback フックの動作
- [ ] useFileUpload フックの動作

### 統合テスト
- [ ] マーカー打ち → CUE追加 → LocalStorage保存
- [ ] CUE編集 → テキスト入力 → 読み上げ
- [ ] 電話コール回数変更 → 再生
- [ ] カスタム音声アップロード → 再生

### E2Eテスト
- [ ] スレート実行 → マーカー3個打つ → カット → CUE編集
- [ ] CUE編集 → テキスト入力 → 次回スレート実行で読み上げ確認
- [ ] カスタム音声（3秒）→ カウントスキップ確認

---

## 🚨 注意事項

### セキュリティ
- ユーザー入力のサニタイズを忘れずに（XSS対策）
- ファイルサイズ制限を厳守（5MB以下）
- LocalStorage容量制限に注意（QuotaExceededError）

### パフォーマンス
- CUEが50個以上の場合、仮想スクロール（react-window）を使用
- 音声のプリロード＆キャッシュを活用
- useMemoでソート済みリストをキャッシュ

### ブラウザ互換性
- Safari: AudioContext初期化はユーザー操作後に行う
- iOS Safari: ファイルアップロードのフォーマット制限に注意
- Chrome/Firefox: AudioContext API は問題なし

---

## 📞 サポートとフィードバック

実装中に疑問が出た場合：
1. 該当するドキュメントを再確認
2. コードコメントを追加して質問
3. テストコードを書いて動作確認

---

## 📅 推奨スケジュール（再掲）

### Week 1: Phase 1
- マーカー打ちボタン実装
- 基本的なCUE編集画面
- テキスト読み上げ（0.8秒制限）

### Week 2: Phase 2
- プリセット効果音実装
- LocalStorage永続化
- UI/UXの改善

### Week 3: Phase 3
- カスタム音声ファイル対応
- 長尺音声の再生ロジック
- 総合テスト

### Week 4: テストと調整
- すべてのテストシナリオ実行
- バグ修正
- ドキュメント整備

---

## ✅ 完成の定義

以下がすべて満たされたら機能完成とみなします：

- [ ] `SMART_CUES_IMPLEMENTATION_PLAN.md` のすべてのチェックリストが完了
- [ ] モバイル/タブレット/デスクトップで動作確認済み
- [ ] すべてのテストシナリオがパス
- [ ] ドキュメント更新完了（README, アーキテクチャ）
- [ ] ユーザーによる実際の撮影現場でのテスト完了

---

**Good luck with the implementation! 🚀**

**作成日**: 2025-01-12
**最終更新**: 2025-01-12
**ステータス**: 設計完了、実装準備完了
