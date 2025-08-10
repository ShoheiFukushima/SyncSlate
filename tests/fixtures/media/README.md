# Media fixtures - README

このディレクトリには QA 用のメディアフィクスチャと生成手順が含まれます。

目的:
- CI / ローカルで QA スイートを再現するための軽量サンプルを準備します。

含まれるファイル（このディレクトリ）
- sample_audio_60.wav — テスト用の音声ファイル（生成が必要）
- sample_lyrics_60.txt — 歌詞サンプル（既に作成済み）
- README.md （このファイル）

必要な依存関係:
- Node.js (推奨 v18+) と npm
- 開発依存のインストール: npm ci
- ffmpeg（音声生成に使用。macOSでは Homebrew でインストールできます）

音声ファイル生成（推奨: ffmpeg）
- 無音のWAVを生成する例:
```
ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 60 -ac 1 -ar 44100 tests/fixtures/media/sample_audio_60.wav
```
- 代替（440Hz のサイン波を生成する例）:
```
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=60" -ac 1 -ar 44100 tests/fixtures/media/sample_audio_60.wav
```
- sox がある場合:
```
sox -n -r 44100 -c 1 tests/fixtures/media/sample_audio_60.wav trim 0 60
```

QA ランナーの実行（ローカル）
- 依存をインストール:
```
npm ci
```
- 成功パス実行（デモ）:
```
npx tsx packages/app-cli/src/qa-runner.ts --mode=demo-pass --outDir=./qa-results
```
- 失敗パス実行（デモ、エラー出力確認）:
```
npx tsx packages/app-cli/src/qa-runner.ts --mode=demo-fail --outDir=./qa-results-fail
```

explain.json の検証
- バリデータを実行:
```
npx tsx packages/domain/src/validators/explainValidator.ts ./qa-results/explain.json
```

期待される出力
- 成功時: `./qa-results/explain.json`（`aggregateConfidence >= 0.88` などのフィールドを含む）  
- 失敗時: `./qa-results/error_report.json` または `./qa-results-fail/error_report.json`

CI（GitHub Actions）について
- すでに PoC ワークフローを追加しています: [.github/workflows/qa-suite.yml](.github/workflows/qa-suite.yml:1)
- main ブランチへの push / PR で自動実行されます（ワークフロー内で `npx tsx packages/app-cli/src/qa-runner.ts` を実行し、成果物をアップロードします）

注意・トラブルシュート
- `tsx` が見つからない場合は `npm ci` を実行してください（`package.json` に devDependency として登録されています）: [package.json](package.json:1)
- ffmpeg がインストールされていない場合は `brew install ffmpeg`（macOS）を実行してください
- パス解決に問題がある場合は `tests/fixtures/sample_project_60.xml` 内の `media/...` パスが実行ディレクトリから見えるか確認してください: [tests/fixtures/sample_project_60.xml](tests/fixtures/sample_project_60.xml:1)

次のステップ
- このファイルの手順に従ってローカルで実行できます。実行を代行してほしい場合は許可を出してください（代行実行には `execute_command` を使用します）。

（この README は自動生成された補助ドキュメントです）