# 日本語音声ファイル実装ガイド

## 概要

SyncSlate AIに、事前録音された日本語音声ファイル(num000_02_01.wav ~ num060_02_01.wav)を使用した数字読み上げ機能を実装しました。

## 実装内容

### 1. 音声ファイルの配置

61個の日本語音声ファイル(0〜60)を `public/voices/` ディレクトリに配置:

```
public/voices/
├── num000_02_01.wav  (0)
├── num001_02_01.wav  (1)
├── num002_02_01.wav  (2)
...
└── num060_02_01.wav  (60)
```

### 2. gemini-api.ts の変更点

#### 2.1 音声キャッシュの追加

```typescript
class GeminiAudioEngine {
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  // ...
}
```

音声ファイルを一度読み込んだらキャッシュし、次回以降は即座に再生できるように最適化。

#### 2.2 日本語音声ファイル再生メソッド

```typescript
private async playJapaneseNumberVoice(num: number): Promise<void>
```

- 0〜60の範囲の数字に対応
- ファイルパス: `/voices/num{3桁ゼロパディング}_02_01.wav`
- 音声ファイルをキャッシュして高速再生
- エラー時は例外をスローしてフォールバック可能

#### 2.3 speak() メソッドの拡張

```typescript
async speak(text: string, config: VoiceConfig): Promise<void>
```

**動作フロー:**

1. 言語が `'jp'` (日本語) かチェック
2. テキストが数字(0〜60)かパース
3. 該当すれば `playJapaneseNumberVoice()` を使用
4. エラー時はWeb Speech APIにフォールバック
5. 数字以外(「レディ」「アクション」「カット」など)はWeb Speech APIで読み上げ

### 3. 使用方法

アプリケーション内で音声言語を **Japanese** に設定すると、自動的に日本語音声ファイルが使用されます。

```typescript
// index.tsx内での使用例
AudioEngine.trigger("5", "jp");  // num005_02_01.wavを再生
AudioEngine.trigger("Ready", "jp");  // Web Speech APIで「レディ」と読み上げ
```

## 技術的詳細

### パフォーマンス最適化

- **音声キャッシュ**: 一度読み込んだ音声はメモリにキャッシュ
- **プリロード不要**: 必要になった時点で初めて読み込み
- **即座の再生**: キャッシュヒット時は `currentTime = 0` でリセットして即再生

### エラーハンドリング

```typescript
try {
  await this.playJapaneseNumberVoice(num);
  return;
} catch (error) {
  console.warn('[GeminiAudio] Failed to play Japanese voice file, falling back to Web Speech API:', error);
  // Web Speech APIにフォールバック
}
```

音声ファイルの読み込みや再生に失敗した場合、自動的にWeb Speech APIにフォールバックします。

### ブラウザ互換性

- Chrome, Edge, Safari, Firefox対応
- モバイルブラウザ対応
- HTMLAudioElement標準API使用

## テスト方法

1. 開発サーバー起動: `http://localhost:3002/`
2. 設定で **Voice Language** を **Japanese** に変更
3. **Voice Countdown** を有効化
4. **START SLATE** をクリック
5. プリロールカウントダウンで日本語音声が再生されることを確認

## ファイル構成

```
syncslate_20251128/
├── public/
│   └── voices/
│       ├── num000_02_01.wav
│       ├── num001_02_01.wav
│       ...
│       └── num060_02_01.wav
├── gemini-api.ts              (音声エンジン実装)
└── index.tsx                  (メインアプリケーション)
```

## 今後の拡張案

1. **プリロード機能**: アプリ起動時に全音声ファイルをバックグラウンドで事前読み込み
2. **他言語対応**: 英語、中国語などの音声ファイルにも対応
3. **カスタム音声**: ユーザーが独自の音声ファイルをアップロード可能に
4. **音声合成**: 範囲外の数字(61以上)は動的に生成

## まとめ

日本語音声ファイルの実装により、より自然で高品質な日本語カウントダウンが実現されました。Web Speech APIとのシームレスなフォールバック機能により、信頼性も確保されています。
