# AutoEdit — 動画自動編集アプリケーション 要件定義（開発者向け）
Version: v0.1 / Date: 2025-08-07


本書は AutoEdit（動画自動編集アプリケーション）の開発者向け要件定義である。目的は「プロ現場品質を満たす自動編集を、理由と確信度つきで提供し、完全成功のみを出力する」ことである。ユーザー向け呼称は「動画自動編集アプリケーション」。

## 1. 目的と非機能要件

- 目的
  - 音楽・映像・歌詞を解析・統合し、3パターンの編集案（dynamic_cut / narrative_flow / hybrid_balance）を自動生成
  - すべての判断に根拠（reasons）とスコア（subscores, confidence）を付与
  - 厳格なQAに合格した成果物のみをXMLで出力（完全成功主義）
- 非機能（SLO/SLA 相当）
  - P95処理時間 ≤ 12分（想定90秒尺・80クリップ）
  - 成功率 ≥ 97%（XML妥当性とQA基準合格）
  - 透明性: explain.json を常に同梱（根拠・サブスコア・確信度）
  - 再現性: project_seed 固定で決定的実行
### 2.x MVP機能要件（追加・確定）
- インポート
  - 対応形式: mp4, mov, mxf（H.264/H.265/ProRes は優先検証）; 音声は wav/aac
  - メタ抽出: ffprobe を用いて fps, timebase, 解像度, サンプルレート, コーデックを取得
  - バリデーション: 欠損/不一致（例: timebase ≠ fps, サンプルレート不一致）は警告→修正ポリシー提示
- サムネイル生成
  - 解像度: 320px 幅基準（可変）、タイムライン用は GOP キーフレーム基点でサンプリング
  - キャッシュ: user-data/cache/thumbnails/{asset_id}/ にPNG/WebPで保存
- シーン自動分割
  - アルゴリズム: SSIM/ヒストグラム差分/キーフレーム閾値のハイブリッド
  - 最小ショット長: デフォルト 12 フレーム（設定可）
  - 出力: scenes.json に [startFrame, endFrame, score] 列挙
- 簡易タイムライン編集
  - 操作: 並べ替え/トリム/削除/スナップ（音楽拍/シーン境界/歌詞タイミングへ）
  - プレビュー: 低遅延のシーク（FFmpeg + 先読み）、範囲再生ループ
  - 保存: projects/{id}/timeline.json（非破壊、元素材は不変）
- 歌詞→テロップ入力・自動配置
  - 入力: プレーンテキスト（UTF-8）。1行最大12文字、改行は1回まで（最大2行）
  - 同期: 手動/半自動（拍/BPMにスナップ、またはシーン境界スナップ）
  - レイアウト: 既定は安全フレーム内下部中央。重なり/背景輝度を考慮して自動描画スタイル（影/縁取り）を適用
  - 出力: timeline.json に lyricCues: [{in, out, text, style}] を保存
- 書き出し（FFmpeg）
  - プリセット: H.264 High 10, ProRes 422 HQ（mac優先）, AAC 320kbps（音声）
  - 透かし/焼き込み: 歌詞テロップは焼き込み（字幕トラックではない）
  - ログ: export_{id}.log を保存。失敗時は error_report.json を出力
- オンライン要件
  - 起動時/更新チェック: electron-updater で stable チャネル確認
  - オンラインが無い場合: 説明ダイアログを表示し、編集は不可（プレビューのみ許可は将来検討）
  - 監査性: trace_id / span_id で工程を logs/{project_id}.jsonl に記録

## 2. 機能要件

- 入力
  - 動画ファイル群（映像クリップ）
  - 音声（BGM/楽曲）
  - 歌詞テキスト（任意、NLP解析に利用）
  - プロジェクトメタ（fps・drop-frame・サンプルレート・NLE種別）
- 解析
  - 音源解析（Essentia系）: BPM, 拍/オンセット, 構造, ダイナミクス
  - 映像解析（Vision + ローカル）: ショット境界, 被写体/行動, ブレ, 露出, 構図
  - 歌詞解析（NLP/LLM）: テーマ/感情/重要語/場面候補、韻/拍子
- 生成
  - 3パターンの目的関数に基づくカット列最適化（整数フレーム制約・最小ショット長・ジャンプカット回避）
  - explain_{project_id}_{pattern}.json の出力（subscores, score, aggregateConfidence, reasons, warnings, highlights）
  - FCPXML/Premiere XML の生成（対応優先: FCPXML v1.10 / Premiere XML）
- 検証（QAスイート）
  - validateXMLStructure, validateTimecodes, validateClipReferences, validateMusicSync（原則0フレームずれ）
  - 失敗時: error_report.json を生成（標準スキーマ）。自動補正ポリシー（timebase/sampleRate/参照パス再解決）は1回のみ提案/適用可
- 可視化/運用
  - UIでサブスコア/確信度/理由/警告を表示
  - 3パターン比較パネル（PatternComparePanel）
  - 差分ビューとミニマップ（自動補正前後のタイムライン差分）

