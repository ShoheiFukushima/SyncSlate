# SMART CUES 機能実装計画

## 概要

スレート実行中に監督のタイミングでマーカー（ピン）を打ち、後で助監督が内容を入力できる「SMART CUES」機能の実装計画です。

## 使用イメージ

1. 監督が撮影中に「ここ!」と指示したタイミングで、助監督がマーカーを打つ
2. スレートカット後、SMART CUESに空欄でタイミングが記録される
3. 後で助監督がそれぞれのマーカーに内容を入力
4. 次回の撮影時、SMART CUESのタイミングで数字の代わりに内容が読み上げられる

---

## 📋 実装タスクチェックリスト

### Phase 1: データ構造とステート管理
- [ ] **1.1** SmartCue型定義の作成
  - [ ] id, timestamp, label, audioType, customAudioUrl, duration などのフィールド
  - [ ] audioType: 'number' | 'text' | 'gunshot' | 'phone' | 'custom'
- [ ] **1.2** SmartCues配列のステート管理（useState）
- [ ] **1.3** LocalStorageへの永続化ロジック
- [ ] **1.4** セッションごとのCues管理（テイクごとに保存）

### Phase 2: UI/UXデザイン

#### 2.1 スレート実行中のマーカー打ちボタン
- [ ] **2.1.1** ミュートボタンの反対側（右側）に配置
- [ ] **2.1.2** 「📍 PIN」ボタンのデザイン
  - [ ] スレート実行中のみ表示
  - [ ] タップで現在時刻にマーカーを追加
  - [ ] 追加時に視覚的フィードバック（アニメーション）
- [ ] **2.1.3** 1秒に1回のみ打てる制限ロジック
- [ ] **2.1.4** マーカー打ち時の音声フィードバック（短いビープ音）

#### 2.2 SMART CUES編集画面
- [ ] **2.2.1** Sequence Configの下に新しいセクション「SMART CUES」を追加
- [ ] **2.2.2** 各Cueの表示カード
  - [ ] タイムスタンプ表示（例: "0:03"）
  - [ ] テキスト入力欄
  - [ ] 音声タイプ選択ドロップダウン
  - [ ] 削除ボタン
- [ ] **2.2.3** 音声タイプ別のUI
  - [ ] テキスト: テキストエリア
  - [ ] 鉄砲: ガンショット効果音選択
  - [ ] 電話: コール回数/長さ指定スライダー
  - [ ] カスタム: ファイルアップロードボタン
- [ ] **2.2.4** Cuesのソート（タイムスタンプ順）
- [ ] **2.2.5** すべてクリアボタン

### Phase 3: 音声読み上げロジック

#### 3.1 カウント読み上げ制御
- [ ] **3.1.1** 現在のカウントにSMART CUEがあるか確認
- [ ] **3.1.2** CUEがある場合、数字を読み上げない
- [ ] **3.1.3** CUEの内容を読み上げ（最大0.8秒）
- [ ] **3.1.4** 0.8秒経過で強制ストップ
- [ ] **3.1.5** 1秒経過で必ず次のカウントに進む

#### 3.2 音声タイプ別の再生
- [ ] **3.2.1** テキスト読み上げ（Gemini TTS）
  - [ ] 0.8秒制限の実装
  - [ ] AudioContext.currentTimeでタイミング制御
- [ ] **3.2.2** 効果音再生（鉄砲、電話）
  - [ ] プリセット効果音の準備
  - [ ] 電話コールの長さ指定ロジック
- [ ] **3.2.3** カスタム音声ファイル再生
  - [ ] 音声ファイルアップロード
  - [ ] 音声の長さに関わらず最後まで再生
  - [ ] 3秒や5秒の音声でも次のカウントをスキップして再生
  - [ ] 音声終了後、次のカウントに復帰

### Phase 4: ファイル管理
- [ ] **4.1** 音声ファイルインポート機能
  - [ ] File API でのファイル選択
  - [ ] 対応フォーマット: mp3, wav, ogg
  - [ ] ファイルサイズ制限（例: 5MB）
- [ ] **4.2** Base64エンコードでLocalStorageに保存
  - [ ] または IndexedDB への保存検討
- [ ] **4.3** プリセット効果音の埋め込み
  - [ ] 鉄砲音
  - [ ] 電話コール音

### Phase 5: テストと検証
- [ ] **5.1** マーカー打ち機能のテスト
- [ ] **5.2** SMART CUES編集画面のテスト
- [ ] **5.3** 音声読み上げタイミングのテスト
- [ ] **5.4** カスタム音声ファイルのテスト
- [ ] **5.5** LocalStorage永続化のテスト
- [ ] **5.6** モバイル/タブレットでの動作テスト

