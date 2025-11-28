# SyncSlate - テストガイド

## 🎯 テスト目的

クロスデバイス同期システムの動作検証と精度測定

---

## 📋 前提条件

1. **開発サーバー起動**
   ```bash
   npm run dev
   ```
   → http://localhost:3002/

2. **環境変数設定**
   - `.env`ファイルに`VITE_GEMINI_API_KEY`を設定
   - Supabaseテスト用: `VITE_SUPABASE_URL`と`VITE_SUPABASE_ANON_KEY`が設定済み

---

## 🧪 テスト1: BroadcastChannelモード（同一ブラウザ）

### 準備
1. Chrome/Edgeを起動
2. http://localhost:3002/ を開く（タブ1: HOST）
3. Settings（⚙️）を開く
4. **Synchronization Mode** → **BroadcastChannel**を選択
5. Settings を閉じる

### テスト手順

#### 1-1. HOST/CLIENT切り替え確認
```
[タブ1: HOST]
1. デフォルトでHOSTモード
2. ヘッダーに "HOST" バッジが表示されていることを確認

[タブ2: CLIENT]
1. 新しいタブで http://localhost:3002/?role=client を開く
2. "CLIENT" バッジが表示されていることを確認
3. "Client Mode" 画面が表示されることを確認
```

✅ **期待結果**: HOSTとCLIENTが正しく識別される

#### 1-2. 設定同期確認
```
[タブ1: HOST]
1. Duration を 30s → 45s に変更
2. Pre-Roll を 5s → 3s に変更
3. Smart Cues を追加: 15s "Camera check"

[タブ2: CLIENT]
1. 開発者ツール（F12）→ Console を開く
2. "[CLIENT] Applying SYNC_STATE from HOST" のログを確認
3. 画面下部のセッション情報で変更が反映されていることを確認
   - DURATION: 45s
   - PRE-ROLL: 3s
```

✅ **期待結果**: 設定がリアルタイムで同期される

#### 1-3. 同期スタート/ストップ確認
```
[タブ1: HOST]
1. "Start Sequence" ボタンをクリック
2. カウントダウンが始まることを確認

[タブ2: CLIENT]
1. 同時にカウントダウンが始まることを確認
2. 数字がHOSTと同期していることを確認

[タブ1: HOST]
1. "CUT" ボタンをクリック
2. シーケンスが停止することを確認

[タブ2: CLIENT]
1. 同時にシーケンスが停止することを確認
```

✅ **期待結果**: スタート/ストップが同期される（誤差 ±50ms程度）

#### 1-4. キーボードショートカット確認
```
[タブ1: HOST]
1. Spaceキーを押す → シーケンス開始
2. もう一度Spaceキーを押す → シーケンス停止

[タブ2: CLIENT]
1. HOSTの操作に同期することを確認
```

✅ **期待結果**: キーボード操作でも同期される

---

## 🌐 テスト2: Supabaseモード（クロスデバイス）

### 準備
1. Settings（⚙️）を開く
2. **Synchronization Mode** → **Supabase Realtime**を選択
3. Settings を閉じる

### テスト手順

#### 2-1. セッション作成確認（HOST）
```
[PC: HOST]
1. http://localhost:3002/ を開く（HOSTモード）
2. 開発者ツール（F12）→ Console を開く
3. 以下のログが表示されることを確認:
   - "[HOST] Supabase session created"
   - セッションIDが表示される

4. "Share Session" セクションの "Copy Link" をクリック
5. クリップボードにURLがコピーされる
```

✅ **期待結果**: Supabaseセッションが正常に作成される

#### 2-2. クライアント参加確認
```
[タブレット/スマホ: CLIENT]
1. コピーしたURL（例: http://192.168.11.56:3002/?role=client&session=xxx）をブラウザで開く
2. 開発者ツール → Console を開く
3. 以下のログが表示されることを確認:
   - "[CLIENT] Joined Supabase session: xxx"
   - Realtime接続成功のログ

4. HOSTの設定が自動的に適用されていることを確認
```

✅ **期待結果**: CLIENTがSupabaseセッションに参加できる

#### 2-3. クロスデバイス同期確認
```
[PC: HOST]
1. Duration を変更
2. Smart Cues を追加

[タブレット: CLIENT]
1. Console で "Supabase message: SYNC_STATE" のログを確認
2. 設定が自動的に反映されることを確認
```

✅ **期待結果**: 異なるデバイス間で設定が同期される