## 3. アーキテクチャ

- レイヤリング
  - UI: Electron/renderer（入力検証、プレビュー、エラー可視化）
  - アプリサービス: Node/main（ジョブ管理、キュー、監査ログ）
  - 解析エンジン: Node worker_threads + ネイティブ拡張（C++/node-addon）で Essentia, ffmpeg, OpenCV/MediaPipe
  - AI推論: LLM/Vision API クライアント（retry/backoff/circuit breaker 実装）
  - QA層: 仕様化された Validator 群（純関数・どのレイヤからも呼べる）
  - I/O: ストレージ抽象（ローカル/クラウド切替）、content-addressable store による重複排除
- 監査/追跡
  - trace_id/span_id をすべての工程に付与、/logs/{project_id}.jsonl にJSON Lines保存
- パフォーマンス
  - 並列化（音声/映像/歌詞の独立ワーカー）
  - I/O/ffmpeg最適化（先読み・スレッド数調整）、メモリマップ共有
  - GPU推論はキューでオーバーサブスクライブ回避、CPUフォールバック

## 4. 技術スタック（推奨）

- 言語/ランタイム: TypeScript(Node.js 20+), C++(addon)
- デスクトップ: Electron（IPCブリッジでQA/Autofix/差分表示）
- 映像/音声: ffmpeg, Essentia.js/C++（RhythmExtractor, Onset, Music Structure）
- CV/ML: OpenCV, MediaPipe, TFLite/ONNX（軽量モデル）
- LLM/Vision: プロバイダ抽象（APIキー/レート制御/CB/Backoff）
- XML処理: fast-xml-parser（FCPXML/Premiere XML）
- テスト: Vitest（単体）, ローカルQAスイート, 往復テスト（roundtrip）
- 配布/環境: macOS/Windows対応、Node-AddonはCIでビルド

## 5. 目的関数と確信度（抜粋仕様）

- 目的関数（scores = { sync, semantic, visual, stability } ∈ [0,1]）
  - dynamic_cut = 0.38·sync + 0.30·visual + 0.22·semantic + 0.10·stability
  - narrative_flow = 0.18·sync + 0.24·visual + 0.30·semantic + 0.28·stability
  - hybrid_balance = 0.30·sync + 0.27·visual + 0.25·semantic + 0.18·stability
- 確信度 aggregateConfidence
  - c1 = 1 − Var(subscores) の正規化
  - c2 = メタ整合度（fps/timebase/sampleRate一致）
  - c3 = 入力完全性（beats/speech/shot 検出充足）
  - aggregate = 0.5·c1 + 0.3·c2 + 0.2·c3（最小合格閾値 0.88）

## 6. QAスイート（要件）

- validateXMLStructure
  - FCPXML/Premiere ルート検出、最小スキーマ整合（resources/sequence/spine/media 等）
- validateTimecodes
  - フレーム境界量子化（NDF/DF対応）、非正 durations の禁止、サブフレームの排除
- validateClipReferences
  - asset 参照実在性、in/out 範囲、ffprobe メタ一致（解像度/fps/サンプルレート/コーデック）
- validateMusicSync
  - 原則0フレームずれ（median/p95/max == 0 を理想）。ズレ検出時は生成側で再スナップ方針

失敗時は error_report.json（標準スキーマ）を必ず出力。UIに詳細（code/message/hint/related）を提示し、AutoFix（rate統一・参照パス再解決・DF厳密化・サブフレーム丸め）を提案/適用（新規ファイルとして保存、原本は不変）。

## 7. NLE互換と往復テスト

- 対応優先: FCPXML v1.10 / Premiere XML
- 時間基準: Timecodeユーティリティで NDF/DF（29.97/59.94）を厳密往復
- 往復テスト
  - ゴールデンXML → AutoEdit → XML → 差分検査（タイムコード/参照/レート）
  - CIで roundtrip-check を実行し、失敗時はアーティファクト化（before/after/error_report）

## 8. エラー/運用UX

- エラーダイアログ: 工程・理由・自動修復可否・修復手順、Copy to clipboard
- Partial Preview: 失敗直前までUI内プレビュー（外部書き出し不可）
- フォールバックモード
  - Strict（既定）: 失敗即停止
  - Music-only: Vision/LLM失敗時に音楽同期のみ案をUI内部で参考提示
- explain.json と error_report.json を常設し、サポート連携を迅速化

## 9. API（REST/IPC）要件（抜粋）

- REST（サーバー/将来拡張）
  - GET /api/v1/projects/{id}/explain?pattern=…
  - GET /api/v1/projects/{id}/logs
  - POST /api/v1/projects/{id}/retry?policy=auto_fix
  - SSE /status-stream
- Electron IPC（ローカル）
  - qa:run, qa:autofix, qa:timelineDiff, qa:timelineDanger
  - 返却: ErrorReport / DiffSummary / AutoFix結果

## 10. セキュリティ/コンプライアンス

