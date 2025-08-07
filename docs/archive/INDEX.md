# AutoEditTATE 公式ドキュメント書庫 INDEX

目的
- 開発時のエラー対策・切り分け・復旧の一次入口
- 公式ドキュメントへの最短動線と、頻出エラーの対処を集約
- macOS/Apple Silicon・日本語/縦書き（TATE）特有の論点を併記

構成
- 概要/ガイド: README.md（全体の導入・各領域の公式リンク集）
- 環境/I18N: platform-and-i18n.md（Apple Silicon、Unicode、縦書き）
- エラー即解: error-cookbook.md（症状→一次切り分け→対処→公式）

クイックリンク
- 概要（公式リンク集）: ./README.md
- 環境・I18N・縦書き: ./platform-and-i18n.md
- エラー対処クックブック: ./error-cookbook.md

検索のヒント
- VSCode: Cmd+P → "archive" → 対象ファイルを開く → Cmd+F で用語検索
- 症状キーワードでまず error-cookbook.md を検索
- 仕様/詳細は README.md の公式リンクから辿る（英語版推奨）

対象スタック（前提）
- Node.js 20.x、TypeScript 5.x、npm
- ESLint、Prettier
- テスト: Vitest/Jest
- バンドラ/開発: Vite
- E2E: Playwright

運用ルール
- 新しい失敗パターンは error-cookbook.md に追記し、必ず公式リンクを併記
- 環境依存の知見は platform-and-i18n.md へ集約
- バージョンメジャー更新時は README.md のリンク・注意点を確認して更新