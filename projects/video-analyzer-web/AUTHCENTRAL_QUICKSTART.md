# AuthCentral 連携クイックスタート

## 🚨 重要：ローカル開発セットアップ

### 前提条件

AuthCentralとVideo-Ana **両方** のサーバーを起動する必要があります。

---

## ステップ1: AuthCentral起動

```bash
# ターミナル1: AuthCentral
cd /Users/fukushimashouhei/dev1/projects/auth-central
npm run dev:mock

# 起動確認
# → http://localhost:3900 で起動
```

**確認事項**:
- ✅ ポート3900で起動
- ✅ Mock modeで起動（`USE_MOCKS=true`）

---

## ステップ2: AuthCentralでVideo-Anaをアクティベート

```bash
# ブラウザで http://localhost:3900 を開く
# ログイン: test@f8.dev / password123
# /dashboard/services に移動
# 「Video-Ana」カードをドラッグ&ドロップでアクティベート
```

**確認事項**:
- ✅ Video-Anaカードが「Active Services」エリアに移動
- ✅ コンソールに「[POST Mock] Service added」ログ表示

---

## ステップ3: Video-Ana環境変数確認

`.env.local`が以下の設定になっているか確認：

```env
# AuthCentral設定 (ローカル開発用)
AUTHCENTRAL_URL=http://localhost:3900
AUTHCENTRAL_CLIENT_ID=video-ana
AUTHCENTRAL_JWKS_URL=http://localhost:3900/.well-known/jwks.json
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**⚠️ 注意**: `.env.local`は各自のローカル環境で設定してください（gitignoreされています）

---

## ステップ4: Video-Ana起動

```bash
# ターミナル2: Video-Ana
cd /Users/fukushimashouhei/dev1/projects/video-analyzer-web
npm run dev

# 起動確認
# → http://localhost:3000 で起動
```

---

## ステップ5: 認証フロー実行

```bash
# ブラウザで http://localhost:3000 を開く
# 「Login with AuthCentral」ボタンをクリック
# → AuthCentral (localhost:3900) にリダイレクト
# → ログイン画面で test@f8.dev / password123 を入力
# → Video-Ana (localhost:3000) にコールバック
# → ログイン成功！
```

---

## 期待される動作

### 1. OAuth Authorization URL

Video-Anaから以下のURLにリダイレクトされます：

```
http://localhost:3900/oauth/authorize?
  response_type=code
  &client_id=video-ana
  &redirect_uri=http://localhost:3000/api/auth/callback
  &scope=openid+profile+email+video:read+video:upload+video:process+offline_access
  &state=...
  &code_challenge=...
  &code_challenge_method=S256
```

**確認ポイント**:
- ✅ `http://localhost:3900` に接続（`https://dev-authcentral.f8.dev`ではない）
- ✅ `/oauth/authorize` エンドポイント（`/api/auth/oauth/authorize`ではない）
- ✅ `client_id=video-ana`（`video-analyzer-web`ではない）
- ✅ scopes に `openid`, `profile`, `email` が含まれる

### 2. Token Exchange

AuthCentralから認証コードを受け取った後、以下のエンドポイントでトークン交換：

```
POST http://localhost:3900/oauth/token
```

**確認ポイント**:
- ✅ Access Token取得成功
- ✅ Refresh Token取得成功（`offline_access` scope）
- ✅ ID Token取得成功

### 3. ログイン完了

- ✅ Video-Anaダッシュボードに遷移
- ✅ ユーザー情報表示（名前、メールアドレス）

---

## トラブルシューティング

### エラー: 「このサイトにアクセスできません」

**原因**: 存在しない本番環境URL（`https://dev-authcentral.f8.dev`）にアクセスしようとしている

**解決策**:
1. `.env.local`を確認
   ```env
   AUTHCENTRAL_URL=http://localhost:3900
   ```
2. Video-Anaサーバーを再起動
   ```bash
   # Ctrl+C で停止
   npm run dev
   ```

### エラー: 「Service not found」

**原因**: AuthCentralでVideo-Anaがアクティベートされていない

**解決策**:
1. AuthCentral（http://localhost:3900）にログイン
2. `/dashboard/services` に移動
3. Video-Anaカードをドラッグ&ドロップでアクティベート

### エラー: 「Invalid redirect_uri」

**原因**: Callback URLが許可されていない

**解決策**:
1. AuthCentral側のpredefined-services.tsを確認
   ```typescript
   redirect_uris: [
     'http://localhost:3000/auth/callback',
     'http://localhost:3000/api/auth/callback',  // ← 必要
   ],
   ```
2. AuthCentralサーバーを再起動

### エラー: 「Invalid scope」

**原因**: 要求したscopeが許可されていない

**確認事項**:
- Video-Ana `config.ts` の scopes
- AuthCentral predefined-services.ts の allowed_scopes
- 両者が一致しているか

**現在の正しいscopes**:
```
openid profile email video:read video:upload video:process offline_access
```

---

## 完了確認チェックリスト

- [ ] AuthCentralサーバー起動（http://localhost:3900）
- [ ] Video-Anaアクティベーション完了
- [ ] Video-Anaサーバー起動（http://localhost:3000）
- [ ] `.env.local` 設定確認
- [ ] OAuth Authorization成功
- [ ] Token Exchange成功
- [ ] ログイン完了、ダッシュボード表示

---

## 技術詳細

### 修正済み項目

#### AuthCentral側
- ✅ Redirect URI追加: `http://localhost:3000/api/auth/callback`
- ✅ Scope追加: `offline_access`

#### Video-Ana側
- ✅ OAuth endpoint paths修正: `/oauth/*` (was: `/api/auth/oauth/*`)
- ✅ デフォルトURL修正: `http://localhost:3900` (was: `https://auth.f8.dev`)
- ✅ Client ID修正: `video-ana` (was: `video-analyzer-web`)
- ✅ Scopes修正: AuthCentral定義に合わせて修正

### コミット履歴

**AuthCentral**:
- `1cad49b` - OAuth設定修正
- `9ef8610` - 統合ガイド作成
- `e5540a3` - ガイド更新（完了済み修正の文書化）

**Video-Ana**:
- `6b6adeb` - OAuth endpoints and scopes修正

---

## 次のステップ

1. ローカル開発環境で認証フロー動作確認
2. 動画アップロード機能実装
3. OCR処理パイプライン統合
4. 音声文字起こし機能実装

---

**Document Version**: 1.0
**Status**: Ready for Testing
**Last Updated**: 2025-10-08
