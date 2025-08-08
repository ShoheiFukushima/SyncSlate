# macOS/Apple Silicon と I18N/文字処理（TATE 向け）公式リファレンス集

AutoEditTATE で発生しやすい「環境依存」と「日本語テキスト処理（縦書き含む）」の一次入口。公式への深リンクと、発生頻度の高い症状→確認手順→参照先をまとめる。

目次
1. macOS/Apple Silicon（M1/M2/M3）
2. Homebrew/Toolchain
3. Node.js ネイティブアドオン（node-gyp）
4. エンコーディング/Unicode/正規化
5. Grapheme/幅/改行（UAX 系）
6. CSS 縦書き（Writing Modes）
7. Web/JS API（TextEncoder/Decoder, Intl）
8. よくある症状と一次切り分け

------------------------------------------------------------

1. macOS/Apple Silicon（M1/M2/M3）

公式/基本
- Apple Silicon 概要: https://support.apple.com/HT211814
- Rosetta 2: https://support.apple.com/HT211861
- Xcode Command Line Tools: `xcode-select --install`
- 環境 PATH（arm64 /opt/homebrew, x64 /usr/local）: https://docs.brew.sh/FAQ

チェック
- ターミナルが arm64 か: `uname -m`（arm64 ならネイティブ）
- Node バイナリのアーキ: `node -p "process.arch"`
- Rosetta シェルの混在を避ける（必要な場合のみ使用）

------------------------------------------------------------

2. Homebrew/Toolchain

公式
- Homebrew: https://docs.brew.sh/
- Formula 検索: https://formulae.brew.sh/

よく使う
- OpenSSL, zlib, Python3（node-gyp で必要になることが多い）
  - `brew install openssl zlib python@3.12`

PATH の注意
- /opt/homebrew が先頭か（arm64）
- 複数 Python があると node-gyp が迷う。`python3 --version` を固定

------------------------------------------------------------

3. Node.js ネイティブアドオン（node-gyp）

公式
- node-gyp: https://github.com/nodejs/node-gyp#readme
- Node.js v20 API: https://nodejs.org/docs/v20.x/api/

一次対応
- Xcode CLT を入れる
- Python3 が見えることを確認（`which python3`）
- 再ビルド: `npm rebuild` / 依存再取得: `rm -rf node_modules && npm ci`

Apple Silicon
- 一部依存が x64 前提の場合→Rosetta ターミナルまたはバイナリ更新
- バイナリ配布型（canvas, sharp 等）はアーキ別配布状況を確認

------------------------------------------------------------

4. エンコーディング/Unicode/正規化

公式
- Unicode Standard: https://www.unicode.org/standard/standard.html
- 正規化（UAX #15）: https://unicode.org/reports/tr15/
- WHATWG Encoding Standard: https://encoding.spec.whatwg.org/
- Node.js TextEncoder/TextDecoder: https://nodejs.org/docs/latest-v20.x/api/util.html#class-textdecoder

注意点
- UTF-8 BOM 有無で差異が出る
- NFC/NFD 差（macOS ファイル名は NFD 寄り）→正規化して比較
- 半角/全角/互換文字（NFKC/NFKD）を仕様に応じて扱う

------------------------------------------------------------

5. Grapheme/幅/改行（UAX 系）

公式
- UAX #29 Grapheme Cluster: https://unicode.org/reports/tr29/
- UAX #14 Line Breaking: https://unicode.org/reports/tr14/
- UAX #11 East Asian Width: https://unicode.org/reports/tr11/
- Emoji 処理（複合シーケンス）: https://unicode.org/emoji/

実務ポイント
- 文字数=コードポイント数ではない。結合文字、ZWJ 含む
- 幅は East Asian Width とフォント依存の相互作用。揺れを許容する設計
- 禁則処理は UAX#14 や CSS Text 仕様を参照

------------------------------------------------------------

6. CSS 縦書き（Writing Modes）

公式
- CSS Writing Modes Level 3: https://www.w3.org/TR/css-writing-modes-3/
- CSS Text Level 3: https://www.w3.org/TR/css-text-3/
- CSS Text Decoration: https://www.w3.org/TR/css-text-decor-3/

実務ポイント
- writing-mode: vertical-rl | vertical-lr
- text-orientation: upright | mixed
- line-break, word-break, overflow-wrap の連携
- 禁則や圏点の設計は仕様＋実ブラウザ差を踏まえ E2E で担保

------------------------------------------------------------

7. Web/JS API（Text/Intl）

公式
- Intl API（ECMA-402）: https://tc39.es/ecma402/
- Unicode Collation/Segmenter: Intl.Collator / Intl.Segmenter
  - Segmenter: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
- TextEncoder/TextDecoder（Node/Web）: 上記 Node 公式 or MDN

実務ポイント
- Intl.Segmenter で言語別の分かち/グラフェム境界に近い分割が可能
- Collator で比較/ソートのロケール依存差を扱う

------------------------------------------------------------

8. よくある症状と一次切り分け

症状: ネイティブ依存の npm install が失敗（Apple Silicon）
- 確認: `xcode-select -p` がエラーなく返るか、`python3 --version`
- 対処: Xcode CLT 再インストール、OpenSSL/zlib を brew で導入、`npm ci` や `npm rebuild`
- 公式: node-gyp README、依存パッケージのリリースノート

症状: テキスト長が想定と合わない（絵文字/結合文字）
- 確認: 実際の文字列を UAX#29 の Grapheme 単位で数える
- 対処: Intl.Segmenter（granularity: "grapheme"）でカウント
- 参考: UAX#29

症状: 縦書きで禁則/改行が崩れる
- 確認: CSS writing-mode/text-orientation、line-break の組合せ
- 対処: CSS Text/Writing Modes の該当節へ、E2E でレイアウト確認（Playwright の screenshot/trace 併用）
- 参考: CSS Text, Writing Modes

症状: ESM/CJS の読込エラー
- 確認: package.json の "type"、拡張子（.mjs/.cjs）、バンドラ（Vite）設定
- 対処: どちらかに統一。Vitest/Jest 側の解決ルールも同期
- 参考: Node ESM ドキュメント
