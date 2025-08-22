# シークレットローテーション運用手順書

## 概要

本ドキュメントは、AutoEditTATEプロジェクトにおけるGitHub Secretsのローテーション手順を定めたものです。
セキュリティ維持のため、定期的なシークレットのローテーションと、漏洩時の緊急対応手順を記載しています。

## 対象シークレット一覧

| シークレット名 | 用途 | ローテーション頻度 | 重要度 |
|--------------|------|------------------|--------|
| `LLM_API_KEY` | LLM API認証用 | 3ヶ月ごと | 高 |
| `ANTHROPIC_API_KEY` | Claude API認証用 | 3ヶ月ごと | 高 |
| `GEMINI_API_KEY` | Gemini API認証用 | 3ヶ月ごと | 高 |
| `DATABASE_URL` | データベース接続 | 6ヶ月ごと | 高 |
| `REDIS_URL` | Redis接続 | 6ヶ月ごと | 中 |
| `SLACK_WEBHOOK_URL` | 通知用 | 12ヶ月ごと | 低 |

## 定期ローテーション手順

### 1. LLM_API_KEY のローテーション

#### CLI による方法（推奨）

```bash
# 1. 新しいAPIキーを環境変数に設定（一時的）
read -s -p "Enter new LLM_API_KEY: " LLM_API_KEY && echo

# 2. GitHub Secretsを更新
gh secret set LLM_API_KEY \
  --body "$LLM_API_KEY" \
  --repo ShoheiFukushima/AutoEditTATE

# 3. 環境変数をクリア（セキュリティ対策）
unset LLM_API_KEY

# 4. 更新を確認
gh secret list --repo ShoheiFukushima/AutoEditTATE | grep LLM_API_KEY
```

#### GUI による方法

1. GitHubリポジトリページを開く
2. Settings → Secrets and variables → Actions
3. `LLM_API_KEY` の横の更新ボタンをクリック
4. 新しい値を入力して "Update secret" をクリック

### 2. 複数シークレットの一括更新

```bash
#!/bin/bash
# batch-rotate-secrets.sh

echo "=== Batch Secret Rotation ==="

# 各シークレットを順番に更新
for SECRET_NAME in LLM_API_KEY ANTHROPIC_API_KEY GEMINI_API_KEY; do
  echo "Updating $SECRET_NAME..."
  read -s -p "Enter new value for $SECRET_NAME: " SECRET_VALUE && echo
  
  gh secret set "$SECRET_NAME" \
    --body "$SECRET_VALUE" \
    --repo ShoheiFukushima/AutoEditTATE
  
  unset SECRET_VALUE
  echo "✓ $SECRET_NAME updated"
done

echo "=== All secrets updated successfully ==="
```

## 検証手順

### 1. ワークフローによる検証

```bash
# 特定のワークフローを手動実行
gh workflow run test-secrets.yml \
  --repo ShoheiFukushima/AutoEditTATE

# 実行状況を確認
gh run list \
  --repo ShoheiFukushima/AutoEditTATE \
  --workflow test-secrets.yml \
  --limit 1

# ログを確認（401/403エラーがないことを確認）
gh run view <RUN_ID> \
  --repo ShoheiFukushima/AutoEditTATE \
  --log
```

### 2. 空コミットによる検証

```bash
# テスト用の空コミットを作成
git commit --allow-empty -m "ci: verify secret rotation"
git push origin feature/test-secrets

# PRを作成して自動チェックを実行
gh pr create \
  --title "test: verify secret rotation" \
  --body "Testing secret rotation" \
  --repo ShoheiFukushima/AutoEditTATE
```

## 緊急時対応（シークレット漏洩時）

### 即座に実施すべき事項

1. **漏洩したシークレットの無効化**
   ```bash
   # 即座に空の値で上書き（一時的な無効化）
   gh secret set COMPROMISED_SECRET \
     --body "REVOKED" \
     --repo ShoheiFukushima/AutoEditTATE
   ```

