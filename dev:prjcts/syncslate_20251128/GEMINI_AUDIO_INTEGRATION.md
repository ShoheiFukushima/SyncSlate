# Gemini Audio Integration

## 概要

SyncSlateに音声合成機能を統合しました。現在はWeb Speech APIを使用しており、将来的にGemini APIの音声合成エンドポイントが利用可能になった際に容易に移行できる設計になっています。

## 実装ファイル

### 1. **gemini-api.ts** - 音声合成エンジン

Web Speech APIを使用した多言語音声合成クライアントです。

**主要機能:**
- 多言語対応 (en, jp, fr, de, es, ko)
- フレーズの自動翻訳 ("Ready" → "レディ" など)
- フォールバックトーン音の再生
- ブラウザネイティブの音声合成

**API:**
```typescript
import { getGeminiAudioEngine, triggerVoice } from './gemini-api';

// 基本的な使い方
await triggerVoice('Ready', 'jp'); // 日本語で「レディ」と発声

// フォールバックトーン付き
await triggerVoice('Action', 'en', {
  freq: 1000,
  duration: 0.6,
  type: 'square'
});

// エンジンに直接アクセス
const engine = getGeminiAudioEngine();
await engine.speak('カスタムテキスト', { language: 'jp', rate: 1.1 });
engine.playTone(440, 0.5, 'sine'); // トーン音を直接再生
```

### 2. **index.tsx** - AudioEngine統合

既存のAudioEngineを更新し、Gemini Audio APIと統合しました。

**変更点:**
- `AudioEngine.trigger()` が非同期関数に変更
- Web Speech APIによる実際の音声合成
- 失敗時のフォールバックトーン再生

## サポートされている言語

| 言語コード | 言語名 | ロケール | 標準フレーズ |
|----------|--------|---------|-------------|
| `en` | English | en-US | Ready, Action, Cut |
| `jp` | Japanese | ja-JP | レディ, アクション, カット |
| `fr` | French | fr-FR | Prêt, Action, Coupez |
| `de` | German | de-DE | Bereit, Action, Schnitt |
| `es` | Spanish | es-ES | Listo, Acción, Corte |
| `ko` | Korean | ko-KR | 준비, 액션, 컷 |

## 使用方法

### アプリケーション設定から言語を選択

1. HOSTモードでアプリを起動
2. 右上の設定アイコンをクリック
3. "Voice Language"セクションで言語を選択
4. シーケンスを開始すると選択した言語で音声が再生されます

### プログラムから直接使用

```typescript
import { triggerVoice } from './gemini-api';

// カウントダウン
await triggerVoice('3', 'en');
await triggerVoice('2', 'en');
await triggerVoice('1', 'en');

// アクションコール
await triggerVoice('Action', 'jp');

// カスタムテキスト
await triggerVoice('Gate check', 'en');
```

## 技術仕様

### Web Speech API

現在の実装はブラウザの[Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)を使用しています。

**利点:**
- 追加のAPIキー不要
- オフラインでも動作
- 低レイテンシ
- ブラウザネイティブサポート

**対応ブラウザ:**
- Chrome/Edge: 完全対応
- Safari: 完全対応
- Firefox: 部分対応

### フォールバックメカニズム

音声合成が失敗した場合、自動的にトーン音にフォールバックします。

```typescript
// Ready: 660Hz サイン波 0.4秒
// Action: 1000Hz 方形波 0.6秒
// Cut: 440Hz ノコギリ波 0.8秒
// カウントダウン: 880Hz/800Hz 三角波/サイン波
```

## 将来の拡張

### Gemini Audio API統合

Google Gemini APIが音声合成エンドポイントを提供した際、以下の手順で移行可能です:

1. **gemini-api.ts**の`speak()`メソッドを更新
2. Gemini APIを使用した音声生成ロジックを追加
3. 生成した音声をキャッシュして再利用
4. Web Speech APIをフォールバックとして保持

```typescript
// 将来の実装例
async speak(text: string, config: VoiceConfig): Promise<void> {
  try {
    // Gemini APIで音声生成
    const audioData = await this.generateWithGemini(text, config);
    await this.playAudio(audioData);
  } catch (error) {
    // フォールバック: Web Speech API
    console.warn('Gemini API failed, using Web Speech API');
    await this.speakWithWebAPI(text, config);
  }
}
```

### カスタム音声ファイル

S3やローカルアセットから音声ファイルを読み込む機能:

```typescript
// assets/audio/en/ready.mp3
// assets/audio/jp/ready.mp3
const audioPath = `/assets/audio/${language}/${text}.mp3`;
const audio = new Audio(audioPath);
await audio.play();
```

## トラブルシューティング

### 音声が再生されない

1. **ブラウザの音声が有効か確認**
   - システムのボリュームをチェック
   - ブラウザのタブがミュートされていないか確認

2. **Web Speech APIがサポートされているか確認**
   ```javascript
   console.log('Speech Synthesis:', 'speechSynthesis' in window);
   console.log('Voices:', speechSynthesis.getVoices());
   ```

3. **iOS/Safariの制限**
   - ユーザーアクションが必要（ボタンクリックなど）
   - "Click to Enable Audio"ボタンをクリック

### 音声の品質が悪い

Web Speech APIの音声品質はブラウザとOSに依存します。

**改善方法:**
- Chromeを使用（最良の音声品質）
- OSの言語設定で対応言語パックをインストール
- 将来的にGemini Audio APIに移行

### 言語が切り替わらない

1. **ボイスが利用可能か確認**
   ```javascript
   const voices = speechSynthesis.getVoices();
   console.log(voices.map(v => v.lang));
   ```

2. **ブラウザを再起動**
   音声リストの初期化が必要な場合があります

## パフォーマンス

### バンドルサイズ

Gemini Audio統合により、バンドルサイズが削減されました:

- **以前:** 450.98 KB (gzip: 110.94 KB)
- **現在:** 233.99 KB (gzip: 71.56 KB)
- **削減:** 216.99 KB (-48%)

### レイテンシ

- Web Speech API: ~50-100ms
- トーン音: <10ms (即座)

## セキュリティ

### APIキー

現在の実装ではAPIキーは不要です。将来Gemini Audio APIを使用する場合:

```bash
# .env.local
GEMINI_API_KEY=your_api_key_here
```

環境変数は既に`vite.config.ts`で設定済みです。

## テスト

```bash
# ビルド
npm run build

# 開発サーバー起動
npm run dev

# 型チェック
npx tsc --noEmit gemini-api.ts index.tsx
```

## 参考資料

- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [SpeechSynthesis - MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)
- [Google Gemini API Documentation](https://ai.google.dev/docs)

## ライセンス

このプロジェクトはSyncSlateプロジェクトと同じライセンスに従います。
