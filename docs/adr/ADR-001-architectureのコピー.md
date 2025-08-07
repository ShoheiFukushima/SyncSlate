# ADR-001: AutoEditTATE Technical Architecture
Version: v0.1
Date: 2025-08-07
Status: Proposed

## Context
AutoEditTATEは、Windows/Mac向けのインストール型デスクトップアプリとして提供する商用アプリケーションである。ブラウザアプリではなくローカルにインストールし、オンライン環境が必須である（将来要件での拡張余地は残す）。MVPでは以下の機能を対象にする:
- 動画インポート
- サムネイル生成
- シーン自動分割
- 簡易タイムライン編集
- FFmpegによる書き出し
- ローカル推論（ONNX Runtime, CPU）
- 歌詞入力をテロップとして動画タイミングに合わせて配置（横幅12文字まで、改行1回まで、自動配置）
除外（MVP対象外）:
- 字幕エディタ
- 要約生成、汎用テロップ自動生成（LLM利用）

配布対象:
- macOS: Universal/Intel
- Windows: x64
自動更新（差分配布）をサポートし、コード署名は段階導入（後追い）とする。FFmpegはライセンス条件を遵守のうえ同梱する。

## Decision
- UI/アプリフレーム: Electron + Node.js/TypeScript
- パフォーマンスクリティカル処理: Rustネイティブ（FFmpeg連携、サムネイル/シーン検出、レイアウト計算、ONNX Runtime呼び出し）
- ML推論: ONNX Runtime（CPUのみ）
- メディアI/O: FFmpegを同梱
- 更新: electron-updater を用いた差分自動更新
- 署名: Apple Developer ID / Windows コードサイニングは後追い導入
- オンライン必須: アプリ動作にはネットワーク接続が必要
- データ保存: ユーザーデータディレクトリ配下に設定/モデル/キャッシュを固定配置

## Details
### アプリ構成
- Electron Main Process（Node.js）
  - アプリ起動、ウィンドウ管理、アップデート、署名/検証、ストア
  - Rustネイティブ拡張（napi-rs もしくは Neon/N-API）とのブリッジ
- Renderer（React/TypeScript想定）
  - タイムラインUI、プレビュー、歌詞入力UI、シーン分割結果の可視化
- Rust Core
  - FFmpegバインディング（生成サムネイル、再エンコード、メタ情報抽出）
  - シーン検出（例: 動画フレームのヒストグラム/キーフレーム/SSIM等ベース）
  - 歌詞テロップ自動配置（12文字制限/1改行制約に基づく行分割・禁則処理・位置レイアウト）
  - ONNX Runtime CPU呼び出し（必要な軽量モデルの前処理/後処理ロジック）
- IPC/ブリッジ
  - Main - Renderer間はIPC（contextBridge）で明示API
  - Main - Rust間はN-APIで同期/非同期呼び出しを定義

### ビルド/配布
- パッケージ: electron-builder
- ターゲット:
  - macOS: dmg/pkg（Universal/Intel）
  - Windows: nsis/exe または msix（要要件再検討）
- 自動更新: electron-updater（更新チャネルは stable 起点。dev/alphaは将来追加可）
- 署名: 初期は未署名または最小署名/社内配布、正式リリース時に本署名導入

### パフォーマンス/UX
- サムネイル/シーン検出はRustで並列実行
- レンダラーはWebGL/Canvas最適化、仮想リストでタイムライン軽量化
- 大容量メディアはストリーム/スライス処理でメモリフットプリントを抑制

## Alternatives
- Tauri + Rust + TypeScript
  - 長所: メモリフットプリント小、起動高速
  - 短所: プラグイン/エコシステム成熟度、動画編集系の実績/サンプルでElectronに劣る
- Qt/C++ + Python埋め込み
  - 長所: ネイティブ性能、クロスプラットフォーム成熟
  - 短所: UI開発生産性、チームスキル前提、商用ライセンス考慮

採用理由:
- ElectronはUI開発速度とエコシステム（electron-builder/updater、N-API、既存知見）が強い
- Rustでコア処理を最適化し、Electronの弱点を補完可能

## Security/Licensing
- FFmpeg同梱: ライセンス（LGPL/GPL）表記とソース取得手段の明示、OSS NOTICE同梱
- モデル配布: 再配布可否を確認したモデルのみ同梱（利用規約/ライセンス準拠）
- 自動更新: 配布サーバのHTTPS必須、更新アーティファクトのハッシュ検証
- データ: ユーザーデータディレクトリ配下のみを既定書き込み先とする
- クラッシュ/テレメトリ: MVPでは任意（オプトイン）とし、導入時はプライバシーポリシー整備

## Distribution
- インストーラ:
  - macOS: dmg/pkg（将来的にNotarization/Stapling対応）
  - Windows: nsis/exe または msix（将来的にSmartScreen対策で署名導入）
- 自動更新:
  - electron-updater（差分更新）
  - 更新サーバ: GitHub Releases / self-hosted（HTTPS, ETag/差分配布）
  - チャネル: stable（初期はこれのみ）

## Data Storage
ユーザーデータディレクトリ配下に統一:
- macOS: ~/Library/Application Support/AutoEditTATE
- Windows: %APPDATA%/AutoEditTATE

構成例:
- config/: アプリ設定（JSON/YAML）
- models/: ONNXモデル等（配布/更新管理）
- cache/: サムネイル、解析中間生成物
- logs/: 実行ログ、更新ログ
- projects/: プロジェクトファイル（編集メタデータ）

権限/運用:
- 初回起動時にディレクトリ作成
- ユーザが任意で場所を変更する場合も、既定は上記に固定

## Operational
- ビルド/CI:
  - Node: LTS
  - Rust: Stable
  - CIでマルチプラットフォームビルド（GitHub Actions想定）
- アップデート:
  - 起動時/手動チェックで更新確認
  - 差分パッチ適用
- ロギング/診断:
  - Main/Renderer/Rustで一貫したログレベル（info/warn/error）
  - ユーザー同意の上で診断データ送信を検討

## Appendix
- 想定Rustクレート: ffmpeg-next/ffmpeg-sys, onnxruntime, rayon, anyhow, thiserror, napi-rs
- 想定Node依存: electron, electron-builder, electron-updater, react, zustand/redux, vite/webpack
- 将来拡張: GPU推論（DirectML/Metal）, 字幕エディタ, LLM要約/テロップ自動生成
