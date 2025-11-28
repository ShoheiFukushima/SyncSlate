# SyncSlate AI クイックスタートガイド

## ✅ 完了した準備

1. **GEMINI APIキー設定済み** ✅
   - `.env.local`にAPIキーを設定しました

2. **SaaS Platform Core統合計画作成済み** ✅
   - `SAAS_INTEGRATION_PLAN.md` - 詳細な統合計画
   - `.env.platform` - Platform Core統合用環境変数テンプレート

## 🚀 今すぐ実行できること

### 1. アプリケーションの起動と動作確認

```bash
# 開発サーバー起動
./node_modules/.bin/vite dev

# ブラウザで開く
open http://localhost:3000
```

### 2. Gemini API動作テスト

現在のコード（`index.tsx`）にはGemini APIの統合コードがありますが、実際のAPI呼び出しが実装されているか確認が必要です。

#### テスト用コード追加（必要な場合）
```typescript
// Gemini API テスト関数
async function testGeminiAPI() {
  const API_KEY = process.env.GEMINI_API_KEY;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "Say 'Action' in a director's voice"
            }]
          }]
        })
      }
    );

    const data = await response.json();
    console.log('Gemini API Test Success:', data);
    return data;
  } catch (error) {
    console.error('Gemini API Test Failed:', error);
    throw error;
  }
}
```

### 3. 基本機能の確認チェックリスト

- [ ] **ホストモード**
  - [ ] Duration設定が動作する
  - [ ] Pre-roll設定が動作する
  - [ ] START SLATEボタンでカウントダウン開始
  - [ ] 背景色が時間に応じて変化する

- [ ] **同期機能**（同一ブラウザ内）
  - [ ] 新しいタブを開く
  - [ ] Share Linkボタンで URL をコピー
  - [ ] 両タブでカウントダウンが同期する

- [ ] **AI音声機能**
  - [ ] Load AI Voicesボタンをクリック
  - [ ] Gemini APIが呼び出される（DevToolsで確認）
  - [ ] エラーが出ないことを確認

## 🔧 トラブルシューティング

### よくある問題と解決策

#### 1. vite: command not found
```bash
# 直接実行
./node_modules/.bin/vite dev

# または npm scripts を修正
npm run dev
```

#### 2. Gemini API エラー
```javascript
// APIキーが正しく読み込まれているか確認
console.log('API Key exists:', !!process.env.GEMINI_API_KEY);

// vite.config.ts の設定確認
// process.env.GEMINI_API_KEY が定義されているか
```

#### 3. CORS エラー
```javascript
// 開発環境では vite.config.ts にプロキシ設定を追加
export default defineConfig({
  server: {
    proxy: {
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, '')
      }
    }
  }
});
```

## 📝 次のステップ優先順位

### 優先度 HIGH（今日〜明日）

1. **基本動作確認**
   ```bash
   npm run dev
   # ブラウザでUIを確認
   ```

2. **Gemini API統合確認**
   - 音声生成機能が実際に動作するか
   - APIレスポンスの処理

3. **テストフレームワークセットアップ**
   ```bash
   npm install --save-dev jest @testing-library/react @testing-library/jest-dom @types/jest
   ```

### 優先度 MEDIUM（今週中）

4. **Platform Core統合準備**
   - Clerk SDK インストール
   - APIクライアント実装開始

5. **基本的なテスト作成**
   - ユーティリティ関数のテスト
   - コンポーネントの単体テスト

### 優先度 LOW（来週以降）

6. **PWA対応**
7. **パフォーマンス最適化**
8. **デプロイメント設定**

## 📊 進捗状況サマリー

```yaml
プロジェクト状態:
  開発環境: ✅ 構築完了
  APIキー: ✅ 設定完了
  ビルド: ✅ 成功
  基本動作: ⏳ 確認中

統合準備:
  Platform Core計画: ✅ 作成済み
  環境変数テンプレート: ✅ 準備済み
  Clerk認証: ⏳ 未実装
  使用量管理: ⏳ 未実装

次のアクション:
  1. アプリ起動して動作確認
  2. Gemini API呼び出しテスト
  3. Platform Core統合の段階的実装
```

## 💡 推奨事項

1. **まず動作確認を優先**
   - Platform Core統合前に、基本機能が正しく動作することを確認

2. **段階的な統合**
   - すべてを一度に統合せず、認証→使用量管理→課金の順で実装

3. **フィーチャーフラグの活用**
   - `.env.platform`のフラグを使って、統合機能を段階的に有効化

---

**準備完了！** 開発サーバーを起動して、SyncSlate AIの動作を確認してください。

```bash
npm run dev
```