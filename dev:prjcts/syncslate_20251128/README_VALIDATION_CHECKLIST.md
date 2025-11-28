# README仕様検証チェックリスト

> このチェックリストは、オーナーのREADMEに記載されたすべての仕様が実装されているかを検証するためのものです。

## ✅ コア定義の実装

- [ ] **製品定義**: プロフェッショナルなブラウザベースのデジタルスレート
- [ ] **対象ユーザー**: 映画製作者、コンテンツクリエイター、ボイスオーバーアーティスト
- [ ] **価値提案**: 専用ハードウェア不要

## ✅ Key Features（主要機能）

### 1. Precision Timeline
- [ ] Configurable Duration（設定可能な継続時間）
- [ ] Configurable Pre-roll（設定可能な準備時間）
- [ ] Visual countdowns（ビジュアルカウントダウン）

### 2. AI Voice Synthesis
- [ ] Google Gemini 2.5 Flash 使用
- [ ] "Action" 音声生成
- [ ] "Cut" 音声生成
- [ ] Numbers（数字）音声生成
- [ ] Custom text（カスタムテキスト）音声生成
- [ ] On the fly（即座）生成

### 3. Smart Cues
- [ ] Schedule text prompts（テキストプロンプトのスケジュール）
- [ ] Appear at specific timestamps（特定タイムスタンプで表示）
- [ ] Be spoken at specific timestamps（特定タイムスタンプで音声再生）

### 4. Color Ranges
- [ ] Dynamic background color change（動的背景色変更）
- [ ] Time-based（時間ベース）
- [ ] Green for start（開始は緑）
- [ ] Red for wrap（終了は赤）

### 5. Guest Mode ⚠️ 最重要
- [ ] **No Login Required（ログイン不要）**
- [ ] **Share a link（リンク共有）**
- [ ] **Turn any tablet/phone into synchronized slave（任意のデバイスを同期スレーブに）**
- [ ] **Immediate access（即座アクセス）**

### 6. Permission Management
- [ ] Guests can request control（ゲストが制御要求可能）
- [ ] Remote management（リモート管理）

### 7. Multi-Language Support
- [ ] Auto-detection（自動検出）
- [ ] English（英語）
- [ ] Japanese（日本語）
- [ ] Chinese（中国語）
- [ ] French（フランス語）
- [ ] German（ドイツ語）
- [ ] Italian（イタリア語）
- [ ] Korean（韓国語）
- [ ] Hindi（ヒンディー語）

## ✅ Sharing & Synchronization（共有と同期）

### 設計理念
- [ ] **"Designed to be frictionless"（摩擦のない設計）**

### 動作フロー
- [ ] First device becomes Host（最初のデバイスがHost）
- [ ] Share Link button（共有リンクボタン）
- [ ] Send via Email option（メール送信オプション）
- [ ] Guest Mode immediate entry（ゲストモード即座開始）
- [ ] **No login or account creation required（ログイン・アカウント作成不要）**

## ✅ Technical Backing（技術的実装）

### Zero-Latency Synchronization
- [ ] BroadcastChannel API 使用
- [ ] Time-Reference Synchronization architecture

### Absolute Time Reference (ATR)
- [ ] Single CMD_START event（単一の開始イベント）
- [ ] Future-scheduled startTime（未来のstartTime）
- [ ] UTC timestamp + network buffer（UTCタイムスタンプ+バッファ）
- [ ] SYNC_LATENCY_BUFFER_MS = 500ms

### Distributed Autonomous Execution
- [ ] Host broadcasts "starting at T=1000"
- [ ] Client receives at T=950, waits 50ms
- [ ] Frame calculation: `currentFrame = Date.now() - startTime`
- [ ] Automatic snap to correct absolute time（絶対時間への自動スナップ）

## ✅ Audio Architecture（音声アーキテクチャ）

- [ ] Individual Generation（個別生成）
- [ ] Lightweight Data（軽量データ）
- [ ] Pre-installed Voice（プリインストール音声）
- [ ] Gemini's Prebuilt Voice configuration

## ✅ Usage（使用方法）

### For Hosts
- [ ] Set Duration and Pre-Roll
- [ ] Add Smart Cues
- [ ] Click "Load AI Voices"
- [ ] Press "START SLATE"

### For Guests
- [ ] Open link from Host
- [ ] Display "WAITING FOR HOST"
- [ ] Auto-sync when Host starts
- [ ] Settings icon → "Request Control"

## ✅ Client App Specification（詳細仕様）

### Core Philosophy
- [ ] **Pure "Render Node"（純粋なレンダーノード）**
- [ ] **Zero state authority（ゼロ状態権限）**
- [ ] **Extremely lightweight（極限的軽量）**
- [ ] **URL-driven（URL駆動）**
- [ ] **Fail-safe（フェイルセーフ）**

### No Configuration UI
- [ ] Remove all sliders（すべてのスライダー削除）
- [ ] Remove all inputs（すべての入力削除）
- [ ] Remove all buttons（すべてのボタン削除）
- [ ] Remove all toggle switches（すべてのトグル削除）
- [ ] Exception: Full Screen button allowed（フルスクリーンボタンのみ許可）

### No Login / No Auth
- [ ] App initializes immediately（即座初期化）
- [ ] Listens to BroadcastChannel('sync-slate-v1')

### Visual States
- [ ] **Standby**: "WAITING FOR SIGNAL", dark mode default
- [ ] **Armed**: "ARMED"/"STANDBY" in Yellow/Amber
- [ ] **Running**: Large high-contrast countdown
- [ ] **Ended**: "CUT" in Red

### Technical Implementation
- [ ] Exact same tick logic as Host（Hostと同一のtickロジック）
- [ ] State hydration on load（ロード時の状態ハイドレーション）

### URL Behavior
- [ ] `?role=client` implied by default
- [ ] `?view=simple` for OLED saver mode

## ✅ Roadmap（ロードマップ）実装計画

### Phase 1: Cross-Device Synchronization
- [ ] Supabase Realtime or Firebase 選定
- [ ] NTP correction（50ms以内）

### Phase 2: Backend API & Security
- [ ] Vercel Functions実装
- [ ] API key security
- [ ] Rate limiting
- [ ] Caching

### Phase 3: PWA & Offline-First
- [ ] vite-plugin-pwa
- [ ] Service Workers
- [ ] Airplane Mode対応

### Phase 4: Bundle Optimization
- [ ] VITE_APP_MODE=HOST or CLIENT
- [ ] Ultra-lightweight client bundle

## ✅ Branding（ブランディング）

- [ ] **"Powered by SyncSlate AI"** 表示

## 🔴 最重要確認事項

### Client/Guest Mode の完全無料・ログイン不要
- [ ] **URL共有のみで参加可能**
- [ ] **認証画面を一切表示しない**
- [ ] **課金対象にしない**
- [ ] **Platform Core統合の対象外**

### パフォーマンス目標
- [ ] 同期レイテンシ < 50ms
- [ ] Client初回ロード < 1秒
- [ ] Clientバンドルサイズ < 50KB

---

## 検証結果

- **実装済み**: _____ / 100+
- **未実装**: _____ / 100+
- **要確認**: _____ / 100+

**最終検証日**: 2025年11月28日

このチェックリストのすべての項目にチェックが入るまで、SyncSlate AIは完成とは言えません。