# CI/CD トラブルシューティングガイド

## 概要

本ドキュメントは、AutoEditTATEプロジェクトのCI/CDパイプラインで発生する一般的な問題と、その解決方法を体系的にまとめたものです。

## よくある問題と解決策

### 🔴 ビルドエラー

#### 問題: `npm install` が失敗する

**症状**:
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**原因**: 依存関係の競合またはpackage-lock.jsonの不整合

**解決策**:
```bash
# 1. キャッシュをクリア
npm cache clean --force

# 2. node_modulesとpackage-lock.jsonを削除
rm -rf node_modules package-lock.json

# 3. 再インストール
npm install

# 4. CIでの対処（workflow内）
- name: Clear npm cache
  run: npm cache clean --force
  
- name: Install dependencies
  run: npm ci --prefer-offline --no-audit
```

#### 問題: TypeScriptコンパイルエラー

**症状**:
```
error TS2322: Type 'string' is not assignable to type 'number'
```

**解決策**:
```bash
# ローカルで型チェック
npm run typecheck

# 型定義の更新
npm install --save-dev @types/node@latest

# tsconfig.jsonの確認
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true
  }
}
```

### 🟡 テストの失敗

#### 問題: テストがタイムアウトする

**症状**:
```
Timeout - Async callback was not invoked within the 5000ms timeout
```

**解決策**:
```javascript
// テストファイルでタイムアウトを延長
jest.setTimeout(30000);

// または個別のテストで設定
test('long running test', async () => {
  // test code
}, 30000);

// CI環境変数で調整
env:
  JEST_TIMEOUT: 30000
```

#### 問題: ランダムにテストが失敗する（Flaky Tests）

**原因**: 非同期処理の競合状態、外部依存

**解決策**:
```javascript
// 1. 適切なwaitを追加
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});

// 2. モックの使用
jest.mock('axios');

// 3. リトライの設定
// jest.config.js
module.exports = {
  testRetries: 2
};
```

### 🔵 GitHub Actions エラー

#### 問題: ワークフローが起動しない

**確認コマンド**:
```bash
# ワークフローの構文チェック
gh workflow view <workflow-name>

# 最近の実行を確認
gh run list --workflow=<workflow-name>

# YAMLの検証
yamllint .github/workflows/*.yml
```

**一般的な原因と解決策**:

1. **YAMLシンタックスエラー**
   ```yaml
   # ❌ 間違い
   on:
     push:
       branches: [main]  # インデントが不正
   
   # ✅ 正しい
   on:
     push:
       branches: [main]
   ```

2. **トリガー条件の誤り**
   ```yaml
   # パスフィルターの確認
   on:
     push:
       paths:
         - 'src/**'
         - 'tests/**'
         - '!docs/**'  # docsは除外
   ```

#### 問題: Secrets が認識されない

**症状**:
```
Error: Input required and not supplied: api-key
```

**解決策**:
```bash
# 1. シークレットの存在確認
gh secret list

# 2. シークレットの設定
gh secret set API_KEY

# 3. ワークフローでの参照
env:
  API_KEY: ${{ secrets.API_KEY }}
```

### 🟢 デプロイメントの問題

#### 問題: アーティファクトのアップロード失敗

**症状**:
```
Error: Failed to upload artifact
```

**解決策**:
```yaml
# サイズ制限の確認（GitHubは2GBまで）
- name: Check artifact size
  run: du -sh dist/

# 圧縮して送信
- name: Compress artifacts
  run: tar -czf artifacts.tar.gz dist/

- name: Upload artifacts
  uses: actions/upload-artifact@v3
  with:
    name: build-artifacts
    path: artifacts.tar.gz
    retention-days: 7
```

## デバッグ手法

### 1. ワークフローのデバッグモード有効化

