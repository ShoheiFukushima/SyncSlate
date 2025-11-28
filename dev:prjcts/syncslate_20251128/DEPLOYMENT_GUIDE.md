# 🚀 SyncSlate AI - Vercelデプロイメントガイド

## 📋 前提条件

- Vercelアカウント（無料プランでOK）
- GitHubリポジトリ（推奨）
- 環境変数の準備

## 🔧 環境変数の設定

Vercelダッシュボードで以下の環境変数を設定：

### 必須環境変数

```bash
# Gemini API（音声合成用）
VITE_GEMINI_API_KEY=your_gemini_api_key

# Clerk認証（HOSTモードのみ使用）
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# WebSocket URL（オプション：異デバイス同期用）
VITE_WEBSOCKET_URL=wss://your-websocket-server.com
```

### ⚠️ 重要な注意事項

- **CLIENT MODEは環境変数不要** - 完全無料で動作
- Clerk認証はHOSTモードのみで使用
- WebSocket URLは設定しなくても動作（BroadcastChannelフォールバック）

## 📦 デプロイ方法

### 方法1: Vercel CLI（推奨）

```bash
# Vercel CLIをインストール
npm i -g vercel

# プロジェクトディレクトリで実行
vercel

# プロダクションデプロイ
vercel --prod
```

### 方法2: GitHub統合

1. GitHubにプッシュ
```bash
git add .
git commit -m "feat: Deploy SyncSlate AI to Vercel"
git push origin main
```

2. Vercelダッシュボードで「Import Project」
3. GitHubリポジトリを選択
4. 環境変数を設定
5. 「Deploy」をクリック

### 方法3: 手動デプロイ

```bash
# ビルド
npm run build

# distフォルダをVercelにドラッグ&ドロップ
```

## 🔍 デプロイ後の確認

### URLパターン

```bash
# HOSTモード（デフォルト）
https://your-app.vercel.app/

# CLIENTモード（認証不要）
https://your-app.vercel.app/?role=client&session=abc123
```

### 動作確認チェックリスト

- [ ] HOSTモードでアクセス可能
- [ ] Share SessionでURLコピー可能
- [ ] CLIENTモードで認証画面が表示されない
- [ ] カウントダウンが同期する
- [ ] 音声が再生される

## 🌍 カスタムドメイン設定

1. Vercelダッシュボードで「Settings」→「Domains」
2. カスタムドメインを追加
3. DNSレコードを設定

例：
```
syncslate.example.com → CNAME → cname.vercel-dns.com
```

## 📊 パフォーマンス最適化

### Edge Functions設定

```javascript
// api/sync.ts (オプション)
export const config = {
  runtime: 'edge',
  regions: ['hnd1'], // 東京リージョン
};
```

### キャッシュ設定

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## 🔒 セキュリティ設定

### 環境変数の保護

- Vercelダッシュボードで「Sensitive」としてマーク
- プレビューデプロイには含めない設定

### CORS設定（必要な場合）

```javascript
// vercel.json に追加
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://your-domain.com"
        }
      ]
    }
  ]
}
```

## 📈 モニタリング

### Vercel Analytics

- 自動的に有効化
- リアルタイムのパフォーマンス分析
- Web Vitalsの監視

### ログの確認

```bash
# Vercel CLIでログを確認
vercel logs

# 特定のデプロイのログ
vercel logs [deployment-url]
```

## 🆘 トラブルシューティング

### ビルドエラーの場合

```bash
# ローカルでビルド確認
npm run build

# 依存関係の確認
npm install --legacy-peer-deps
```

### 環境変数が反映されない

1. Vercelダッシュボードで確認
2. 再デプロイを実行
```bash
vercel --prod --force
```

### CLIENTモードが認証を要求する

- URLパラメータが正しいか確認
- `?role=client` または `?session=xxx` が含まれているか

## 📝 デプロイメントスクリプト

package.jsonに追加：

```json
{
  "scripts": {
    "deploy": "vercel",
    "deploy:prod": "vercel --prod",
    "deploy:preview": "vercel --no-prod"
  }
}
```

## ✅ 最終チェックリスト

- [ ] 環境変数設定完了
- [ ] ビルド成功確認
- [ ] HOSTモード動作確認
- [ ] CLIENTモード無料アクセス確認
- [ ] 同期機能動作確認
- [ ] 音声再生確認
- [ ] エラーログなし

## 🎉 デプロイ完了！

デプロイが成功したら、以下のURLでアクセス可能：

- **プロダクション**: `https://[your-project].vercel.app`
- **プレビュー**: `https://[your-project]-[branch]-[username].vercel.app`

---

**注意**: CLIENTモードは永久に無料・ログイン不要を維持してください。