2. **新しいシークレットの生成と設定**
   - 各サービスのダッシュボードで新しいAPIキーを生成
   - 上記の通常手順に従って更新

3. **監査ログの確認**
   ```bash
   # 最近のワークフロー実行を確認
   gh run list \
     --repo ShoheiFukushima/AutoEditTATE \
     --limit 50 \
     --json conclusion,createdAt,displayTitle \
     --jq '.[] | select(.conclusion == "failure")'
   ```

4. **影響範囲の調査**
   - CloudTrail/監査ログで不正使用を確認
   - 影響を受けた可能性のあるシステムの特定

## ローテーションスケジュール管理

### 自動リマインダーの設定

GitHub Actionsで定期的にリマインダーを送信：

```yaml
# .github/workflows/secret-rotation-reminder.yml
name: Secret Rotation Reminder

on:
  schedule:
    # 毎月1日 9:00 UTC に実行
    - cron: '0 9 1 * *'

jobs:
  check-rotation:
    runs-on: ubuntu-latest
    steps:
      - name: Check rotation dates
        run: |
          # 最終更新から90日経過したシークレットを検出
          echo "::warning::Check if secrets need rotation"
          
      - name: Send notification
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🔐 Monthly Secret Rotation Check',
              body: 'Please review and rotate secrets if needed.',
              labels: ['security', 'maintenance']
            })
```

## ベストプラクティス

### DO ✅

1. **定期的なローテーション**
   - スケジュールに従って確実に実施
   - ローテーション実施記録を残す

2. **最小権限の原則**
   - 各APIキーは必要最小限の権限のみ付与
   - 読み取り専用と書き込み可能を分離

3. **監査証跡の保持**
   - いつ、誰が、どのシークレットを更新したか記録
   - GitHub Secretsの更新履歴を定期的に確認

4. **テスト環境での検証**
   - 本番環境更新前にステージング環境で検証
   - 自動テストで新しいシークレットの動作確認

### DON'T ❌

1. **平文での保存・送信**
   - Slackやメールでシークレットを送らない
   - コミットメッセージに含めない
   - ログに出力しない

2. **共有アカウントの使用**
   - 個人のAPIキーを共有しない
   - サービスアカウントを適切に分離

3. **古いシークレットの放置**
   - 使用していないシークレットは削除
   - ローテーション後の旧キーは速やかに無効化

## トラブルシューティング

### 問題: ワークフローが401/403エラーで失敗

**原因**: シークレットが正しく設定されていない、または期限切れ

**解決策**:
```bash
# 1. シークレットの存在確認
gh secret list --repo ShoheiFukushima/AutoEditTATE

# 2. 新しい値で更新
gh secret set PROBLEMATIC_SECRET --body "new-value"

# 3. ワークフローを再実行
gh workflow run <workflow-name>.yml
```

### 問題: シークレットが環境変数に反映されない

**原因**: GitHub Actionsのキャッシュ問題

**解決策**:
```bash
# キャッシュをクリアして再実行
gh api -X DELETE /repos/ShoheiFukushima/AutoEditTATE/actions/caches
```

## 記録様式

### ローテーション実施記録テンプレート

```markdown
## Secret Rotation Record - [DATE]

**実施者**: [Name]
**実施日時**: YYYY-MM-DD HH:MM JST

### ローテーション対象
- [ ] LLM_API_KEY
- [ ] ANTHROPIC_API_KEY
- [ ] GEMINI_API_KEY
- [ ] その他: ___________

### 検証結果
- [ ] CI/CDパイプライン: Pass / Fail
- [ ] 自動テスト: Pass / Fail
- [ ] 手動確認: Pass / Fail

### 備考
[Any notes or issues encountered]

### 次回予定日
YYYY-MM-DD
```

## 関連ドキュメント

- [GitHub Secrets公式ドキュメント](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [セキュリティポリシー](../SECURITY-POLICY.md)
- [CI/CD運用ガイド](../CI-CD-OPERATIONS.md)

---

最終更新: 2025-08-22
バージョン: 1.0.0