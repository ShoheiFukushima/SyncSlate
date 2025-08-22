# SECRETS ローテーション Runbook — LLM_API_KEY

目的
- リポジトリで使用する LLM_API_KEY（例: OpenAI 互換キー）を安全に登録・ローテーションし、登録後に自動レビューワークフローの動作を検証する手順をまとめます。
- 個人開発／小規模チームでの安全運用を想定しています。公開リポジトリや共有ログにキーが残らないように注意してください。

重要なファイル（参照）
- 登録スクリプト: [`scripts/rotate-llm-secret.sh`](scripts/rotate-llm-secret.sh:1)
- ローカル PR レビューツール: [`scripts/pr-review-runner.js`](scripts/pr-review-runner.js:1)
- redaction ユーティリティ: [`scripts/pr-review-utils.js`](scripts/pr-review-utils.js:1)
- ワークフロー（手動検証）: [`.github/workflows/llm-rotation-verify.yml`](.github/workflows/llm-rotation-verify.yml:1)
- ローカル実行サンプル: [`tmp/pr-event-local.json`](tmp/pr-event-local.json:1)
- ワークフロー出力アーティファクト名: `llm-rotation-verify-output`

前提（準備）
- GitHub CLI (`gh`) を利用する場合はローカルでログイン済みであること: `gh auth login`
- `gh` によりシークレットを登録する場合、操作権限があること
- ローカルでの検証は `node` / `npm` が利用できる環境で実行してください

安全にシークレットを登録する（推奨）
1. スクリプトを実行できるようにする（初回のみ）
   - `chmod +x scripts/rotate-llm-secret.sh`
2. プロンプトで入力して登録（最も安全）
   - `./scripts/rotate-llm-secret.sh --prompt --repo ShoheiFukushima/AutoEditTATE`
   - (スクリプトは標準入力でシークレットを受け取り、`gh secret set` を使ってリポジトリへ登録します。)
3. ファイルから登録したい場合（ファイルは安全に保管してから削除）
   - `./scripts/rotate-llm-secret.sh --file ./new_key.txt --repo ShoheiFukushima/AutoEditTATE`
4. 登録後に存在確認
   - `./scripts/rotate-llm-secret.sh --verify --repo ShoheiFukushima/AutoEditTATE`
5. 既存のシークレットを削除する場合
   - `./scripts/rotate-llm-secret.sh --remove --repo ShoheiFukushima/AutoEditTATE`

GUI での手動登録（代替）
- GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret
  - Name: `LLM_API_KEY`
  - Value: （API キーを貼り付け）
- GUI 登録ではキーのコピー／貼付に注意し、クリップボードの取り扱いに留意してください。

検証手順（ワークフロー）
- 手動で検証ワークフローを実行すると、`scripts/pr-review-runner.js` をローカルモードで実行し、出力ログをアーティファクトとして保存します。
- 実行方法（GitHub UI）
  - Actions → 「LLM Rotation Verification」 → Run workflow
  - 入力: `pr_number`（検証する PR 番号。既存 PR 例: 2）、`post_comment` = false（まずは投稿せずログのみを確認）
- 実行方法（CLI）
  - `gh workflow run llm-rotation-verify.yml -f pr_number=2 -f post_comment=false --repo ShoheiFukushima/AutoEditTATE`
- 実行後の確認（アーティファクト取得）
  - 実行一覧確認: `gh run list --repo ShoheiFukushima/AutoEditTATE --workflow llm-rotation-verify.yml --limit 10`
  - 実行ログ・アーティファクト取得:
    - `gh run view <run-id> --repo ShoheiFukushima/AutoEditTATE --log`
    - `gh run download <run-id> --repo ShoheiFukushima/AutoEditTATE --name llm-rotation-verify-output`
  - ダウンロードしたアーティファクト内に以下が含まれます（存在する場合）:
    - `pr-review-runner.stdout.txt` — ランナーの標準出力 / 標準エラー
    - `admin-guidance.txt` — 認証エラー（401/403 等）検出時に生成される運用ガイダンス

ログの解析ポイント（何を探すか）
- `LLM API returned non-OK` / `LLM API call failed` / `status 401` / `status 403` / `invalid_api_key` / `Incorrect API key` が出ていると認証エラーの可能性が高い
- ランナーの出力に `Posted automated review comment` があると PR へコメントされている（`--post` の場合）
- `admin-guidance.txt` が存在する場合は、スクリプトが推奨アクションを自動で生成しています

401 / 403 が出た場合の対処（運用フロー）
1. まず `admin-guidance.txt` の内容を確認し、原因の候補を確認する
2. `LLM_API_KEY` を一度削除して再登録する（GUI か CLI）
   - CLI: `./scripts/rotate-llm-secret.sh --remove --repo ShoheiFukushima/AutoEditTATE`
   - 再登録: `./scripts/rotate-llm-secret.sh --prompt --repo ShoheiFukushima/AutoEditTATE`
3. 再実行（ワークフローの再実行）してエラーが解消したかを確認
4. もし「プロバイダ違い（Google の API キー等）」が検出されたら、正しいプロバイダの API キーを用意して登録する
5. 引き続きエラーが出る場合は、API プロバイダ側のステータスや利用制限（quota, billing）を確認する

安全運用上のベストプラクティス
- シークレットは必要最低限の権限で発行し、定期的にローテーションしてください（例: 90 日）。
- CI の実行ログやアーティファクトは機密情報を含まないか確認してから共有してください。
- `--post` を使って PR へ実際にコメントを投稿する際は、事前にマスクや redaction が正しく動作していることを確認してください。
- 長期運用では HashiCorp Vault / AWS Secrets Manager 等の専用シークレットストアと連携することを検討してください。

自動化案（将来）
- 定期的に（例: 30 日ごと） `llm-rotation-verify` をスケジュール実行してキーの健全性をチェックし、アラートを上げる
- さらに高度なチェックとして、LLM 呼び出しのレスポンスヘッダー（quota, billing）を収集してダッシュボード化する

付録: 主要コマンドまとめ
- シークレット登録（プロンプト）
  - `chmod +x scripts/rotate-llm-secret.sh`
  - `./scripts/rotate-llm-secret.sh --prompt --repo ShoheiFukushima/AutoEditTATE`
- 検証ワークフロー（CLI）
  - `gh workflow run llm-rotation-verify.yml -f pr_number=2 -f post_comment=false --repo ShoheiFukushima/AutoEditTATE`
- 実行アーティファクトの確認
  - `gh run list --repo ShoheiFukushima/AutoEditTATE --workflow llm-rotation-verify.yml --limit 10`
  - `gh run view <run-id> --repo ShoheiFukushima/AutoEditTATE --log`
  - `gh run download <run-id> --repo ShoheiFukushima/AutoEditTATE --name llm-rotation-verify-output`

以上で SECRETS ローテーションの基本手順と検証フローを提供しました。ローカルでの検証が完了したら、アーティファクトのログを確認して問題が無ければワークフローを運用へ組み込む準備が整います。