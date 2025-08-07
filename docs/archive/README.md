# JS/TS 開発エラー対策・公式ドキュメント書庫（Node.js 20 / TypeScript 5 / npm / ESLint / Prettier / Jest・Vitest / Vite / Playwright）

本書庫は、AutoEditTATE 開発におけるエラー予防・切り分け・復旧を高速化するための「一次入口（index）」です。各分野の公式ドキュメントと、よくある失敗の原因・対処リンクをコンパクトに整理しています。

検索のコツ
- まず本ページ内検索（macOS: Cmd+F）→ 見つからなければ各セクションの「トラブルシューティング」を確認
- バージョン前提: Node.js 20.x / TypeScript 5.x。各ツールは最新安定版を想定
- 日本語情報が乏しい場合は英語公式へ直行。Issue/Discussion/Release notes まで踏み込むと解決が早い

目次
1. Node.js / npm / パッケージ
2. TypeScript
3. ESLint / Prettier
4. テスト（Jest / Vitest）
5. Vite（開発/ビルド）
6. Playwright（E2E）
7. macOS/Apple Silicon と環境依存
8. 文字コード・Unicode・日本語処理（TATE 文脈）
9. よくあるエラー対処クックブック

------------------------------------------------------------

1. Node.js / npm / パッケージ

公式
- Node.js 公式: https://nodejs.org/en/docs
- Node.js v20 Docs: https://nodejs.org/docs/v20.x/api/
- npm Docs: https://docs.npmjs.com/
- SemVer: https://semver.org/
- Node Release: https://nodejs.org/en/about/previous-releases

トラブルシューティング
- Node バージョン切替（n, fnm, volta いずれかを採用）
  - volta: https://docs.volta.sh/
  - fnm: https://github.com/Schniz/fnm
- npm キャッシュ破損: npm cache verify / npm cache clean --force
- ネイティブアドオンのビルド失敗（Apple Silicon）
  - Xcode Command Line Tools: xcode-select --install
  - Rosetta 2: softwareupdate --install-rosetta
  - node-gyp: https://github.com/nodejs/node-gyp#readme
- ESM/CJS 混在エラー
  - package.json の "type": "module" と拡張子 .cjs / .mjs の整合
  - 参考: https://nodejs.org/docs/latest-v20.x/api/esm.html

チェックリスト
- Node 20.x を使用しているか
- package-lock.json（または pnpm-lock.yaml/yarn.lock）をコミットしているか
- "type" と import/export の方針が一貫しているか

------------------------------------------------------------

2. TypeScript

公式
- TS 公式: https://www.typescriptlang.org/docs/
- TS 5 リリースノート: https://www.typescriptlang.org/docs/handbook/release-notes/overview.html
- tsconfig リファレンス: https://www.typescriptlang.org/tsconfig

トラブルシューティング
- tsconfig の境界ミス（rootDir/outDir、composite、paths/baseUrl）
- ESM 出力と Node 実行時の拡張子不一致
- 型定義の見つからないモジュール: npm i -D @types/xxx（またはモジュール自体が型を内包）

チェックリスト
- strict: true
- noUncheckedIndexedAccess: true（バグ早期検知）
- moduleResolution は bundler/node 次第で最適化
- isolatedModules: true（Vite などのトランスパイル互換性）

------------------------------------------------------------

3. ESLint / Prettier

公式
- ESLint: https://eslint.org/docs/latest/
- Config 新方式 flat config: https://eslint.org/docs/latest/use/configure/configuration-files-new
- Prettier: https://prettier.io/docs/en/
- eslint-config-prettier: https://github.com/prettier/eslint-config-prettier

トラブルシューティング
- ESLint フラット設定と従来設定の競合
- Prettier と ESLint の競合は eslint-config-prettier で無効化
- エディタのフォーマッタ重複（VSCode 設定を確認）

チェックリスト
- ルートに ESLint 設定（flat なら eslint.config.js）
- Prettier 設定（.prettierrc 等）と EditorConfig 併用
- CI で lint/format チェック

------------------------------------------------------------

4. テスト（Jest / Vitest）

公式
- Jest: https://jestjs.io/docs/getting-started
- Vitest: https://vitest.dev/guide/
- Testing Library: https://testing-library.com/docs/

トラブルシューティング
- ESM/TS サポート設定漏れ（Jest は ts-jest/Babel、Vitest は標準で TS 良好）
- DOM 環境（jsdom）の設定
- パスエイリアス解決に tsconfig.paths とテストランナー設定の整合が必要

