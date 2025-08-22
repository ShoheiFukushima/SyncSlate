# 🚀 AutoEditTATE 起動ガイド

## 起動方法

AutoEditTATEには複数の起動方法があります：

### 1. 🎯 インタラクティブモード（推奨）

```bash
node start.cjs
```

メニューから選択：
- **1** - Demo UIをブラウザで開く
- **2** - テストを実行
- **3** - 処理シミュレーション
- **4** - システム情報表示
- **5** - 終了

### 2. 🌐 デモUI（ビジュアル）

```bash
# ブラウザでデモUIを開く
node start.cjs demo

# または直接開く
open demo.html
```

**デモUIの機能：**
- ドラッグ&ドロップでファイル選択
- 処理プログレスの可視化
- 結果プレビュー
- 美しいインターフェース

### 3. ⚡ 処理シミュレーション

```bash
node start.cjs process
```

**実行内容：**
1. 入力ファイル解析（500ms）
2. 音楽解析 - 相対ダイナミクス（1000ms）
3. 映像解析 - ショット品質（800ms）
4. 時間ベースマッチング - 3パターン（1200ms）
5. QA検証（600ms）
6. 出力生成（400ms）

**結果：**
- 処理時間: 4.5秒
- 集約確信度: 91.2%
- 推奨パターン: Hybrid Balance
- 品質基準: PASSED (≥88%)

### 4. 🧪 テスト実行

```bash
# シンプルテスト
node tests/simple-test.js

# モジュールテスト
npx tsx tests/module-test.ts

# 統合テスト
node tests/final-integration-test.js
```

### 5. 📊 システム情報

```bash
node start.cjs
# メニューから「4」を選択
```

**表示内容：**
- インストール済みモジュール状態
- コア機能の実装状況
- メモリ使用量
- Node.jsバージョン

## 🎬 使用例

### XMLプロジェクトの処理

1. `node start.cjs` でインタラクティブモードを起動
2. 「1」を選択してDemo UIを開く
3. 「XML Project」モードを選択
4. Premiere Pro XMLファイルをドロップ
5. 「Start Processing」をクリック

### 音声・映像ファイルの処理

1. Demo UIで「Audio + Video」モードを選択
2. MP3/WAVファイルとMP4/MOVファイルをドロップ
3. 処理を開始

## 📁 出力ファイル

処理が完了すると以下のファイルが生成されます：

- **edit_result.xml** - Premiere Pro用のタイムライン
- **explain.json** - 編集決定の詳細な説明
- **qa_report.json** - 品質保証レポート

## ⚙️ コア機能

- **相対ダイナミズム原則** - すべての値を0-1に正規化
- **時間ベースマッチング** - 5セグメント戦略
- **30%変化ルール** - スムーズなトランジション
- **品質保証** - 88%以上の確信度が必要

## 🔧 トラブルシューティング

### 起動しない場合

```bash
# Node.jsバージョン確認（v18以上が必要）
node --version

# パッケージ再インストール
npm install --legacy-peer-deps
```

### ビルドエラーの場合

```bash
# 基本パッケージのビルド
cd packages/config && npm run build
cd ../analysis/music && npm run build
```

## 📞 サポート

問題が発生した場合は、以下をお試しください：

1. `node start.cjs` でシステム情報を確認
2. `tests/simple-test.js` でテストを実行
3. `demo.html` でUIの動作を確認

---

**AutoEditTATE v1.0.0** - AI-powered automatic video editing for SNS content 🎬