- データ最小化: クラウド送信は特徴量/要約フレームのみ（エンタープライズ設定）
- 暗号化: AES-GCM at-rest, TLS1.2+ in-transit、鍵はOS Keychain/DPAPI
- 監査: audit.csv エクスポート、操作ログ（開始/停止/再試行/出力）

## 11. ロードマップ（90日）

- W1-2: QAスイートMVP + Timecodeユーティリティ
- W3-4: 音源解析のロバスト化（Multi-onset/Segmentation）とジャンプカット検証
- W5-6: 目的関数3種 + explain.json、スコア可視化UI
- W7-8: NLE互換スイートと往復テスト、自動補正ポリシー
- W9-10: パフォーマンス/GPU/CPUフォールバック
- W11-12: セキュリティ/監査/価格A-B

## 12. 成果物と出力仕様

- edit_{project_id}_{pattern}.fcpxml / premiere_{project_id}_{pattern}.xml
- explain_{project_id}_{pattern}.json
- logs/{trace_id}.jsonl
- error_report.json（失敗時）
- qa_report.json（CI/ローカル検証）

## 13. 受け入れ基準（抜粋）

- 3パターンすべて生成し、各 explain.json に subscores/score/aggregateConfidence/reasons が含まれる
- QAスイート合格（XML/Timecodes/ClipReferences/MusicSync）
- 往復テスト通過（changedItems=0、timebase/sampleRate一致、または1回の自動補正で一致）
- P95処理時間 ≤ 12分（想定条件下）

---

## 14. 追加方針（採用済みの改善提案）

### 14.1 入出力方針の明文化（I/O整合）

- 原則
  - 入力NLE種別に追従して出力する
    - Premiere XML を入力した場合は Premiere XML を出力
    - FCPXML を入力した場合は FCPXML を出力
  - 変換（Premiere→FCP、FCP→Premiere）は本アプリケーションの責務外（混在禁止）
  - プロジェクト内で複数NLE形式の混在を禁止（単一NLE形式で完結させる）

- 仕様への反映
  - 設定: project.config に nleType ∈ { premiere, fcpxml } を必須化
  - 実行: 入力XMLのルート要素検出で nleType を二重確認し、不一致時は fail-fast

### 14.2 I/O整合ラウンドトリップ（検証強化）

- 追加チェック項目（roundtripレポート）
  - nleTypeMatch: 入力/出力のNLE種別一致（true/false）
  - timebaseMatch / sampleRateMatch: 既存に加え、nleType不一致時は自動補正を試行しない
  - pathSchemeConsistent: pathurl のスキーム/相対絶対の整合（正規化ルールに準拠）
- 失敗時の扱い
  - 自動補正は timebase/sampleRate のみ対象。nleType 不一致は厳格 fail
  - error_report.json に code: "NLE_TYPE_MISMATCH" を付与、関連: { input: "premiere", output: "fcpxml" } 等を記録
- CIタスク
  - Golden XML を NLE種別ごとに用意（tests/roundtrip/premiere/golden.xml など）
  - 各ジョブで nleType 固定の roundtrip-check を独立実行

### 14.3 UI/UX への反映

- 入力時に NLE バッジを表示（Premiere / FCP）
- 設定画面で nleType をロック、混在時は即エラー表示
- レポートに nleTypeMatch を明示（丸/バツ）

以上の追加方針により、入出力の一貫性と現場トラブルの抑止（意図しないNLE変換や混在）を仕様として防止し、CIレベルで継続検証します。
## 0. MVP範囲・前提（追加）
- 実行環境
  - 配布: macOS (Universal/Intel), Windows (x64) インストーラ
  - オンライン必須（アプリの動作にネットワーク接続が必要）
  - 自動更新: electron-updater による差分配布（将来コード署名導入）
- 同梱/依存
  - FFmpeg 同梱（ライセンス表記/OSS NOTICE同梱）
  - 推論: ONNX Runtime（CPUのみ）
- MVPで実装する機能
  - 動画インポート
  - サムネイル生成
  - シーン自動分割（ヒストグラム/SSIM/キーフレーム等）
  - 簡易タイムライン編集（基本的なトリム/並べ替え/スナップ）
  - FFmpegによる書き出し（事前定義プリセット）
  - 歌詞→テロップ入力・配置
    - 歌詞テキストを入力し、動画のタイミングに同期してテロップ化
    - 1行あたり横幅最大12文字、改行は1回まで（最大2行）
    - 自動配置（禁則処理/行分割/位置決定）。重なりや視認性を考慮したデフォルト配置
- MVPで実装しない機能（除外）
  - 字幕エディタ（字幕トラックの細かな編集UI）
  - 要約や汎用テロップの自動生成（LLMベース）
- データ保存
  - ユーザーデータディレクトリ配下に固定（例）
    - macOS: ~/Library/Application Support/AutoEditTATE
    - Windows: %APPDATA%/AutoEditTATE
  - config/, models/, cache/, logs/, projects/ を標準ディレクトリとして使用
