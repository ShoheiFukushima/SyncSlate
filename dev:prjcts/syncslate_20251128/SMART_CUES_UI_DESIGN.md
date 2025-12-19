# SMART CUES UI/UXデザイン詳細仕様

## 🎨 カラーパレット

### メインカラー
```css
--primary: #3B82F6;      /* ボタン、アクセント */
--primary-hover: #2563EB;
--primary-active: #1D4ED8;
```

### ステートカラー
```css
--success: #10B981;      /* マーカー追加成功 */
--error: #EF4444;        /* エラー、削除 */
--warning: #F59E0B;      /* 警告 */
--info: #6366F1;         /* 情報 */
```

### ニュートラルカラー
```css
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-700: #374151;
--gray-900: #111827;
```

### 音声タイプ別カラー
```css
--audio-text: #8B5CF6;    /* テキスト */
--audio-gunshot: #DC2626; /* 鉄砲 */
--audio-phone: #059669;   /* 電話 */
--audio-custom: #EA580C;  /* カスタム */
```

---

## 📱 コンポーネント詳細設計

### 1. マーカー打ちボタン (PinButton)

#### デスクトップ版
```tsx
<button className="pin-button">
  <div className="pin-icon">📍</div>
  <span className="pin-label">PIN</span>
</button>
```

```css
.pin-button {
  width: 100px;
  height: 48px;
  background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.pin-button:hover {
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.pin-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
}

.pin-button:disabled {
  background: #9CA3AF;
  cursor: not-allowed;
  box-shadow: none;
}

.pin-icon {
  font-size: 20px;
  line-height: 1;
}

.pin-label {
  letter-spacing: 0.5px;
}
```

#### モバイル版（大きめ）
```css
@media (max-width: 640px) {
  .pin-button {
    width: 80px;
    height: 64px;
    flex-direction: column;
    gap: 4px;
    border-radius: 16px;
  }

  .pin-icon {
    font-size: 24px;
  }

  .pin-label {
    font-size: 12px;
  }
}
```

#### フィードバックアニメーション
```css
@keyframes pin-success {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes pin-error {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

.pin-button.success {
  animation: pin-success 0.5s ease;
}

.pin-button.error {
  animation: pin-error 0.3s ease;
}
```

---

### 2. SMART CUESセクションヘッダー

```tsx
<div className="smart-cues-header">
  <h2 className="smart-cues-title">
    <span className="title-icon">🎯</span>
    SMART CUES
    <span className="cues-count">{smartCues.length}</span>
  </h2>
  <button className="clear-all-button" onClick={handleClearAll}>
    <TrashIcon className="w-4 h-4" />
    すべてクリア
  </button>
</div>
```

```css
.smart-cues-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%);
  border-bottom: 2px solid #E5E7EB;
}

.smart-cues-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.title-icon {
  font-size: 24px;
}

.cues-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  background: #3B82F6;
  color: white;
  font-size: 12px;
  font-weight: 600;
  border-radius: 12px;
}

.clear-all-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #FEE2E2;
  color: #DC2626;
  border: 1px solid #FECACA;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-all-button:hover {
  background: #FEF2F2;
  border-color: #FCA5A5;
}
```

---

### 3. CUEカード (CueCard)

```tsx
<div className="cue-card" data-audio-type={cue.audioType}>
  <div className="cue-header">
    <div className="cue-timestamp">
      <span className="timestamp-icon">📍</span>
      <span className="timestamp-value">{formatTime(cue.timestamp)}</span>
    </div>
    <button className="delete-button" onClick={() => handleDeleteCue(cue.id)}>
      <XMarkIcon className="w-5 h-5" />
    </button>
  </div>

  <div className="cue-body">
    <select
      className="audio-type-select"
      value={cue.audioType}
      onChange={(e) => handleAudioTypeChange(cue.id, e.target.value)}
    >
      <option value="text">📝 テキスト</option>
      <option value="gunshot">🔫 鉄砲</option>
      <option value="phone">📞 電話コール</option>
      <option value="custom">🎵 カスタム音声</option>
    </select>

    {/* 音声タイプ別のコントロール */}
    {renderAudioControl(cue)}
  </div>
</div>
```

```css
.cue-card {
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.cue-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--accent-color);
  transition: all 0.2s ease;
}

.cue-card[data-audio-type="text"]::before {
  background: #8B5CF6;
}

.cue-card[data-audio-type="gunshot"]::before {
  background: #DC2626;
}

.cue-card[data-audio-type="phone"]::before {
  background: #059669;
}

.cue-card[data-audio-type="custom"]::before {
  background: #EA580C;
}

.cue-card:hover {
  border-color: #3B82F6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.cue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cue-timestamp {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.timestamp-icon {
  font-size: 18px;
}

.timestamp-value {
  font-family: 'Monaco', 'Courier New', monospace;
  color: #111827;
}

.delete-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #FEE2E2;
  color: #DC2626;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-button:hover {
  background: #FECACA;
  transform: scale(1.05);
}

.audio-type-select {
  width: 100%;
  padding: 10px 12px;
  background: #F9FAFB;
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.audio-type-select:hover {
  background: #F3F4F6;
  border-color: #9CA3AF;
}

.audio-type-select:focus {
  outline: none;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
```