---

## 🎨 UI/UXデザイン案

### 1. スレート実行中のマーカー打ちボタン

```
┌─────────────────────────────────────┐
│   [カウントアップ表示]              │
│         00:05                       │
│                                     │
│   [🔇 MUTE]        [📍 PIN]        │
│                                     │
│   [■ CUT]                          │
└─────────────────────────────────────┘
```

**配置**:
- ミュートボタンの右側に配置
- スレート実行中（カウント中）のみ表示
- タップで現在時刻にマーカーを追加
- 連打防止: 1秒以内の連続タップは無視

**視覚的フィードバック**:
- タップ時: リップルエフェクト + 短いバイブレーション（モバイル）
- マーカー追加成功: 緑色のチェックマーク表示（0.5秒）
- 連打無視時: 赤色の×マーク表示（0.3秒）

---

### 2. SMART CUES編集セクション

```
┌─────────────────────────────────────────────────┐
│ SMART CUES                    [すべてクリア]    │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📍 0:03                              [×]        │
│ ┌──────────────────────────────────────────┐   │
│ │ 音声タイプ: [テキスト ▼]              │   │
│ └──────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────┐   │
│ │ アクション！                           │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ ─────────────────────────────────────────────  │
│                                                 │
│ 📍 0:07                              [×]        │
│ ┌──────────────────────────────────────────┐   │
│ │ 音声タイプ: [電話コール ▼]            │   │
│ └──────────────────────────────────────────┘   │
│ 🔔 コール回数: [━━●━━━] 3回             │   │
│                                                 │
│ ─────────────────────────────────────────────  │
│                                                 │
│ 📍 0:12                              [×]        │
│ ┌──────────────────────────────────────────┐   │
│ │ 音声タイプ: [カスタム音声 ▼]          │   │
│ └──────────────────────────────────────────┘   │
│ 📁 [ファイルを選択] explosion.mp3 (3.2s)      │
│                                                 │
└─────────────────────────────────────────────────┘
```

**カード構成**:
- タイムスタンプ（📍アイコン + 時刻）
- 音声タイプドロップダウン
- タイプ別のコントロール
- 削除ボタン（×）

**音声タイプ**:
1. **テキスト**: テキストエリア（最大50文字、0.8秒で読める程度）
2. **鉄砲**: プリセット効果音
3. **電話コール**: コール回数スライダー（1-10回）
4. **カスタム音声**: ファイルアップロード（mp3, wav, ogg）

---

### 3. 音声タイプ別のUI詳細

#### テキスト入力
```
┌──────────────────────────────────────────┐
│ 音声タイプ: [テキスト ▼]                │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ アクション！                             │
│                                          │
└──────────────────────────────────────────┘
💡 0.8秒以内で読める短いフレーズを推奨
```

#### 鉄砲
```
┌──────────────────────────────────────────┐
│ 音声タイプ: [鉄砲 ▼]                    │
└──────────────────────────────────────────┘
🔫 銃声効果音を再生
```

#### 電話コール
```
┌──────────────────────────────────────────┐
│ 音声タイプ: [電話コール ▼]              │
└──────────────────────────────────────────┘
🔔 コール回数: [━━━●━━] 5回
```

#### カスタム音声
```
┌──────────────────────────────────────────┐
│ 音声タイプ: [カスタム音声 ▼]            │
└──────────────────────────────────────────┘
📁 [ファイルを選択] explosion.mp3 (3.2s)
💡 音声が終わるまで再生されます
```

---

## 📐 データ構造設計

### SmartCue型定義

```typescript
interface SmartCue {
  id: string; // UUID
  timestamp: number; // 秒単位（例: 3 = 0:03）
  audioType: 'number' | 'text' | 'gunshot' | 'phone' | 'custom';

  // テキスト読み上げ用
  text?: string;

  // 電話コール用
  phoneRings?: number; // 1-10

  // カスタム音声用
  customAudioUrl?: string; // Base64 data URL
  customAudioDuration?: number; // 秒単位
  customAudioFilename?: string;
}

interface SessionData {
  sessionId: string;
  smartCues: SmartCue[];
  createdAt: string;
  updatedAt: string;
}
```

### LocalStorage構造

