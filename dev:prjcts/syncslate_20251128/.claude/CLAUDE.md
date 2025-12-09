# SyncSlate - プロジェクト固有設定

## デプロイ情報

### Vercelプロジェクト
- **プロジェクト名**: syncslate_20251128
- **Organization**: syou430-1042s-projects
- **プロジェクトID**: prj_iDn7rhHrJ4B87Rqa1YMywpVEW7BC

### デプロイ先URL
- **Vercelダッシュボード**: https://vercel.com/syou430-1042s-projects/syncslate_20251128
- **最新デプロイURL**: 各デプロイごとに変わるため、`vercel ls`コマンドで確認

### デプロイコマンド
```bash
# 本番環境に手動デプロイ
vercel --prod --yes

# デプロイ一覧を確認
vercel ls

# デプロイログを確認
vercel logs [deployment-url]
```

### GitHubリポジトリ
- **リポジトリURL**: https://github.com/ShoheiFukushima/SyncSlate.git
- **ブランチ**: main

### 自動デプロイ
- GitHubの`main`ブランチへのpushで自動デプロイがトリガーされる
- 自動デプロイが動作しない場合は、上記の手動デプロイコマンドを使用

## 環境変数

以下の環境変数がVercelに設定されている必要があります：

- `GEMINI_API_KEY` - Gemini API キー
- `VITE_SUPABASE_URL` - Supabase プロジェクトURL（オプション）
- `VITE_SUPABASE_ANON_KEY` - Supabase 匿名キー（オプション）

## プロジェクト構造

### 主要ファイル
- `index.tsx` - メインアプリケーションコンポーネント
- `gemini-api.ts` - オーディオエンジンとGemini API統合
- `services/supabase-sync-engine.ts` - Supabase Realtime同期
- `services/audio-sync.ts` - AudioContext時刻同期
- `types/sync.ts` - 型定義

### ドキュメント
- `.serena/memories/syncslate_architecture.md` - アーキテクチャドキュメント
- `HOST_CLIENT_ARCHITECTURE.md` - HOST/CLIENT モード詳細
- `PRECISION_SYNC_ARCHITECTURE.md` - 同期機構詳細

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview

# テスト
npm run test
```

## 注意事項

### UIレイアウト
- すべてのセクション（スライダーを含む）に`max-w-4xl mx-auto`を適用
- スライダー自体は各セクション内で`w-full`で幅いっぱいに表示
- PC版でフルスクリーン表示時も適切なサイズで中央配置

### 同期性能
- このサービスは同期が絶対重要
- オーディオ再生の精度とタイミングを最優先
- エラーハンドリングは透明性を保ち、ユーザーに明確にフィードバック