---

### 4. テキスト入力コントロール

```tsx
<div className="text-control">
  <textarea
    className="text-input"
    placeholder="読み上げるテキストを入力（0.8秒以内）"
    value={cue.text}
    onChange={(e) => handleTextChange(cue.id, e.target.value)}
    maxLength={50}
  />
  <div className="text-hint">
    💡 短いフレーズを推奨（例: アクション！）
  </div>
  <div className="character-count">
    {cue.text?.length || 0} / 50
  </div>
</div>
```

```css
.text-control {
  margin-top: 12px;
  position: relative;
}

.text-input {
  width: 100%;
  min-height: 80px;
  padding: 12px;
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  color: #111827;
  resize: vertical;
  transition: all 0.2s ease;
}

.text-input:hover {
  border-color: #D1D5DB;
}

.text-input:focus {
  outline: none;
  border-color: #8B5CF6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.text-hint {
  margin-top: 8px;
  padding: 8px 12px;
  background: #EEF2FF;
  border-left: 3px solid #6366F1;
  border-radius: 4px;
  font-size: 12px;
  color: #4F46E5;
}

.character-count {
  position: absolute;
  bottom: 8px;
  right: 12px;
  font-size: 11px;
  color: #9CA3AF;
  font-weight: 500;
}
```

---

### 5. 電話コールコントロール

```tsx
<div className="phone-control">
  <div className="phone-icon-display">
    📞 コール音を再生
  </div>
  <div className="ring-count-slider">
    <label htmlFor={`rings-${cue.id}`}>
      コール回数: <strong>{cue.phoneRings || 1}回</strong>
    </label>
    <input
      id={`rings-${cue.id}`}
      type="range"
      min="1"
      max="10"
      value={cue.phoneRings || 1}
      onChange={(e) => handlePhoneRingsChange(cue.id, Number(e.target.value))}
      className="ring-slider"
    />
    <div className="ring-marks">
      <span>1</span>
      <span>5</span>
      <span>10</span>
    </div>
  </div>
</div>
```

```css
.phone-control {
  margin-top: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  border-radius: 8px;
  border: 1px solid #A7F3D0;
}

.phone-icon-display {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #065F46;
  margin-bottom: 12px;
}

.ring-count-slider label {
  display: block;
  font-size: 14px;
  color: #047857;
  margin-bottom: 8px;
}

.ring-count-slider strong {
  color: #059669;
}

.ring-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: linear-gradient(90deg, #10B981 0%, #059669 100%);
  border-radius: 3px;
  outline: none;
}

.ring-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: white;
  border: 3px solid #059669;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ring-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  border-color: #047857;
}

.ring-marks {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: #6B7280;
}
```

---

### 6. カスタム音声コントロール

```tsx
<div className="custom-audio-control">
  <div className="file-upload-area">
    <input
      type="file"
      id={`audio-${cue.id}`}
      accept="audio/mp3,audio/wav,audio/ogg"
      onChange={(e) => handleFileUpload(cue.id, e.target.files[0])}
      className="file-input"
    />
    <label htmlFor={`audio-${cue.id}`} className="file-upload-label">
      <UploadIcon className="w-6 h-6" />
      <span>ファイルを選択</span>
    </label>
  </div>

  {cue.customAudioFilename && (
    <div className="file-info">
      <MusicNoteIcon className="w-5 h-5" />
      <div className="file-details">
        <div className="file-name">{cue.customAudioFilename}</div>
        <div className="file-duration">{formatDuration(cue.customAudioDuration)}</div>
      </div>
      <button
        className="play-preview-button"
        onClick={() => handlePreview(cue.customAudioUrl)}
      >
        <PlayIcon className="w-4 h-4" />
        プレビュー
      </button>
    </div>
  )}

  <div className="custom-audio-hint">
    💡 音声が終わるまで再生されます
  </div>
</div>
```

```css
.custom-audio-control {
  margin-top: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%);
  border-radius: 8px;
  border: 1px solid #FED7AA;
}

.file-upload-area {
  position: relative;
  margin-bottom: 12px;
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}

.file-upload-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: white;
  border: 2px dashed #FB923C;
  border-radius: 8px;
  color: #EA580C;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-upload-label:hover {
  background: #FFEDD5;
  border-color: #F97316;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: white;
  border: 1px solid #FED7AA;
  border-radius: 8px;
  margin-bottom: 12px;
}

.file-info > svg {
  flex-shrink: 0;
  color: #EA580C;
}

.file-details {
  flex: 1;
}

.file-name {
  font-size: 14px;
  font-weight: 600;
  color: #9A3412;
  margin-bottom: 2px;
}

.file-duration {
  font-size: 12px;
  color: #C2410C;
}

.play-preview-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #FB923C;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.play-preview-button:hover {
  background: #F97316;
}

.custom-audio-hint {
  padding: 8px 12px;
  background: #FFFBEB;
  border-left: 3px solid #F59E0B;
  border-radius: 4px;
  font-size: 12px;
  color: #B45309;
}
```

