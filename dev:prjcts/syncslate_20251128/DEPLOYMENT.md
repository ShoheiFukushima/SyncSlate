# SyncSlate - デプロイ情報

## 🚀 本番環境

### デプロイ日時
**2025-12-01 02:44 JST**

### Production URL
```
https://syncslate20251128.vercel.app
```

### 代替URL（直接デプロイURL）
```
https://syncslate20251128-bfwy3behy-syou430-1042s-projects.vercel.app
```

### デプロイステータス
✅ **Ready** (Production) - 日本語プリインストール音声対応

---

## 📊 ビルド情報

### ビルド統計
- **ビルド時間**: 3.10秒
- **バンドルサイズ**: 430.85 KB
- **Gzip圧縮**: 122.75 KB
- **モジュール数**: 1,770
- **リージョン**: Washington, D.C., USA (East) - iad1
- **マシンスペック**: 2 cores, 8 GB RAM

### ビルドコマンド
```bash
npm install --legacy-peer-deps
vite build
```

---

## 🔐 環境変数

### Production環境
以下の環境変数がVercelに設定済み:

- ✅ `VITE_SUPABASE_URL` (Encrypted)
- ✅ `VITE_SUPABASE_ANON_KEY` (Encrypted)
- ✅ `VITE_ENABLE_SUPABASE_SYNC` (Encrypted)

### 追加設定が必要な環境変数
- `VITE_GEMINI_API_KEY`: 現在未設定（音声機能は使用しないため省略可）
- `VITE_ENABLE_PLATFORM_CORE`: false（不要）
- `VITE_DEBUG_MODE`: false（デフォルト）

---

## 📝 デプロイ手順（再デプロイ時）

### 1. ローカルで変更をコミット
```bash
git add .
git commit -m "feat: 新機能の説明"
```

### 2. リモートにプッシュ
```bash
git push origin main
```

### 3. Vercelでデプロイ
```bash
# プレビューデプロイ
vercel

# 本番デプロイ
vercel --prod
```

### 4. デプロイログ確認
```bash
vercel inspect [DEPLOYMENT_URL] --logs
```

---

## 🌐 アクセス方法

### HOSTモード（セッション作成）
```
https://syncslate20251128.vercel.app/
```

### CLIENTモード（セッション参加）
```
https://syncslate20251128.vercel.app/?role=client&session=SESSION_ID
```

**注意**: セッションIDは、HOSTがSupabase Realtimeモードを選択した際に自動生成されるUUID形式です。

---

## 🧪 テスト方法

### 1. BroadcastChannelモード（同一ブラウザ）
1. HOSTタブを開く: Production URL
2. CLIENTタブを開く: Production URL + `?role=client`
3. Settings → Synchronization Mode → **BroadcastChannel**
4. 設定変更とスタート/ストップをテスト

### 2. Supabaseモード（クロスデバイス）
1. HOSTデバイスで開く: Production URL
2. Settings → Synchronization Mode → **Supabase Realtime**
3. "Share Session" から URL をコピー
4. CLIENTデバイスで開く: コピーしたURL
5. クロスデバイス同期をテスト

---

## 📊 Supabaseデータベース

### 接続情報
- **URL**: https://trpbxikeurikwtvwycvy.supabase.co
- **リージョン**: Northeast Asia (Tokyo)
- **Realtime**: 有効

### テーブル
1. `sync_sessions` - セッション管理
2. `sync_devices` - デバイス追跡
3. `sync_events` - イベント配信

### 接続テスト
```bash
node test-supabase-connection.mjs
```

---

## 🐛 修正履歴の詳細

### 1. 環境変数の改行文字問題（2025-12-01 01:25）
**問題**: WebSocket接続URLに`%0A`（改行文字）が含まれて接続失敗
```
WebSocket connection to 'wss://...?apikey=...%0A&vsn=1.0.0' failed
```

**原因**: `echo`コマンドで環境変数を追加したため、末尾に改行が含まれた

**修正**: `printf`コマンドで環境変数を再設定
```bash
printf "eyJhbGci..." | vercel env add VITE_SUPABASE_ANON_KEY production
```