#### 2-4. クロスデバイス スタート/ストップ確認
```
[PC: HOST]
1. "Start Sequence" ボタンをクリック

[タブレット: CLIENT]
1. 同時にカウントダウンが始まることを確認
2. 数字の同期を目視確認

[PC: HOST]
1. "CUT" ボタンをクリック

[タブレット: CLIENT]
1. 同時にシーケンスが停止することを確認
```

✅ **期待結果**: 異なるデバイス間でスタート/ストップが同期される

---

## 📊 テスト3: 精度測定

### 3-1. 視覚的同期精度（目視）
```
[複数デバイス]
1. 同じ画面を並べて配置
2. スタートボタンを押す
3. カウントダウンの数字が同じタイミングで変わるか確認
```

**判定基準**:
- ✅ 優秀: 数字の変化が同時（目視で同期）
- ⚠️ 許容: 1フレーム程度のズレ（±16ms）
- ❌ 要改善: 明らかなズレ（±50ms以上）

### 3-2. コンソールログで精度確認
```
[開発者ツール → Console]
1. スタート時のログを確認:
   [HOST] Broadcasting CMD_START with startTime: 2025-11-28T10:30:45.123Z
   [CLIENT] Starting sequence at: 2025-11-28T10:30:45.123Z

2. タイムスタンプが一致していることを確認
```

### 3-3. ネットワーク遅延の確認（Supabaseモード）
```
[開発者ツール → Network]
1. WebSocket接続を確認
2. メッセージの送受信時間を確認
3. RTT（往復時間）を測定
```

**判定基準**:
- ✅ 優秀: RTT < 50ms
- ⚠️ 許容: RTT < 100ms
- ❌ 要改善: RTT > 100ms

---

## 🐛 トラブルシューティング

### エラー: "Supabase Sync Initialization failed"
**原因**: Supabase環境変数が未設定
**対処**:
1. `.env`ファイルを確認
2. `VITE_SUPABASE_URL`と`VITE_SUPABASE_ANON_KEY`が正しく設定されているか確認
3. サーバーを再起動: `npm run dev`

### エラー: "BroadcastChannel not supported"
**原因**: ブラウザが対応していない
**対処**:
1. Chrome/Edge/Firefoxの最新版を使用
2. Supabaseモードに切り替え

### クライアントが接続できない
**原因**: ネットワーク設定
**対処**:
1. 同じWi-Fiネットワークに接続
2. ファイアウォールを確認
3. Network URLを使用: `http://192.168.11.56:3002/`

### 同期がずれる
**原因**: ネットワーク遅延
**対処**:
1. Wi-Fi接続を確認
2. ネットワークの混雑を避ける
3. 開発者ツールでRTTを確認

---

## ✅ テストチェックリスト

### BroadcastChannelモード
- [ ] HOSTモードで起動
- [ ] CLIENTモードで起動
- [ ] 設定同期（Duration, Pre-Roll, Smart Cues）
- [ ] スタート同期
- [ ] ストップ同期
- [ ] キーボードショートカット（Space）
- [ ] 複数クライアント（3+タブ）

### Supabaseモード
- [ ] セッション作成（HOST）
- [ ] セッション参加（CLIENT）
- [ ] 設定同期（クロスデバイス）
- [ ] スタート同期（クロスデバイス）
- [ ] ストップ同期（クロスデバイス）
- [ ] Share URL コピー機能
- [ ] デバイス離脱処理

### 精度測定
- [ ] 視覚的同期精度（目視）
- [ ] タイムスタンプ精度（Console）
- [ ] ネットワーク遅延（Network）
- [ ] 複数デバイス（PC + タブレット + スマホ）

---

## 📝 テスト結果記録

| テスト項目 | 結果 | 精度 | 備考 |
|-----------|------|------|------|
| BroadcastChannel基本動作 | | | |
| BroadcastChannel設定同期 | | | |
| BroadcastChannelスタート同期 | | | |
| Supabaseセッション作成 | | | |
| Supabaseセッション参加 | | | |
| Supabase設定同期 | | | |
| Supabaseスタート同期 | | | |
| 視覚的同期精度 | | | |
| ネットワーク遅延 | | | |

---

## 🎯 成功基準

### 最小要件
- ✅ BroadcastChannelモードで基本動作
- ✅ Supabaseモードで接続成功
- ✅ 設定が同期される
- ✅ スタート/ストップが同期される

### 推奨要件
- ✅ 視覚的同期精度: ±50ms以内
- ✅ ネットワーク遅延: 100ms以下
- ✅ 3+デバイスで安定動作

### 理想目標（今後の実装）
- ⭐ 視覚的同期精度: ±8ms以内
- ⭐ オーディオ同期精度: ±1ms以内
- ⭐ 時刻同期精度: ±2ms以内