---

### 7. 空状態 (Empty State)

```tsx
<div className="smart-cues-empty">
  <div className="empty-icon">🎯</div>
  <h3 className="empty-title">まだCUEがありません</h3>
  <p className="empty-description">
    スレート実行中に「📍 PIN」ボタンを押して<br />
    監督のタイミングをマークしましょう
  </p>
</div>
```

```css
.smart-cues-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: #374151;
  margin-bottom: 8px;
}

.empty-description {
  font-size: 14px;
  color: #6B7280;
  line-height: 1.5;
}
```

---

## 📐 レイアウトグリッド

### デスクトップ（max-w-4xl）
```css
.smart-cues-section {
  max-width: 56rem; /* 896px */
  margin: 0 auto;
  padding: 24px;
}

.cues-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* 2カラムオプション（後で実装） */
@media (min-width: 768px) {
  .cues-grid.two-column {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}
```

### モバイル
```css
@media (max-width: 640px) {
  .smart-cues-section {
    padding: 16px;
  }

  .cues-grid {
    gap: 12px;
  }

  .cue-card {
    padding: 12px;
  }
}
```

---

## 🎭 アニメーション

### カード追加アニメーション
```css
@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cue-card.new {
  animation: slide-in 0.3s ease;
}
```

### カード削除アニメーション
```css
@keyframes slide-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100px);
  }
}

.cue-card.deleting {
  animation: slide-out 0.3s ease forwards;
}
```

### マーカー打ち成功フィードバック
```css
@keyframes ripple {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  100% {
    box-shadow: 0 0 0 20px rgba(16, 185, 129, 0);
  }
}

.pin-button.success::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: inherit;
  animation: ripple 0.6s ease-out;
}
```

---

## 🔊 音声フィードバック

### マーカー打ちビープ音
```typescript
const playBeep = () => {
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = 800; // 800Hz
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.01,
    audioContext.currentTime + 0.1
  );

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
};
```

---

## 📱 タッチ最適化

### タップ反応の改善
```css
.pin-button,
.delete-button,
.file-upload-label {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
}

/* タップ時のフィードバック */
.pin-button:active {
  transform: scale(0.95);
}
```

### スクロール最適化
```css
.smart-cues-section {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

---

## ♿ アクセシビリティ

### ARIAラベル
```tsx
<button
  className="pin-button"
  onClick={handleAddPin}
  disabled={!isRunning}
  aria-label="マーカーを追加"
  aria-disabled={!isRunning}
>
  <div className="pin-icon" aria-hidden="true">📍</div>
  <span className="pin-label">PIN</span>
</button>

<button
  className="delete-button"
  onClick={() => handleDeleteCue(cue.id)}
  aria-label={`${formatTime(cue.timestamp)}のCUEを削除`}
>
  <XMarkIcon className="w-5 h-5" aria-hidden="true" />
</button>
```

### フォーカス表示
```css
.pin-button:focus-visible,
.delete-button:focus-visible,
.audio-type-select:focus-visible {
  outline: 2px solid #3B82F6;
  outline-offset: 2px;
}
```

### キーボードナビゲーション
```tsx
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleAddPin();
  }
};
```

---

## 🌍 国際化対応（将来の拡張）

### テキスト定数
```typescript
const UI_TEXT = {
  ja: {
    pin: 'PIN',
    smartCues: 'SMART CUES',
    clearAll: 'すべてクリア',
    audioTypeText: 'テキスト',
    audioTypeGunshot: '鉄砲',
    audioTypePhone: '電話コール',
    audioTypeCustom: 'カスタム音声',
  },
  en: {
    pin: 'PIN',
    smartCues: 'SMART CUES',
    clearAll: 'Clear All',
    audioTypeText: 'Text',
    audioTypeGunshot: 'Gunshot',
    audioTypePhone: 'Phone Ring',
    audioTypeCustom: 'Custom Audio',
  },
};
```

---

## 📊 パフォーマンス最適化

### 遅延レンダリング
```tsx
import { lazy, Suspense } from 'react';

const CueCard = lazy(() => import('./CueCard'));

<Suspense fallback={<CueCardSkeleton />}>
  {smartCues.map(cue => (
    <CueCard key={cue.id} cue={cue} />
  ))}
</Suspense>
```

### 仮想スクロール（CUEが50個以上の場合）
```tsx
import { FixedSizeList as List } from 'react-window';

<List
  height={600}
  itemCount={smartCues.length}
  itemSize={150}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <CueCard cue={smartCues[index]} />
    </div>
  )}
</List>
```

---

**作成日**: 2025-01-12
**最終更新**: 2025-01-12
**ステータス**: デザイン完了、実装待ち
