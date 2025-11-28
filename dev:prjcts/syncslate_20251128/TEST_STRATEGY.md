# SyncSlate AI テスト戦略

## 🎯 テスト戦略の目的
本テスト戦略は、SyncSlate AIアプリケーションの品質保証を目的として、仕様駆動開発（Specification-Driven Development）の原則に基づいて策定されました。

## 📊 テストピラミッド

```
        E2E Tests (10%)
       /            \
      /  Integration  \
     /   Tests (30%)   \
    /                   \
   /   Unit Tests (60%)  \
  /_______________________\
```

## 🧪 テストレベル定義

### 1. 単体テスト（Unit Tests）

#### 対象コンポーネント
- **ユーティリティ関数**
  - `generateId()` - ID生成ロジック
  - `getContrastColor()` - コントラスト色計算
  - `hexToRgba()` - 色変換ロジック
  - 時間計算関数
  - フォーマット関数

- **React コンポーネント**
  - 各UIコンポーネントの独立した振る舞い
  - Props の検証
  - 状態管理ロジック
  - イベントハンドラー

- **ビジネスロジック**
  - タイマーロジック
  - 同期プロトコルロジック
  - 言語検出ロジック

#### テストフレームワーク
```json
{
  "test": "jest",
  "ui-test": "@testing-library/react",
  "assertions": "chai/expect"
}
```

#### カバレッジ目標
- 全体: 80%以上
- クリティカルパス: 95%以上

### 2. 統合テスト（Integration Tests）

#### 対象機能
- **BroadcastChannel 同期**
  - ホスト-クライアント間のメッセージング
  - 状態同期の正確性
  - タイミング同期の精度

- **Gemini API 統合**
  - API呼び出しの成功/失敗
  - 音声データの生成と再生
  - エラーハンドリング

- **状態管理**
  - モード遷移（SETUP → ARMED → COUNTDOWN → ENDED）
  - 設定の永続化と復元
  - 複数コンポーネント間の状態共有

#### モックとスタブ戦略
```javascript
// Gemini API モック例
const mockGeminiAPI = {
  generateAudio: jest.fn().mockResolvedValue({
    audioData: 'base64_encoded_audio',
    duration: 1000
  })
};

// BroadcastChannel モック例
const mockChannel = {
  postMessage: jest.fn(),
  addEventListener: jest.fn(),
  close: jest.fn()
};
```

### 3. E2Eテスト（End-to-End Tests）

#### テストシナリオ

##### シナリオ1: 基本的な使用フロー
```gherkin
Feature: 基本的なスレート操作
  Scenario: ホストがスレートを開始する
    Given ホストがアプリケーションを開いている
    When Duration を "60" 秒に設定
    And Pre-roll を "5" 秒に設定
    And "START SLATE" をクリック
    Then カウントダウンが開始される
    And 5秒のPre-rollの後、メインカウントが始まる
```

##### シナリオ2: ゲスト同期
```gherkin
Feature: ゲストモード同期
  Scenario: ゲストがホストに同期する
    Given ホストがスレートを開始している
    When ゲストが共有リンクを開く
    Then "WAITING FOR HOST" が表示される
    When ホストが "START SLATE" をクリック
    Then ゲスト画面も同時にカウントダウンを開始する
```

##### シナリオ3: AI音声合成
```gherkin
Feature: AI音声合成機能
  Scenario: カスタム音声キューの生成
    Given ホストがSmart Cuesを設定している
    When "Load AI Voices" をクリック
    Then Gemini APIが呼び出される
    And 音声ファイルが生成される
    When スレートを開始する
    Then 指定タイミングで音声が再生される
```

#### E2Eテストツール
- **Playwright** または **Cypress**
- ビジュアルリグレッションテスト: **Percy**

## 🔍 テストケース詳細

### 同期機能テストケース

```typescript
// test/sync.test.ts
describe('BroadcastChannel Synchronization', () => {
  test('ホストが開始コマンドを送信する', async () => {
    // Arrange
    const channel = new BroadcastChannel('sync-slate-v1');
    const listener = jest.fn();

    // Act
    channel.addEventListener('message', listener);
    const startTime = Date.now() + 500;
    channel.postMessage({
      type: 'CMD_START',
      payload: { startTime }
    });

    // Assert
    await waitFor(() => {
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'CMD_START',
            payload: expect.objectContaining({ startTime })
          })
        })
      );
    });
  });

  test('クライアントが同期状態を受信する', async () => {
    // テストケース実装
  });

  test('レイテンシバッファが適用される', async () => {
    // 500msのバッファ検証
  });
});
```