チェックリスト
- ユニットは Vitest 推奨（Vite 連携が容易）
- ESM/TS/paths の整合
- Watch と CI 用に別スクリプト

------------------------------------------------------------

5. Vite（開発/ビルド）

公式
- Vite: https://vitejs.dev/guide/
- Vite Config: https://vitejs.dev/config/
- Plugin 公式: https://vitejs.dev/plugins/

トラブルシューティング
- tsconfig paths 連携: vite-tsconfig-paths
- Node API と ESM 出力の相性
- CSS Modules / PostCSS 設定競合
- dev server のポート衝突

チェックリスト
- vite.config.ts で base, resolve.alias, test 設定
- 環境変数（.env.*）の流儀を統一

------------------------------------------------------------

6. Playwright（E2E）

公式
- Playwright: https://playwright.dev/docs/intro
- Test Runner: https://playwright.dev/docs/test-intro
- Trace Viewer: https://playwright.dev/docs/trace-viewer
- Codegen: https://playwright.dev/docs/codegen

トラブルシューティング
- ブラウザバイナリ未取得: npx playwright install
- Apple Silicon での一部ヘッドレス不具合は最新版へ更新
- ポート/サーバ待機: webServer 設定の wait-on 相当

チェックリスト
- playwright.config.ts の retries, reporter, trace 設定
- E2E 用に本番ビルド＋プレビュー or dev server を明示

------------------------------------------------------------

7. macOS/Apple Silicon と環境依存

公式/参考
- Apple Silicon 開発 Tips（Node/ネイティブ）: https://github.com/nodejs/node-gyp#on-unix
- Homebrew: https://docs.brew.sh/
- Xcode CLT: xcode-select --install
- Rosetta: https://support.apple.com/HT211861

トラブルシューティング
- arm64 と x64 の混在（Homebrew /usr/local vs /opt/homebrew）
- Python 依存（node-gyp 用）。python3 が参照可能か確認
- OpenSSL や zlib のヘッダ欠如 → brew install

チェックリスト
- /opt/homebrew を優先パス
- Xcode CLT 導入済み
- CI とローカルで Node メジャーバージョン固定

------------------------------------------------------------

8. 文字コード・Unicode・日本語処理（TATE 文脈）

公式/参考
- Unicode 公式: https://www.unicode.org/standard/standard.html
- UAX #9（双方向）: https://unicode.org/reports/tr9/
- UAX #11（East Asian Width）: https://unicode.org/reports/tr11/
- UAX #14（Line Breaking）: https://unicode.org/reports/tr14/
- UAX #29（Grapheme Cluster）: https://unicode.org/reports/tr29/
- CSS Writing Modes（縦書き）: https://www.w3.org/TR/css-writing-modes-3/
- CSS Text: https://www.w3.org/TR/css-text-3/
- ICU: https://unicode-org.github.io/icu/
- Node.js TextDecoder/TextEncoder: https://nodejs.org/docs/latest-v20.x/api/util.html#class-textdecoder

トラブルシューティング
- サロゲートペア/結合文字での文字数ズレ
- 改行/禁則（UAX#14）と CSS の wrap 設定齟齬
- 正規化（NFC/NFKC）前提の違い
- エンコーディング混在（UTF-8 BOM 含む）

チェックリスト
- 文字粒度はコードポイントではなく grapheme cluster を前提
- テキスト処理は ICU 相当のルールを参照
- CSS 縦書きは writing-mode, text-orientation を明示

------------------------------------------------------------

9. よくあるエラー対処クックブック（公式リンク付き）

依存解決/ビルド
- ERESOLVE / peer dep 競合 → 依存のメジャー整合、npm ls、公式 CHANGELOG を確認
- node-gyp build error → Xcode CLT、Python3、brew のヘッダ、Rosetta
- ESM/CJS エラー（Unexpected token 'export' 等）→ package.json type、拡張子整理

テスト/E2E
- JSDOM API 未定義 → 環境設定（testEnvironment/jsdom or Vitest environment）
- Playwright のブラウザ未インストール → npx playwright install

Vite
- Alias 未解決 → vite-tsconfig-paths、resolve.alias
- 環境変数が反映されない → VITE_ プレフィックス

TypeScript
- 型が any になる → 型定義パッケージ導入、型の再エクスポート整備
- tsc とランタイム挙動差 → moduleResolution/isolatedModules を確認

ESLint/Prettier
- フォーマットが崩れる → Prettier ルールと ESLint の競合を解消
- ルールが当たらない → 対象ファイルの include/glob を再確認