```json
{
  "syncslate_sessions": [
    {
      "sessionId": "session_20250112_001",
      "smartCues": [
        {
          "id": "cue_abc123",
          "timestamp": 3,
          "audioType": "text",
          "text": "アクション！"
        },
        {
          "id": "cue_def456",
          "timestamp": 7,
          "audioType": "phone",
          "phoneRings": 3
        },
        {
          "id": "cue_ghi789",
          "timestamp": 12,
          "audioType": "custom",
          "customAudioUrl": "data:audio/mp3;base64,...",
          "customAudioDuration": 3.2,
          "customAudioFilename": "explosion.mp3"
        }
      ],
      "createdAt": "2025-01-12T10:00:00Z",
      "updatedAt": "2025-01-12T10:15:00Z"
    }
  ]
}
```

---

## 🔧 実装の技術的詳細

### 1. マーカー打ち機能

```typescript
// スレート実行中のステート
const [isRunning, setIsRunning] = useState(false);
const [currentTime, setCurrentTime] = useState(0);
const [smartCues, setSmartCues] = useState<SmartCue[]>([]);
const [lastPinTime, setLastPinTime] = useState(0);

// ピン打ち関数
const handleAddPin = () => {
  // 1秒以内の連打防止
  if (currentTime - lastPinTime < 1) {
    showFeedback('error', '1秒以上空けてください');
    return;
  }

  const newCue: SmartCue = {
    id: `cue_${Date.now()}`,
    timestamp: Math.floor(currentTime),
    audioType: 'text', // デフォルト
    text: ''
  };

  setSmartCues([...smartCues, newCue]);
  setLastPinTime(currentTime);
  showFeedback('success', 'マーカーを追加しました');
  playBeep(); // 短いビープ音
};
```

### 2. 音声読み上げロジック

```typescript
const speakCountOrCue = async (count: number, audioContext: AudioContext) => {
  const cue = smartCues.find(c => c.timestamp === count);

  if (!cue || cue.audioType === 'number') {
    // 通常のカウント読み上げ
    await speakNumber(count);
    return;
  }

  switch (cue.audioType) {
    case 'text':
      // テキスト読み上げ（0.8秒制限）
      await speakTextWithTimeLimit(cue.text, 0.8, audioContext);
      break;

    case 'gunshot':
      // 銃声効果音
      await playPresetSound('gunshot');
      break;

    case 'phone':
      // 電話コール（指定回数）
      await playPhoneRings(cue.phoneRings);
      break;

    case 'custom':
      // カスタム音声（最後まで再生）
      await playCustomAudio(cue.customAudioUrl, cue.customAudioDuration);
      break;
  }
};

// 0.8秒制限付きテキスト読み上げ
const speakTextWithTimeLimit = async (
  text: string,
  maxDuration: number,
  audioContext: AudioContext
) => {
  const startTime = audioContext.currentTime;
  const audioBuffer = await generateTTS(text);
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start(startTime);

  // 0.8秒後に強制停止
  setTimeout(() => {
    source.stop();
  }, maxDuration * 1000);
};

// カスタム音声再生（最後まで）
const playCustomAudio = async (
  dataUrl: string,
  duration: number
) => {
  return new Promise((resolve) => {
    const audio = new Audio(dataUrl);
    audio.play();
    audio.onended = resolve;

    // 安全のため、duration + 0.1秒で強制終了
    setTimeout(() => {
      audio.pause();
      resolve(null);
    }, (duration + 0.1) * 1000);
  });
};
```

### 3. カウントタイミング制御

```typescript
// カウントループ（1秒ごと）
const countLoop = async () => {
  for (let i = 0; i <= sequenceDuration; i++) {
    const loopStartTime = audioContext.currentTime;

    // カウント/CUE読み上げ
    await speakCountOrCue(i, audioContext);

    // 次のカウントまで待機（必ず1秒後）
    const elapsed = audioContext.currentTime - loopStartTime;
    const waitTime = Math.max(0, 1.0 - elapsed);
    await sleep(waitTime);
  }
};

// カスタム音声の場合の特殊処理
const countLoopWithCustomAudio = async () => {
  for (let i = 0; i <= sequenceDuration; i++) {
    const loopStartTime = audioContext.currentTime;
    const cue = smartCues.find(c => c.timestamp === i);

    if (cue?.audioType === 'custom') {
      // カスタム音声は最後まで再生
      await speakCountOrCue(i, audioContext);
      // カスタム音声の長さだけスキップ
      const skipCount = Math.ceil(cue.customAudioDuration!);
      i += skipCount - 1; // 次のループでインクリメントされるので-1
    } else {
      // 通常のカウント（1秒制限）
      await speakCountOrCue(i, audioContext);
      const elapsed = audioContext.currentTime - loopStartTime;
      const waitTime = Math.max(0, 1.0 - elapsed);
      await sleep(waitTime);
    }
  }
};
```

