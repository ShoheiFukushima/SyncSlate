/**
 * プリセット効果音生成ユーティリティ
 *
 * AudioContext APIを使用して効果音を合成します
 */

/**
 * 銃声効果音を生成
 */
export function generateGunshotSound(audioContext: AudioContext): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const duration = 0.15; // 150ms
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // ノイズバースト + エンベロープで銃声を模倣
  for (let i = 0; i < length; i++) {
    // ホワイトノイズ
    const noise = Math.random() * 2 - 1;

    // 急激な減衰エンベロープ
    const envelope = Math.exp(-i / (sampleRate * 0.02));

    // ローパスフィルター効果（簡易版）
    const filtered = i > 0 ? data[i - 1] * 0.3 + noise * 0.7 : noise;

    data[i] = filtered * envelope * 0.5;
  }

  return buffer;
}

/**
 * 電話のコール音を生成（1回分）
 */
export function generatePhoneRingSound(audioContext: AudioContext): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const duration = 0.8; // 800ms (リング1回)
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // 電話のベル音: 2つの周波数の合成
  const freq1 = 440; // A4
  const freq2 = 480; // 少しずれた周波数
  const ringDuration = 0.4; // リング音の長さ
  const silenceDuration = 0.4; // 無音の長さ

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const phase = t % 1.0; // 1秒周期

    if (phase < ringDuration) {
      // リング音
      const envelope = Math.sin((phase / ringDuration) * Math.PI); // 山型エンベロープ
      const tone1 = Math.sin(2 * Math.PI * freq1 * t);
      const tone2 = Math.sin(2 * Math.PI * freq2 * t);
      data[i] = (tone1 + tone2) * 0.3 * envelope;
    } else {
      // 無音
      data[i] = 0;
    }
  }

  return buffer;
}

/**
 * 効果音を再生
 */
export async function playSound(
  audioContext: AudioContext,
  buffer: AudioBuffer
): Promise<void> {
  return new Promise<void>((resolve) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    source.onended = () => resolve();
    source.start(audioContext.currentTime);
  });
}

/**
 * 電話コールを指定回数再生
 */
export async function playPhoneRings(
  audioContext: AudioContext,
  rings: number
): Promise<void> {
  const ringBuffer = generatePhoneRingSound(audioContext);

  for (let i = 0; i < rings; i++) {
    await playSound(audioContext, ringBuffer);

    // コール間の間隔（最後のコールの後は不要）
    if (i < rings - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}
