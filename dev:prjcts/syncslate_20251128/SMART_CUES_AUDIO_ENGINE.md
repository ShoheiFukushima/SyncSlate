# SMART CUES 音声エンジン設計

## 🎵 音声再生の全体フロー

### 1. カウントループの基本構造

```typescript
/**
 * メインのカウントループ
 * SMART CUESを考慮したカウント読み上げ
 */
async function runCountSequence(
  sequenceDuration: number,
  smartCues: SmartCue[],
  audioContext: AudioContext
): Promise<void> {
  let currentCount = 0;

  while (currentCount <= sequenceDuration) {
    const loopStartTime = audioContext.currentTime;

    // SMART CUEがあるかチェック
    const cue = smartCues.find(c => c.timestamp === currentCount);

    if (cue && cue.audioType !== 'number') {
      // SMART CUEがある場合
      await playCueAudio(cue, audioContext);

      // カスタム音声の場合、スキップ処理
      if (cue.audioType === 'custom' && cue.customAudioDuration) {
        const skipCount = Math.ceil(cue.customAudioDuration);
        currentCount += skipCount;
      } else {
        // 通常は1秒待機
        await waitForNextCount(loopStartTime, audioContext);
        currentCount++;
      }
    } else {
      // 通常のカウント
      await speakNumber(currentCount, audioContext);
      await waitForNextCount(loopStartTime, audioContext);
      currentCount++;
    }
  }
}

/**
 * 次のカウントまで待機（必ず1秒間隔）
 */
async function waitForNextCount(
  loopStartTime: number,
  audioContext: AudioContext
): Promise<void> {
  const elapsed = audioContext.currentTime - loopStartTime;
  const waitTime = Math.max(0, 1.0 - elapsed);

  if (waitTime > 0) {
    await sleep(waitTime * 1000);
  }
}

/**
 * スリープ関数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 🔊 音声タイプ別の再生ロジック

### 1. テキスト読み上げ（0.8秒制限）

```typescript
/**
 * テキスト読み上げ（Gemini TTS使用）
 * 0.8秒で強制ストップ
 */
async function speakTextWithLimit(
  text: string,
  audioContext: AudioContext,
  maxDuration: number = 0.8
): Promise<void> {
  // Gemini TTSでMP3生成
  const audioData = await generateTTS(text);

  // MP3をAudioBufferに変換
  const audioBuffer = await audioContext.decodeAudioData(audioData);

  // AudioBufferSourceNodeで再生
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  const startTime = audioContext.currentTime;
  source.start(startTime);

  // 0.8秒後に強制停止
  const stopTime = startTime + maxDuration;
  source.stop(stopTime);

  // 停止まで待機
  return new Promise(resolve => {
    source.onended = () => resolve();
  });
}

/**
 * Gemini TTSでMP3を生成
 */
