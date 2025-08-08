# エラー対処クックブック（公式リンク対応表付き）

現場頻出エラーの「症状 → 一次切り分け → 対処 → 公式参照」を即時に引ける形でまとめる。Node.js 20 / TS 5 / npm / ESLint / Prettier / Vitest / Vite / Playwright 前提。

目次
1. 依存解決・インストール（npm / node-gyp / peer deps）
2. ESM/CJS・モジュール解決
3. TypeScript ビルド/型解決
4. Vite 開発/ビルド
5. テスト（Vitest/Jest）
6. Playwright（E2E）
7. macOS/Apple Silicon 固有
8. 文字処理/縦書き（TATE）実装系

------------------------------------------------------------

1. 依存解決・インストール

症状: npm ERR! ERESOLVE unable to resolve dependency tree
- 一次切り分け
  - `npm ls` で競合箇所を特定
  - peerDependencies の要求バージョンを確認（Jest/ESLint/React 周辺で多発）
- 対処
  - 依存のメジャー整合を取る（特に eslint-* plugins, jest/vitest 関連）
  - 「とりあえず --legacy-peer-deps」は最終手段。恒久対応はバージョン適合
- 公式
  - npm docs: https://docs.npmjs.com/
  - SemVer: https://semver.org/

症状: node-gyp rebuild 失敗（gyp ERR!）
- 一次切り分け
  - `xcode-select -p`、`python3 --version`、`node -p "process.arch"`
- 対処
  - Xcode CLT 再インストール（`xcode-select --install`）
  - Python3/ヘッダ類（`brew install python@3.12 openssl zlib`）
  - 再取得 `rm -rf node_modules && npm ci`
- 公式
  - node-gyp: https://github.com/nodejs/node-gyp#readme

症状: npm install 時の権限/キャッシュ問題
- 一次切り分け
  - `npm cache verify`、権限エラーはグローバルインストール箇所を確認
- 対処
  - `npm cache clean --force`、グローバルは npx/ローカルスクリプトに寄せる
- 公式
  - npm docs: https://docs.npmjs.com/

------------------------------------------------------------

2. ESM/CJS・モジュール解決

症状: SyntaxError: Cannot use import statement outside a module
- 一次切り分け
  - package.json の "type": "module" の有無
  - 実行ファイル拡張子（.mjs/.cjs/.js）とバンドラ設定
- 対処
  - ESM に統一（"type": "module"）し、Node 実行は .mjs or import を使用
  - CJS に統一なら .cjs と require を使用
- 公式
  - Node ESM: https://nodejs.org/docs/latest-v20.x/api/esm.html

症状: ERR_MODULE_NOT_FOUND / Cannot find module
- 一次切り分け
  - import パス、拡張子、省略ルール、tsconfig paths の有無
- 対処
  - バンドラ（Vite）/テストランナー（Vitest）側の alias 設定を tsconfig と同期
- 公式
  - Vite config: https://vitejs.dev/config/

------------------------------------------------------------

3. TypeScript ビルド/型解決

症状: 型定義が見つからない（Could not find a declaration file for module 'xxx'）
- 一次切り分け
  - モジュールが型を内包しているか、@types が必要か
- 対処
  - `npm i -D @types/xxx` または any 回避のため shim を作る
- 公式
  - TS Docs: https://www.typescriptlang.org/docs/

症状: tsconfig の paths がランタイムで解決されない
- 一次切り分け
  - tsc のみだと解決されない。Vite/Vitest 側にも alias を設定
- 対処
  - vite-tsconfig-paths の導入、または resolve.alias を明示
- 公式
  - Vite Plugins: https://vitejs.dev/plugins/

症状: ESM 出力で拡張子解決エラー
- 対処
  - TS で moduleResolution を node/bundler のどちらに合わせるか整理
- 公式
  - TS tsconfig: https://www.typescriptlang.org/tsconfig

------------------------------------------------------------

4. Vite 開発/ビルド

症状: Dev server が起動しない / ポート衝突
- 一次切り分け
  - `lsof -i :5173` などでポート占有確認
- 対処
  - `vite --port 5174` などポート変更、ENV で固定
- 公式
  - Vite Guide: https://vitejs.dev/guide/

症状: import alias が効かない
- 対処
  - vite-tsconfig-paths 導入、または resolve.alias で明示
- 公式
  - Vite Config: https://vitejs.dev/config/

------------------------------------------------------------

5. テスト（Vitest/Jest）

症状: ReferenceError: document/window is not defined
- 一次切り分け
  - テスト環境が node になっていないか
- 対処
  - Vitest: `environment: 'jsdom'` を設定
  - Jest: `testEnvironment: 'jsdom'`
- 公式
  - Vitest: https://vitest.dev/guide/
  - Jest: https://jestjs.io/docs/getting-started

症状: ESM/TS 周りでテスト実行が失敗
- 対処
  - Vitest は相性良好。Jest は ts-jest or Babel を適切設定
- 公式
  - Vitest: https://vitest.dev/guide/
  - Jest: https://jestjs.io/docs/getting-started

------------------------------------------------------------

6. Playwright（E2E）

症状: Browser binaries missing / executable not found
- 一次切り分け
  - 初回セットアップか、CI キャッシュ切れ
- 対処
  - `npx playwright install`、CI では `npx playwright install --with-deps`
- 公式
  - Install: https://playwright.dev/docs/cli#install

症状: Web サーバ待機でタイムアウト
- 対処
  - playwright.config の webServer 設定（command, url, reuseExistingServer）
- 公式
  - Test: https://playwright.dev/docs/test-intro

------------------------------------------------------------

7. macOS/Apple Silicon 固有

症状: arm64/x64 混在でネイティブ失敗
- 一次切り分け
  - `uname -m`、`node -p "process.arch"` で確認
- 対処
  - 依存のアーキに合わせる。どうしても必要なら Rosetta ターミナル
- 公式
  - node-gyp: https://github.com/nodejs/node-gyp#readme
  - Homebrew: https://docs.brew.sh/

症状: Xcode/CLT 関連のコンパイルエラー
- 対処
  - CLT 再導入、SDK パス、ヘッダ（openssl, zlib）を brew で補完

------------------------------------------------------------

8. 文字処理/縦書き（TATE）

症状: 文字数カウントが UI と合わない（絵文字/結合文字）
- 一次切り分け
  - 文字粒度を Grapheme Cluster で数える（UAX#29）
- 対処
  - Intl.Segmenter（granularity: 'grapheme'）でカウント実装
- 公式
  - UAX#29: https://unicode.org/reports/tr29/
  - Segmenter: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter

症状: 縦書きで改行/禁則の差異
- 対処
  - CSS Writing Modes / Text の仕様に沿い、E2E スナップショットで担保
- 公式
  - CSS Writing Modes: https://www.w3.org/TR/css-writing-modes-3/
  - CSS Text: https://www.w3.org/TR/css-text-3/

------------------------------------------------------------

付録: 公式ドキュメント・対応表（主要リンク）
- Node.js 20: https://nodejs.org/docs/v20.x/api/
- npm Docs: https://docs.npmjs.com/
- TypeScript Docs: https://www.typescriptlang.org/docs/
- ESLint Docs: https://eslint.org/docs/latest/
- Prettier Docs: https://prettier.io/docs/en/
- Vitest Guide: https://vitest.dev/guide/
- Vite Guide/Config: https://vitejs.dev/guide/ / https://vitejs.dev/config/
- Playwright Docs: https://playwright.dev/docs/intro
- Unicode/ICU: https://www.unicode.org/ / https://unicode-org.github.io/icu/