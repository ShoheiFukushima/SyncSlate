# SyncSlate AI テストガイド

## 📌 TDD（テスト駆動開発）アプローチ

このプロジェクトはTDD原則に従って開発されています。**実装前にテストを書く**ことで、仕様の明確化と品質保証を実現しています。

## 🎯 テストカテゴリと優先順位

### 1. 最重要テスト（必須100%カバレッジ）

#### CLIENT/HOSTモード判定
```bash
npm test -- useAppMode.test.ts
```
**重要性**: CLIENTモードの無料・ログイン不要を保証

#### 認証ゲート（AuthGate）
```bash
npm test -- AuthGate.test.tsx
```
**重要性**: CLIENTモードが認証を完全にスキップすることを保証

#### ATR（Absolute Time Reference）
```bash
npm test -- timeSync.test.ts
```
**重要性**: 50ms以内の同期を保証

### 2. 統合テスト

#### 同期機能（BroadcastChannel）
```bash
npm test -- syncService.test.ts
```
**重要性**: HOST/CLIENT間のリアルタイム通信を保証

### 3. E2Eシナリオテスト
```bash
npm test -- scenarios.test.ts
```
**重要性**: 実際のユーザーフローを検証

### 4. パフォーマンステスト
```bash
npm test -- performance.test.ts
```
**重要性**: 性能目標の達成を検証

## 🚀 テストの実行方法

### すべてのテストを実行
```bash
npm test
```

### ウォッチモードで開発
```bash
npm test -- --watch
```

### カバレッジレポート生成
```bash
npm test -- --coverage
```

### 特定のテストスイートのみ実行
```bash
# ユニットテストのみ
npm test -- --selectProjects="Unit Tests"

# E2Eテストのみ
npm test -- --selectProjects="E2E Tests"

# パフォーマンステストのみ
npm test -- --selectProjects="Performance Tests"
```

### デバッグモードで実行
```bash
npm test -- --detectOpenHandles --runInBand
```

## 📊 カバレッジ目標

| ファイル/機能 | 目標カバレッジ | 理由 |
|--------------|---------------|------|
| useAppMode.ts | 100% | CLIENT/HOST判定の要 |
| AuthGate.tsx | 100% | 認証スキップの保証 |
| timeSync.ts | 90% | 同期精度の保証 |
| syncService.ts | 80% | 通信の信頼性 |
| 全体 | 80% | 品質基準 |

## 🔴 Red-Green-Refactor サイクル

### 1. Red（失敗するテストを書く）
```typescript
// 例: CLIENTモードは認証不要
it('CLIENTモードでは認証チェックを完全にスキップする', () => {
  jest.spyOn(useAppModeModule, 'useAppMode').mockReturnValue('CLIENT');
  render(<AuthGate><TestContent /></AuthGate>);

  // まだ実装していないので失敗する
  expect(screen.getByText('Protected Content')).toBeInTheDocument();
  expect(SignedIn).not.toHaveBeenCalled();
});
```

### 2. Green（テストを通す最小限の実装）
```typescript
export function AuthGate({ children }: { children: React.ReactNode }) {
  const mode = useAppMode();

  // CLIENTモードは認証不要
  if (mode === 'CLIENT') {
    return <>{children}</>;
  }

  // HOSTモードは認証必須
  return (
    <SignedIn>{children}</SignedIn>
  );
}
```

### 3. Refactor（コードを改善）
```typescript
export function AuthGate({ children }: { children: React.ReactNode }) {
  const mode = useAppMode();

  // 早期リターンで可読性向上
  if (mode === 'CLIENT') {
    return <>{children}</>;
  }

  // HOSTモード用の認証ゲート
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
    </>
  );
}
```

## 🧪 テスト作成のベストプラクティス

### 1. AAAパターン
```typescript
it('should do something', () => {
  // Arrange（準備）
  const input = 'test';

  // Act（実行）
  const result = functionToTest(input);

  // Assert（検証）
  expect(result).toBe('expected');
});
```

### 2. 具体的なテスト名
```typescript
// ❌ 悪い例
it('works correctly', () => {});

// ✅ 良い例
it('CLIENTモードでsessionパラメータがある場合、認証をスキップする', () => {});
```

### 3. 独立したテスト
```typescript
// 各テストは独立して実行可能
beforeEach(() => {
  // 初期化
});

afterEach(() => {
  // クリーンアップ
});
```

## 🐛 テストデバッグのヒント

### コンソールログを使う
```typescript
it('debug test', () => {
  const result = someFunction();
  console.log('Result:', result);
  expect(result).toBeDefined();
});
```

### 特定のテストのみ実行
```typescript
// .only を使って一つのテストに集中
it.only('focus on this test', () => {});

// .skip で一時的にスキップ
it.skip('skip this test', () => {});
```

### デバッガーを使う
```typescript
it('debug with breakpoint', () => {
  debugger; // ブレークポイント
  const result = complexFunction();
  expect(result).toBe(expected);
});
```

## 📈 継続的改善

### テスト品質の指標
- **実行時間**: 全テスト5秒以内
- **フレーキーテスト**: 0件（100%安定）
- **カバレッジ**: 80%以上
- **テスト/コード比**: 1:1以上

### 定期レビュー
1. 週次：失敗したテストの分析
2. 月次：カバレッジレポートの確認
3. 四半期：テスト戦略の見直し

## 🔗 関連ドキュメント

- [README.md](README.md) - プロジェクト概要
- [TEST_STRATEGY.md](TEST_STRATEGY.md) - テスト戦略
- [COMPLETE_SPECIFICATION.md](COMPLETE_SPECIFICATION.md) - 完全仕様書

## 💡 トラブルシューティング

### テストが失敗する場合
```bash
# キャッシュをクリア
npm test -- --clearCache

# node_modulesを再インストール
rm -rf node_modules package-lock.json
npm install
```

### タイムアウトエラー
```typescript
// タイムアウトを延長
it('async test', async () => {
  // テスト内容
}, 30000); // 30秒
```

### モックが動作しない
```typescript
// モジュールパスを確認
jest.mock('../../src/hooks/useAppMode'); // 相対パス
jest.mock('@/hooks/useAppMode'); // エイリアス
```

---

**重要**: TDDは単なるテスト手法ではなく、設計手法です。テストを先に書くことで、使いやすいAPIと保守しやすいコードを実現します。