async function generateTTS(text: string): Promise<ArrayBuffer> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

  const response = await fetch(`${url}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text }]
      }],
      generationConfig: {
        response_modalities: ['AUDIO'],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: 'Puck' // または 'Charon', 'Kore', 'Fenrir', 'Aoede'
            }
          }
        }
      }
    })
  });

  const data = await response.json();
  const base64Audio = data.candidates[0].content.parts[0].inline_data.data;

  // Base64をArrayBufferに変換
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}
```

### 2. 数字の読み上げ（通常カウント）

```typescript
/**
 * 数字の読み上げ
 */
async function speakNumber(
  num: number,
  audioContext: AudioContext
): Promise<void> {
  const text = num.toString();
  return speakTextWithLimit(text, audioContext, 0.8);
}
```

### 3. プリセット効果音（鉄砲、電話）

```typescript
/**
 * プリセット効果音の再生
 */
async function playPresetSound(
  soundType: 'gunshot' | 'phone',
  audioContext: AudioContext
): Promise<void> {
  // プリセット効果音をロード
  const audioBuffer = await loadPresetSound(soundType, audioContext);

  // 再生
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  const startTime = audioContext.currentTime;
  source.start(startTime);

  return new Promise(resolve => {
    source.onended = () => resolve();
  });
}

/**
 * プリセット効果音のロード（キャッシュ付き）
 */
const presetSoundCache = new Map<string, AudioBuffer>();

async function loadPresetSound(
  soundType: 'gunshot' | 'phone',
  audioContext: AudioContext
): Promise<AudioBuffer> {
  // キャッシュチェック
  if (presetSoundCache.has(soundType)) {
    return presetSoundCache.get(soundType)!;
  }

  // プリセット効果音のURL（埋め込みBase64またはCDN）
  const soundUrls = {
    gunshot: '/sounds/gunshot.mp3', // または Base64 data URL
    phone: '/sounds/phone-ring.mp3',
  };

  // 効果音をフェッチ
  const response = await fetch(soundUrls[soundType]);
  const arrayBuffer = await response.arrayBuffer();

  // デコード
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // キャッシュに保存
  presetSoundCache.set(soundType, audioBuffer);

  return audioBuffer;
}

/**
 * 電話コールの再生（指定回数）
 */
async function playPhoneRings(
  rings: number,
  audioContext: AudioContext
): Promise<void> {
  for (let i = 0; i < rings; i++) {
    await playPresetSound('phone', audioContext);

    // コール間の間隔（0.3秒）
    if (i < rings - 1) {
      await sleep(300);
    }
  }
}
```

### 4. カスタム音声の再生

```typescript
/**
 * カスタム音声の再生（最後まで再生）
 */
async function playCustomAudio(
  dataUrl: string,
  duration: number,
  audioContext: AudioContext
): Promise<void> {
  // HTML Audio要素で再生（AudioContextより簡単）
  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(dataUrl);

    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('音声再生エラー'));

    audio.play().catch(reject);

    // 安全のため、duration + 0.1秒で強制終了
    setTimeout(() => {
      if (!audio.ended) {
        audio.pause();
        audio.currentTime = 0;
        resolve();
      }
    }, (duration + 0.1) * 1000);
  });
}

/**
 * カスタム音声の再生（AudioContext版、より正確なタイミング）
 */
async function playCustomAudioWithContext(
  dataUrl: string,
  audioContext: AudioContext
): Promise<void> {
  // data URLをArrayBufferに変換
  const arrayBuffer = await dataUrlToArrayBuffer(dataUrl);

  // デコード
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // 再生
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  const startTime = audioContext.currentTime;
  source.start(startTime);

  return new Promise(resolve => {
    source.onended = () => resolve();
  });
}

/**
 * data URLをArrayBufferに変換
 */
async function dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(dataUrl);
  return response.arrayBuffer();
}
```

---

## 🎯 CUE音声の統合再生

```typescript
/**
 * CUEの音声を再生（音声タイプに応じて分岐）
 */
async function playCueAudio(
  cue: SmartCue,
  audioContext: AudioContext
): Promise<void> {
  switch (cue.audioType) {
    case 'number':
      // 通常のカウント
      return speakNumber(cue.timestamp, audioContext);

    case 'text':
      // テキスト読み上げ（0.8秒制限）
      return speakTextWithLimit(cue.text || '', audioContext, 0.8);

    case 'gunshot':
      // 銃声効果音
      return playPresetSound('gunshot', audioContext);

    case 'phone':
      // 電話コール（指定回数）
      return playPhoneRings(cue.phoneRings || 1, audioContext);

    case 'custom':
      // カスタム音声（最後まで再生）
      return playCustomAudio(
        cue.customAudioUrl || '',
        cue.customAudioDuration || 0,
        audioContext
      );

    default:
      console.warn('Unknown audio type:', cue.audioType);
  }
}
```

---

## ⏱️ タイミング制御の詳細

### カウントスキップロジック

```typescript
/**
 * カスタム音声の長さに応じてカウントをスキップ
 */
function calculateSkipCount(audioLength: number): number {
  // 例: 3.2秒の音声 → 4カウントスキップ（0, 1, 2, 3）
  // つまり、次のカウントは4
  return Math.ceil(audioLength);
}

/**
 * カウントループ（スキップ対応版）
 */
async function runCountSequenceWithSkip(
  sequenceDuration: number,
  smartCues: SmartCue[],
  audioContext: AudioContext
): Promise<void> {
  let currentCount = 0;

  while (currentCount <= sequenceDuration) {
    const loopStartTime = audioContext.currentTime;
    const cue = smartCues.find(c => c.timestamp === currentCount);

    if (cue && cue.audioType === 'custom' && cue.customAudioDuration) {
      // カスタム音声を再生
      await playCueAudio(cue, audioContext);

      // カウントをスキップ
      const skipCount = calculateSkipCount(cue.customAudioDuration);
      currentCount += skipCount;

      // スキップした分の時間は既に経過しているので、待機不要
    } else if (cue && cue.audioType !== 'number') {
      // 通常のCUE（0.8秒制限）
      await playCueAudio(cue, audioContext);

      // 1秒まで待機
      await waitForNextCount(loopStartTime, audioContext);
      currentCount++;
    } else {
      // 通常のカウント
      await speakNumber(currentCount, audioContext);

      // 1秒まで待機
      await waitForNextCount(loopStartTime, audioContext);
      currentCount++;
    }
  }
}
```

### 精密なタイミング制御

```typescript
/**
 * AudioContext.currentTimeベースの精密なタイミング制御
 */
class PrecisionTimer {
  private audioContext: AudioContext;
  private startTime: number = 0;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * タイマー開始
   */
  start(): void {
    this.startTime = this.audioContext.currentTime;
  }

  /**
   * 経過時間を取得（秒単位）
   */
  getElapsed(): number {
    return this.audioContext.currentTime - this.startTime;
  }

  /**
   * 次のカウントまで待機
   */
  async waitUntil(targetTime: number): Promise<void> {
    const now = this.audioContext.currentTime - this.startTime;
    const waitTime = Math.max(0, targetTime - now);

    if (waitTime > 0) {
      await sleep(waitTime * 1000);
    }
  }

  /**
   * リセット
   */
  reset(): void {
    this.startTime = this.audioContext.currentTime;
  }
}

/**
 * 精密タイマーを使ったカウントループ
 */
async function runCountSequenceWithPrecisionTimer(
  sequenceDuration: number,
  smartCues: SmartCue[],
  audioContext: AudioContext
): Promise<void> {
  const timer = new PrecisionTimer(audioContext);
  timer.start();

  let currentCount = 0;

  while (currentCount <= sequenceDuration) {
    const cue = smartCues.find(c => c.timestamp === currentCount);

    // CUE再生
    if (cue && cue.audioType !== 'number') {
      await playCueAudio(cue, audioContext);

      if (cue.audioType === 'custom' && cue.customAudioDuration) {
        // カスタム音声の長さだけスキップ
        const skipCount = calculateSkipCount(cue.customAudioDuration);
        currentCount += skipCount;

        // 次のカウントのタイミングまで待機
        await timer.waitUntil(currentCount);
      } else {
        // 次のカウント（1秒後）まで待機
        currentCount++;
        await timer.waitUntil(currentCount);
      }
    } else {
      // 通常のカウント
      await speakNumber(currentCount, audioContext);

      // 次のカウント（1秒後）まで待機
      currentCount++;
      await timer.waitUntil(currentCount);
    }
  }
}
```

---

## 🔇 ミュート機能との統合

```typescript
/**
 * ミュート状態を考慮したCUE再生
 */
async function playCueAudioWithMute(
  cue: SmartCue,
  audioContext: AudioContext,
  isMuted: boolean
): Promise<void> {
  if (isMuted) {
    // ミュート時は音声を再生せず、待機のみ
    if (cue.audioType === 'custom' && cue.customAudioDuration) {
      // カスタム音声の長さだけ待機
      await sleep(cue.customAudioDuration * 1000);
    } else {
      // 0.8秒待機（通常のCUE）
      await sleep(800);
    }
  } else {
    // 通常の再生
    await playCueAudio(cue, audioContext);
  }
}
```

---

## 🎚️ ボリューム制御

```typescript
/**
 * ボリューム付き音声再生
 */
async function playAudioWithVolume(
  audioBuffer: AudioBuffer,
  audioContext: AudioContext,
  volume: number = 1.0
): Promise<void> {
  // GainNodeでボリューム制御
  const gainNode = audioContext.createGain();
  gainNode.gain.value = volume;

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const startTime = audioContext.currentTime;
  source.start(startTime);

  return new Promise(resolve => {
    source.onended = () => resolve();
  });
}

/**
 * フェードイン/フェードアウト
 */
async function playAudioWithFade(
  audioBuffer: AudioBuffer,
  audioContext: AudioContext,
  fadeInDuration: number = 0.1,
  fadeOutDuration: number = 0.1
): Promise<void> {
  const gainNode = audioContext.createGain();

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const startTime = audioContext.currentTime;
  const duration = audioBuffer.duration;

  // フェードイン
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(1, startTime + fadeInDuration);

  // フェードアウト
  gainNode.gain.setValueAtTime(1, startTime + duration - fadeOutDuration);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

  source.start(startTime);

  return new Promise(resolve => {
    source.onended = () => resolve();
  });
}
```

---

## 🎤 音声品質の最適化

### 1. オーディオコンテキストの設定

```typescript
/**
 * 最適なAudioContextの作成
 */
function createOptimizedAudioContext(): AudioContext {
  const audioContext = new AudioContext({
    latencyHint: 'interactive', // 低レイテンシー
    sampleRate: 44100, // CD品質
  });

  return audioContext;
}
```

### 2. プリロード＆キャッシュ

```typescript
/**
 * SMART CUESの音声を事前にプリロード
 */
async function preloadSmartCuesAudio(
  smartCues: SmartCue[],
  audioContext: AudioContext
): Promise<void> {
  const promises = smartCues.map(async cue => {
    switch (cue.audioType) {
      case 'text':
        // テキストのTTSを事前生成
        if (cue.text) {
          const audioData = await generateTTS(cue.text);
          const audioBuffer = await audioContext.decodeAudioData(audioData);
          // キャッシュに保存
          ttsCache.set(cue.text, audioBuffer);
        }
        break;

      case 'gunshot':
      case 'phone':
        // プリセット効果音をプリロード
        await loadPresetSound(cue.audioType, audioContext);
        break;

      case 'custom':
        // カスタム音声をプリロード
        if (cue.customAudioUrl) {
          const arrayBuffer = await dataUrlToArrayBuffer(cue.customAudioUrl);
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          customAudioCache.set(cue.id, audioBuffer);
        }
        break;
    }
  });

  await Promise.all(promises);
}

// キャッシュ
const ttsCache = new Map<string, AudioBuffer>();
const customAudioCache = new Map<string, AudioBuffer>();
```

---

## 🧪 テストとデバッグ

### デバッグログ

```typescript
/**
 * 音声再生のデバッグログ
 */
function logAudioPlayback(
  cue: SmartCue,
  startTime: number,
  endTime: number
): void {
  console.log('[Audio Playback]', {
    timestamp: cue.timestamp,
    audioType: cue.audioType,
    startTime,
    endTime,
    duration: endTime - startTime,
    text: cue.text,
  });
}

/**
 * カウントループのデバッグ版
 */
async function runCountSequenceDebug(
  sequenceDuration: number,
  smartCues: SmartCue[],
  audioContext: AudioContext
): Promise<void> {
  let currentCount = 0;

  while (currentCount <= sequenceDuration) {
    const loopStartTime = audioContext.currentTime;
    const cue = smartCues.find(c => c.timestamp === currentCount);

    console.log(`[Count ${currentCount}]`, {
      hasCue: !!cue,
      audioType: cue?.audioType,
      currentTime: audioContext.currentTime,
    });

    if (cue && cue.audioType !== 'number') {
      await playCueAudio(cue, audioContext);
      const loopEndTime = audioContext.currentTime;
      logAudioPlayback(cue, loopStartTime, loopEndTime);

      if (cue.audioType === 'custom' && cue.customAudioDuration) {
        const skipCount = calculateSkipCount(cue.customAudioDuration);
        console.log(`[Skip] Skipping ${skipCount} counts`);
        currentCount += skipCount;
      } else {
        await waitForNextCount(loopStartTime, audioContext);
        currentCount++;
      }
    } else {
      await speakNumber(currentCount, audioContext);
      await waitForNextCount(loopStartTime, audioContext);
      currentCount++;
    }
  }
}
```

### パフォーマンステスト

```typescript
/**
 * 音声再生のパフォーマンス測定
 */
async function measureAudioPerformance(
  cue: SmartCue,
  audioContext: AudioContext
): Promise<number> {
  const startTime = performance.now();
  await playCueAudio(cue, audioContext);
  const endTime = performance.now();

  const elapsed = endTime - startTime;
  console.log(`[Performance] ${cue.audioType} took ${elapsed.toFixed(2)}ms`);

  return elapsed;
}
```

---

## 📊 音声エンジンの状態管理

```typescript
/**
 * 音声エンジンの状態
 */
interface AudioEngineState {
  isPlaying: boolean;
  currentCount: number;
  audioContext: AudioContext | null;
  isPaused: boolean;
  isMuted: boolean;
  volume: number;
}

/**
 * 音声エンジンクラス
 */
class SmartCuesAudioEngine {
  private state: AudioEngineState;
  private smartCues: SmartCue[];

  constructor(smartCues: SmartCue[]) {
    this.smartCues = smartCues;
    this.state = {
      isPlaying: false,
      currentCount: 0,
      audioContext: null,
      isPaused: false,
      isMuted: false,
      volume: 1.0,
    };
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    this.state.audioContext = createOptimizedAudioContext();
    await preloadSmartCuesAudio(this.smartCues, this.state.audioContext);
  }

  /**
   * 再生開始
   */
  async play(sequenceDuration: number): Promise<void> {
    if (!this.state.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    this.state.isPlaying = true;
    this.state.currentCount = 0;

    await runCountSequenceWithPrecisionTimer(
      sequenceDuration,
      this.smartCues,
      this.state.audioContext
    );

    this.state.isPlaying = false;
  }

  /**
   * 一時停止
   */
  pause(): void {
    this.state.isPaused = true;
    this.state.audioContext?.suspend();
  }

  /**
   * 再開
   */
  resume(): void {
    this.state.isPaused = false;
    this.state.audioContext?.resume();
  }

  /**
   * 停止
   */
  stop(): void {
    this.state.isPlaying = false;
    this.state.currentCount = 0;
  }

  /**
   * ミュート切り替え
   */
  toggleMute(): void {
    this.state.isMuted = !this.state.isMuted;
  }

  /**
   * ボリューム設定
   */
  setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * 現在の状態を取得
   */
  getState(): AudioEngineState {
    return { ...this.state };
  }
}
```

---

**作成日**: 2025-01-12
**最終更新**: 2025-01-12
**ステータス**: 設計完了、実装待ち