```yaml
# .github/workflows/debug.yml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true

jobs:
  debug:
    runs-on: ubuntu-latest
    steps:
      - name: Debug Environment
        run: |
          echo "Event: ${{ toJSON(github.event) }}"
          echo "Context: ${{ toJSON(github) }}"
          env
```

### 2. SSH デバッグセッション

```yaml
# tmate を使用したデバッグ
- name: Setup tmate session
  if: ${{ failure() }}
  uses: mxschmitt/action-tmate@v3
  with:
    limit-access-to-actor: true
```

### 3. ローカルでの Actions 実行

```bash
# act を使用してローカル実行
brew install act

# ワークフローの実行
act push -W .github/workflows/test.yml

# 特定のジョブを実行
act -j test-job
```

## パフォーマンス最適化

### キャッシュの活用

```yaml
# 依存関係のキャッシュ
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

# ビルド成果物のキャッシュ
- name: Cache build
  uses: actions/cache@v3
  with:
    path: dist
    key: ${{ runner.os }}-build-${{ github.sha }}
```

### 並列実行の最適化

```yaml
strategy:
  matrix:
    node-version: [16, 18, 20]
    os: [ubuntu-latest, macos-latest]
  max-parallel: 4
  fail-fast: false  # 1つ失敗しても他は継続
```

## モニタリングとアラート

### ワークフロー実行時間の監視

```bash
# 実行時間の統計を取得
gh api /repos/ShoheiFukushima/AutoEditTATE/actions/runs \
  --jq '[.workflow_runs[] | {
    name: .name,
    duration: .run_duration_ms,
    status: .status,
    conclusion: .conclusion
  }]'
```

### 失敗通知の設定

```yaml
# Slack通知
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'CI/CD Pipeline Failed!'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 緊急対応手順

### 1. CI/CD完全停止時

```bash
# 1. 最新の成功コミットを特定
git log --oneline --grep="ci" -10

# 2. 問題のあるコミットをリバート
git revert <commit-hash>

# 3. 緊急プッシュ（管理者権限必要）
git push origin main --force-with-lease
```

### 2. 全ワークフロー無効化

```bash
# すべてのワークフローを一時停止
for workflow in $(gh workflow list --json name -q '.[].name'); do
  gh workflow disable "$workflow"
done

# 問題解決後、再有効化
for workflow in $(gh workflow list --json name -q '.[].name'); do
  gh workflow enable "$workflow"
done
```

## チェックリスト

### 新しいワークフロー追加時

- [ ] YAML構文の検証完了
- [ ] 必要なSecretsの設定確認
- [ ] ブランチ保護ルールとの整合性確認
- [ ] タイムアウト設定の追加
- [ ] エラー時の通知設定
- [ ] ドキュメントの更新

### デバッグ開始前

- [ ] 最新のログを確認
- [ ] ローカルで再現を試みる
- [ ] 関連するIssueやPRを確認
- [ ] 最近の変更を確認
- [ ] 外部サービスの状態確認

## よく使うコマンド集

```bash
# ワークフロー関連
gh workflow list                           # ワークフロー一覧
gh workflow view <name>                    # 詳細表示
gh workflow run <name>                     # 手動実行
gh workflow disable/enable <name>          # 有効/無効化

# 実行履歴
gh run list --workflow=<name>             # 実行一覧
gh run view <id>                          # 詳細表示
gh run cancel <id>                        # キャンセル
gh run rerun <id>                         # 再実行
gh run download <id>                      # アーティファクトDL

# ログ確認
gh run view <id> --log                    # ログ表示
gh run view <id> --log-failed             # 失敗ログのみ

# デバッグ
gh api /repos/:owner/:repo/actions/runs   # API直接呼び出し
```

## 関連リソース

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Status](https://www.githubstatus.com/)
- [Action Marketplace](https://github.com/marketplace?type=actions)
- [CI/CD運用ガイド](./CI-CD-OPERATIONS.md)

---

最終更新: 2025-08-22
バージョン: 1.0.0