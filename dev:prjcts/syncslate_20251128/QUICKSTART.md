# SyncSlate - クイックスタート

## 🚀 すぐに始める

### 1. 開発サーバー起動確認

```bash
npm run dev
```

✅ サーバーが起動していることを確認:
- **Local**: http://localhost:3002/
- **Network**: http://192.168.11.56:3002/

---

## 🧪 テスト1: BroadcastChannelモード（5分）

### 手順

1. **HOSTタブを開く**
   ```
   http://localhost:3002/
   ```
   - デフォルトでHOSTモード
   - ヘッダーに「HOST」バッジが表示される

2. **CLIENTタブを開く**（新しいタブ）
   ```
   http://localhost:3002/?role=client
   ```
   - ヘッダーに「CLIENT」バッジが表示される
   - "Client Mode"画面が表示される

3. **設定を変更（HOSTタブ）**
   - Settingsアイコン（⚙️）をクリック
   - Duration: 30s → 45s
   - Pre-Roll: 5s → 3s
   - "Add Cue"をクリック: 15s "Camera check"

4. **CLIENTタブで確認**
   - 開発者ツール（F12）→ Console を開く
   - `[CLIENT] Applying SYNC_STATE from HOST` のログを確認
   - 画面下部のセッション情報で変更が反映されていることを確認

5. **同期テスト**
   - **HOSTタブ**: "Start Sequence"ボタンをクリック
   - **CLIENTタブ**: 同時にカウントダウンが始まることを確認
   - **HOSTタブ**: "CUT"ボタンまたはSpaceキーでストップ
   - **CLIENTタブ**: 同時にストップすることを確認

### ✅ 期待結果
- 設定がリアルタイムで同期
- スタート/ストップが同期（誤差 ±50ms程度）
- キーボードショートカット（Space）も動作

---

## 🌐 テスト2: Supabaseモード（10分）

### 前提条件
- `.env`ファイルにSupabase設定済み
- Supabase Realtime有効

### 手順

1. **HOSTを起動**
   ```
   http://localhost:3002/
   ```

2. **Settingsで同期モード変更**
   - Settingsアイコン（⚙️）をクリック
   - "Synchronization Mode"セクション
   - **"Supabase Realtime"**を選択
   - Settingsを閉じる

3. **セッションURLをコピー**
   - "Share Session"セクションが表示される
   - "Copy Link"ボタンをクリック
   - URLがクリップボードにコピーされる

4. **CLIENTを別デバイスで起動**
   - タブレット/スマホのブラウザで開く
   ```
   http://192.168.11.56:3002/?role=client&session=xxx
   ```
   - 開発者ツール → Console を開く（可能なら）
   - `[CLIENT] Joined Supabase session` のログを確認

5. **クロスデバイス同期テスト**
   - **PC（HOST）**: 設定を変更（Duration, Smart Cuesなど）
   - **タブレット（CLIENT）**: 自動的に反映されることを確認
   - **PC（HOST）**: "Start Sequence"をクリック
   - **タブレット（CLIENT）**: 同時にカウントダウン開始を確認

### ✅ 期待結果
- 異なるデバイス間で設定が同期
- 異なるデバイス間でスタート/ストップが同期
- ネットワーク経由でもリアルタイム性が保たれる

---

## 📊 精度チェック

### 視覚的確認
1. 複数デバイスを並べて配置
2. 同時にカウントダウンの数字を見る
3. ズレがないか目視確認

**判定基準**:
- ✅ 優秀: 数字の変化が同時
- ⚠️ 許容: 1フレーム程度のズレ（±16ms）
- ❌ 要改善: 明らかなズレ（±50ms以上）

### コンソールログ確認
開発者ツール → Console で以下を確認:

```
[HOST] Broadcasting CMD_START with startTime: 2025-11-28T10:30:45.123Z
[CLIENT] Starting sequence at: 2025-11-28T10:30:45.123Z
```

タイムスタンプが一致していることを確認

---

## 🐛 トラブルシューティング

### Q: "Supabase Sync Initialization failed"エラー
**A**: `.env`ファイルを確認
```bash
cat .env | grep VITE_SUPABASE
```
設定が正しいか確認し、サーバーを再起動:
```bash
npm run dev
```

### Q: クライアントが接続できない
**A**:
1. 同じWi-Fiネットワークに接続しているか確認
2. ファイアウォールを確認
3. Network URL（http://192.168.11.56:3002/）を使用

### Q: 同期がずれる
**A**:
1. 開発者ツール → Network でRTTを確認
2. Wi-Fi接続を確認
3. ネットワークの混雑を避ける

---

## 📝 テスト結果の記録

テスト完了後、以下の情報を記録してください:

| 項目 | 結果 | 備考 |
|------|------|------|
| BroadcastChannel基本動作 | ✅/❌ | |
| BroadcastChannel同期精度 | ±__ms | |
| Supabaseセッション作成 | ✅/❌ | |
| Supabaseクロスデバイス同期 | ✅/❌ | |
| 視覚的同期精度 | ±__ms | |
| デバイス数 | __台 | |

---

## 🎯 次のステップ

1. ✅ BroadcastChannelモード動作確認
2. ✅ Supabaseモード動作確認
3. ⏭️ 精度測定と最適化
4. ⏭️ 本番環境へのデプロイ準備

詳細なテスト手順は`TESTING_GUIDE.md`を参照してください。
