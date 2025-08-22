# AutoEditTATE (skeleton)

Electron + React + TypeScript + Rust (napi-rs placeholder) skeleton to reach Milestone 1 (app launches, open video dialog, native greet stub).

Repository layout
- app/
  - main/ (Electron main process TypeScript)
  - preload/ (contextBridge-safe API)
  - renderer/ (React + Vite)
- native/
  - rust-core/ (reserved for napi-rs crate; to be added)
- electron-builder.yml (packaging targets)
- package.json (root orchestrator)

Getting started
1) Install Node deps (root + renderer)
   - cd AutoEditTATE
   - npm install
   - cd app/renderer && npm install
   - cd ../..

2) Dev run (Vite + Electron main via ts-node)
   - npm run dev
   Vite runs on http://localhost:5173 and Electron loads it.

3) Build
   - npm run build
   Builds renderer, compiles main/preload TS, and packages with electron-builder.

Notes
- Type errors "Cannot find module 'electron'/'vite'/react types" will resolve once you run npm install in root and in app/renderer.
- Preload exposes window.api with:
  - openVideoDialog(): Promise<string | null>
  - native.greet(): Promise<string> (loads from native/rust-core when available)

Next steps (Milestones)
- Native: add napi-rs crate under native/rust-core with greet() and generate_thumbnails() stub, then wire dynamic import path in preload to built .node/.js entry.
- CI: add Node + Rust lint/test workflows (kept separate from existing policy-check).
- Renderer: add thumbnail grid and scene marker visualization.

Security
- contextIsolation enabled, no nodeIntegration in renderer; all privileged calls via preload.
- Basic CSP is set in app/renderer/index.html (relaxed for dev HMR).
## ローカル PR レビューランナー（pr-review-runner）

このリポジトリには、ローカルで差分を安全にレビューできる軽量ランナーを追加しました。目的は「ローカルで差分をスクラブ（機密マスク）して、LLM を使う/使わないにかかわらず自動レビューの出力を確認する」ことです。個人開発ワークフロー向けの実装になっています。

主なファイル（参照）
- ランナー本体: [`scripts/pr-review-runner.js`](scripts/pr-review-runner.js:1)
- redaction ユーティリティ: [`scripts/pr-review-utils.js`](scripts/pr-review-utils.js:1)
- テストイベント（サンプル）: [`tmp/pr-event-local.json`](tmp/pr-event-local.json:1)
- redaction ユニットテスト: [`tests/unit/pr-review-runner.spec.ts`](tests/unit/pr-review-runner.spec.ts:1)
- package.json の npm スクリプト: [`package.json`](package.json:1)

素早い実行（npm スクリプト）
- ヒューリスティック（LLM なし）で差分を検査・表示（ローカル実行）
  - [`zsh()`](README.md:1) npm run pr-review:local

- 実際に PR にコメントを投稿する（--post。注意: 実行には有効な GITHUB_TOKEN が必要）
  - [`zsh()`](README.md:1) npm run pr-review:local:post

（上記スクリプトは既に [`package.json`](package.json:1) に設定済みです。）

直接コマンドでの実行例
- LLM を有効にしてローカル実行（自己責任で API キーを端末にセットしてください）
  - [`zsh()`](README.md:1) export LLM_API_KEY="（あなたのキー）"
  - [`zsh()`](README.md:1) GITHUB_REPOSITORY=ShoheiFukushima/AutoEditTATE LLM_API_KEY="$LLM_API_KEY" node scripts/pr-review-runner.js --local --event tmp/pr-event-local.json

- LLM を使わない（フォールバック／ヒューリスティック）の実行
  - [`zsh()`](README.md:1) GITHUB_REPOSITORY=ShoheiFukushima/AutoEditTATE node scripts/pr-review-runner.js --local --event tmp/pr-event-local.json

テスト実行
- redaction の回帰テスト（ローカル）
  - [`zsh()`](README.md:1) npx tsx tests/unit/pr-review-runner.spec.ts

- 既存の obs テスト（参考）
  - [`zsh()`](README.md:1) npx tsx tests/unit/obs/logger.spec.ts
  - [`zsh()`](README.md:1) npx tsx tests/unit/obs/explainSink.spec.ts

動作のポイント / 注意
- 差分は送信前に [`scripts/pr-review-utils.js`](scripts/pr-review-utils.js:1) の `scrubPatch()` で赤action（マスク）されます。PEM ブロック、OpenAI/Google/GH トークン、長い base64/hex 文字列 等をマスクしますが、完全ではないため重要情報の取り扱いは注意してください。
- `--post` を使うと実際に GitHub の PR にコメントが付与されます。ローカルで試す場合は `GITHUB_TOKEN` を安全に管理し、不要なら `--post` を使わないことを推奨します。
- LLM（外部 API）を使う場合は `LLM_API_KEY` を端末に設定してから実行してください。キーは絶対に公開しないでください。
- 今後の改善案: redaction ルールの追加・差分のサマリ改良・ローカル実行ワンコマンド化（npm スクリプトは追加済）・runbook の整備

フィードバック歓迎です。ローカルでのワンショット実行や `--post` 実行のラップ、あるいは redaction パターンの追加など、優先したい項目を教えてください。