### 2. Realtime購読パターンの問題（2025-12-01 01:39）
**問題**: `Failed to subscribe to channel: [object Object]`

**原因**: `subscribe()`メソッドがcallbackパターンだが、`await`で使用していた

**修正**: Promiseでラップして非同期処理に対応
```typescript
const subscribePromise = new Promise<void>((resolve, reject) => {
  this.channel!.subscribe((status) => {
    if (status === 'SUBSCRIBED') resolve();
    else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') reject(...);
  });
});
await subscribePromise;
```

### 3. UUID形式の不一致（2025-12-01 01:46）
**問題**: `invalid input syntax for type uuid: "rv1d7s0"`

**原因**: ランダム7文字ID（`generateId()`）を使用していたが、PostgreSQLはUUID形式を要求

**修正**:
- Supabaseの`createSession()`で返されるUUIDを使用
- `sessionId`をuseRefからuseStateに変更
- `setSupabaseSessionId(sessionInfo.id)`で実際のUUIDを保存

### 4. 無限ループバグ（2025-12-01 01:53）
**問題**: コンソールに数秒で70万件のメッセージが出力

**原因**: useEffectの依存配列に`settings, smartCues, colorRanges`が含まれていたため、状態更新のたびに再初期化が発生

**修正**: 依存配列から削除
```typescript
// BEFORE
}, [role, syncMode, settings, smartCues, colorRanges, ...]);

// AFTER
}, [role, syncMode]); // 無限ループ防止
```

---

## 🔧 トラブルシューティング

### デプロイが失敗する
1. ビルドログを確認:
   ```bash
   vercel inspect [DEPLOYMENT_URL] --logs
   ```
2. ローカルでビルドテスト:
   ```bash
   npm run build
   ```

### 環境変数が反映されない
1. 環境変数を確認:
   ```bash
   vercel env ls
   ```
2. 環境変数を追加:
   ```bash
   vercel env add VARIABLE_NAME production
   ```
3. 再デプロイ:
   ```bash
   vercel --prod
   ```

### Supabase接続エラー
1. 環境変数が正しく設定されているか確認
2. Supabaseプロジェクトがアクティブか確認
3. ネットワーク接続を確認
4. ブラウザのコンソールでエラーログを確認

---

## 📈 デプロイ履歴

| 日時 | コミット | 修正内容 | ステータス |
|------|---------|----------|-----------|
| 2025-12-01 02:44 | f44bec9 | 日本語プリインストール音声対応（CLIENT自動音声有効化、デバッグログ追加） | ✅ Ready |
| 2025-12-01 01:53 | 7870187 | 無限ループバグ修正（useEffect依存配列最適化） | ✅ Ready |
| 2025-12-01 01:46 | 1976fe1 | UUID生成問題修正（ランダムID→Supabase UUID） | ✅ Ready |
| 2025-12-01 01:39 | d5d1e83 | WebSocket購読パターン修正（callback→Promise） | ✅ Ready |
| 2025-12-01 01:25 | b0be738 | 環境変数修正（改行文字%0A削除） | ✅ Ready |
| 2025-11-29 04:58 | 02f6a81 | 初回デプロイ（基本実装） | ✅ Ready |

---

## 🎯 次のステップ

1. **実機テスト**
   - PC + タブレット + スマホでクロスデバイス同期をテスト
   - 視覚的同期精度を測定
   - ネットワーク遅延を記録

2. **パフォーマンス最適化**
   - Core Web Vitals測定
   - バンドルサイズ削減
   - 画像・アセット最適化

3. **カスタムドメイン設定**（オプション）
   ```bash
   vercel domains add your-domain.com
   ```

4. **モニタリング設定**
   - Vercel Analytics有効化
   - エラートラッキング設定

---

## 📚 関連ドキュメント

- [QUICKSTART.md](./QUICKSTART.md) - クイックスタートガイド
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - 詳細テスト手順
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - 実装サマリー
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)

---

**最終更新**: 2025-12-01 02:44 JST
**デプロイ担当**: Claude (Sonnet 4.5)
**ステータス**: ✅ Production Ready（日本語音声対応完了）
**最新修正**: CLIENT側日本語プリインストール音声自動再生、詳細デバッグログ追加