### AI音声合成テストケース

```typescript
// test/gemini.test.ts
describe('Gemini AI Voice Synthesis', () => {
  test('テキストから音声を生成する', async () => {
    // Arrange
    const mockAPI = createMockGeminiAPI();
    const text = 'Action';

    // Act
    const audio = await generateVoice(text, 'en');

    // Assert
    expect(audio).toBeDefined();
    expect(audio.duration).toBeGreaterThan(0);
  });

  test('多言語対応の検証', async () => {
    const languages = ['en', 'jp', 'fr', 'de', 'es', 'ko'];
    for (const lang of languages) {
      const audio = await generateVoice('Test', lang);
      expect(audio).toBeDefined();
    }
  });

  test('APIエラーのハンドリング', async () => {
    // エラーケースの検証
  });
});
```

## 📈 パフォーマンステスト

### 測定項目
- **同期レイテンシ**: < 50ms
- **初回ロード時間**: < 3秒
- **音声生成時間**: < 2秒/キュー
- **メモリ使用量**: < 100MB
- **CPU使用率**: < 30%（アイドル時）

### パフォーマンス測定コード
```javascript
// performance/sync-latency.test.js
test('同期レイテンシが50ms以内', async () => {
  const hostTime = Date.now();
  const clientReceiveTime = await simulateClientReceive();
  const latency = clientReceiveTime - hostTime;

  expect(latency).toBeLessThan(50);
});
```

## 🛡️ セキュリティテスト

### テスト項目
- [ ] XSS脆弱性のチェック
- [ ] APIキー漏洩のチェック
- [ ] 入力値検証
- [ ] CSRFトークン検証
- [ ] セキュアな通信（HTTPS）

## ♿ アクセシビリティテスト

### 自動テスト
```javascript
// a11y.test.js
import { axe } from '@axe-core/react';

test('アクセシビリティ違反がない', async () => {
  const { container } = render(<App />);
  const results = await axe(container);
  expect(results.violations).toHaveLength(0);
});
```

### 手動テスト項目
- [ ] キーボードナビゲーション
- [ ] スクリーンリーダー対応
- [ ] 色覚多様性への配慮
- [ ] フォーカス管理

## 🔄 継続的インテグレーション（CI）

### CI パイプライン
```yaml
name: Test Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm run test:unit
      - name: Run integration tests
        run: npm run test:integration
      - name: Run E2E tests
        run: npm run test:e2e
      - name: Generate coverage report
        run: npm run coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## 📝 テストデータ管理

### テストフィクスチャ
```
test/
├── fixtures/
│   ├── settings.json      # 設定データ
│   ├── smartCues.json     # Smart Cuesデータ
│   ├── colorRanges.json   # Color Rangesデータ
│   └── audio/            # テスト用音声ファイル
```

### モックサーバー
```javascript
// test/mock-server.js
import { createServer } from 'miragejs';

export function makeServer() {
  return createServer({
    routes() {
      this.post('/api/gemini/generate', () => ({
        audio: 'base64_audio_data',
        duration: 1000
      }));
    }
  });
}
```

## 🚀 テスト実行コマンド

```bash
# 単体テスト
npm run test:unit

# 統合テスト
npm run test:integration

# E2Eテスト
npm run test:e2e

# 全テスト実行
npm test

# カバレッジレポート生成
npm run test:coverage

# ウォッチモード
npm run test:watch
```

## 📊 品質メトリクス

### 目標値
- テストカバレッジ: 80%以上
- バグ密度: < 1 bug/KLOC
- テスト成功率: 98%以上
- ビルド時間: < 5分
- デプロイ頻度: 週2回以上

## 🎓 テストベストプラクティス

1. **AAA パターンの使用**
   - Arrange: テストデータの準備
   - Act: テスト対象の実行
   - Assert: 結果の検証

2. **テストの独立性**
   - 各テストは他のテストに依存しない
   - テスト順序に関わらず成功する

3. **明確なテスト名**
   - 何をテストしているか明確に記述
   - 日本語での記述も可

4. **DRY原則の適用**
   - 共通のセットアップはbeforeEachで
   - ヘルパー関数の活用

5. **モックの適切な使用**
   - 外部依存はモック化
   - 過度なモックは避ける

## 次のステップ

1. テストフレームワークのセットアップ（Jest + React Testing Library）
2. 基本的な単体テストの実装
3. CI/CDパイプラインの構築
4. E2Eテストの実装
5. パフォーマンステストの自動化