---

## 🎯 実装の優先順位

### Phase 1（最小限の動作確認）
1. マーカー打ちボタンのUI実装
2. SmartCue型定義とステート管理
3. 基本的なCUE編集画面（テキストのみ）
4. テキスト読み上げ（0.8秒制限）

### Phase 2（コア機能の完成）
5. プリセット効果音（鉄砲、電話）
6. 電話コール回数指定
7. LocalStorage永続化

### Phase 3（高度な機能）
8. カスタム音声ファイルアップロード
9. カスタム音声の長尺再生（3秒、5秒など）
10. UI/UXの最終調整

---

## 🚨 技術的な課題と解決策

### 課題1: 0.8秒制限の実装
**問題**: TTS音声を途中で強制停止する必要がある

**解決策**:
- AudioContext.createBufferSource()を使用
- source.stop()で強制停止
- タイムアウトで0.8秒後に停止を保証

### 課題2: カスタム音声の長尺再生
**問題**: 3秒や5秒の音声を最後まで再生しつつ、カウントを進める

**解決策**:
- カスタム音声の場合、duration分のカウントをスキップ
- 例: 3秒の音声なら、カウント3, 4, 5をスキップして6に飛ぶ
- ループのインクリメント制御で実装

### 課題3: LocalStorageの容量制限
**問題**: Base64音声ファイルは大きい（5MBで約7MB）

**解決策**:
- ファイルサイズ制限（5MB以下）
- 必要に応じてIndexedDBへの移行検討
- 圧縮オプションの提供

### 課題4: モバイルでのファイル選択
**問題**: iOSでのファイルアクセス制限

**解決策**:
- `<input type="file" accept="audio/*">`を使用
- iOSのファイルアプリからの選択をサポート
- フォールバック: URLからの読み込み

---

## 📱 レスポンシブデザイン

### モバイル（〜640px）
- マーカー打ちボタン: 大きめ（60x60px）
- SMART CUESカード: 縦積み
- タイムスタンプ: 上部固定

### タブレット（641px〜1024px）
- 2カラムレイアウト
- マーカー打ちボタン: 中サイズ（50x50px）

### デスクトップ（1025px〜）
- max-w-4xl で中央配置
- 3カラムレイアウト可能
- マーカー打ちボタン: 標準サイズ（48x48px）

---

## 🧪 テストシナリオ

### 基本機能テスト
1. マーカーを3, 7, 12秒に打つ
2. それぞれにテキストを入力
3. スレートを実行して読み上げを確認
4. 0.8秒でテキストが切れることを確認
5. 1秒ごとにカウントが進むことを確認

### 効果音テスト
6. 鉄砲音を5秒に設定
7. 電話コールを10秒に設定（3回）
8. 正しいタイミングで再生されることを確認

### カスタム音声テスト
9. 3秒の音声ファイルをアップロード
10. 15秒に設定
11. 音声が最後まで再生されることを確認
12. 次のカウントが18秒になることを確認

### エッジケーステスト
13. 同じ秒に複数のCUEを設定（エラー表示）
14. 連続してマーカーを打つ（1秒制限）
15. 大きな音声ファイルをアップロード（サイズ制限）

---

## 📝 今後の拡張アイデア

- CUEのエクスポート/インポート（JSON形式）
- CUEテンプレートの保存（よく使うフレーズ）
- CUEのドラッグ&ドロップ並び替え
- CUEの色分け（重要度）
- 複数のプリセット効果音追加
- CUEの波形表示
- リアルタイムプレビュー機能

---

## 🏁 完成の定義

- [ ] すべてのチェックリストが完了
- [ ] モバイル/タブレット/デスクトップで動作確認
- [ ] テストシナリオをすべてパス
- [ ] ドキュメント更新（README, アーキテクチャ）
- [ ] ユーザーによる実際の撮影現場でのテスト

---

## 📅 推奨実装スケジュール

### Week 1: Phase 1
- マーカー打ちボタン実装
- 基本的なCUE編集画面
- テキスト読み上げ（0.8秒制限）

### Week 2: Phase 2
- プリセット効果音実装
- LocalStorage永続化
- UI/UXの改善

### Week 3: Phase 3
- カスタム音声ファイル対応
- 長尺音声の再生ロジック
- 総合テスト

### Week 4: テストと調整
- すべてのテストシナリオ実行
- バグ修正
- ドキュメント整備

---

**作成日**: 2025-01-12
**最終更新**: 2025-01-12
**ステータス**: 設計完了、実装待ち
