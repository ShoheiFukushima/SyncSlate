/**
 * 音声再生管理のカスタムフック
 *
 * Phase 1: 基本機能
 * - テキスト読み上げ(0.8秒制限)
 * - Web Speech APIを使用
 *
 * Phase 2: 効果音機能
 * - プリセット効果音（鉄砲、電話コール）
 * - AudioContext APIを使用
 */

import { useRef, useCallback } from 'react';
import {
  generateGunshotSound,
  generatePhoneRingSound,
  playSound,
  playPhoneRings,
} from '../utils/sound-effects';

/**
 * Sleep関数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 音声再生フックの戻り値型
 */
interface UseAudioPlaybackReturn {
  /** テキスト読み上げ(0.8秒制限) */
  speakTextWithLimit: (text: string, maxDuration?: number) => Promise<void>;

  /** 鉄砲効果音を再生 */
  playGunshotSound: () => Promise<void>;

  /** 電話コールを再生 */
  playPhoneRingSound: (rings: number) => Promise<void>;

  /** カスタム音声を再生 */
  playCustomAudio: (audioUrl: string) => Promise<void>;

  /** 現在再生中の音声を停止 */
  stopCurrentAudio: () => void;

  /** 音声再生中かどうか */
  isPlaying: boolean;
}

/**
 * 音声再生管理のカスタムフック
 *
 * @returns 音声再生オブジェクト
 */
export function useAudioPlayback(): UseAudioPlaybackReturn {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * AudioContextを取得（遅延初期化）
   */
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  /**
   * 鉄砲効果音を再生
   */
  const playGunshotSoundHandler = useCallback(async (): Promise<void> => {
    try {
      isPlayingRef.current = true;
      const audioContext = getAudioContext();
      const buffer = generateGunshotSound(audioContext);
      await playSound(audioContext, buffer);
      isPlayingRef.current = false;
    } catch (error) {
      console.error('[Audio] Failed to play gunshot sound:', error);
      isPlayingRef.current = false;
    }
  }, [getAudioContext]);

  /**
   * 電話コールを再生
   *
   * @param rings コール回数（1-5）
   */
  const playPhoneRingSoundHandler = useCallback(
    async (rings: number): Promise<void> => {
      try {
        isPlayingRef.current = true;
        const audioContext = getAudioContext();
        await playPhoneRings(audioContext, rings);
        isPlayingRef.current = false;
      } catch (error) {
        console.error('[Audio] Failed to play phone ring sound:', error);
        isPlayingRef.current = false;
      }
    },
    [getAudioContext]
  );

  /**
   * カスタム音声を再生
   *
   * @param audioUrl Base64エンコードされた音声データURL
   */
  const playCustomAudioHandler = useCallback(
    async (audioUrl: string): Promise<void> => {
      try {
        // 既存の音声を停止
        if (customAudioRef.current) {
          customAudioRef.current.pause();
          customAudioRef.current.currentTime = 0;
        }

        isPlayingRef.current = true;

        return new Promise<void>((resolve, reject) => {
          const audio = new Audio(audioUrl);
          customAudioRef.current = audio;

          audio.onended = () => {
            isPlayingRef.current = false;
            customAudioRef.current = null;
            resolve();
          };

          audio.onerror = (error) => {
            console.error('[Audio] Failed to play custom audio:', error);
            isPlayingRef.current = false;
            customAudioRef.current = null;
            reject(error);
          };

          audio.play().catch((error) => {
            console.error('[Audio] Failed to start custom audio playback:', error);
            isPlayingRef.current = false;
            customAudioRef.current = null;
            reject(error);
          });
        });
      } catch (error) {
        console.error('[Audio] Failed to play custom audio:', error);
        isPlayingRef.current = false;
        throw error;
      }
    },
    []
  );

  /**
   * テキスト読み上げ(0.8秒制限)
   *
   * @param text 読み上げるテキスト
   * @param maxDuration 最大再生時間(秒、デフォルト: 0.8)
   */
  const speakTextWithLimit = useCallback(
    async (text: string, maxDuration: number = 0.8): Promise<void> => {
      // 空のテキストは読み上げない
      if (!text || text.trim().length === 0) {
        return;
      }

      // Web Speech API が利用可能かチェック
      if (!('speechSynthesis' in window)) {
        console.warn('[Audio] Web Speech API not supported');
        return;
      }

      const synth = window.speechSynthesis;

      // 既存の再生を停止
      if (utteranceRef.current) {
        synth.cancel();
      }

      // 既存のタイムアウトをクリア
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      return new Promise<void>((resolve) => {
        isPlayingRef.current = true;

        // SpeechSynthesisUtteranceを作成
        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        // 日本語音声を設定
        const voices = synth.getVoices();
        const japaneseVoice = voices.find(v => v.lang.startsWith('ja'));
        if (japaneseVoice) {
          utterance.voice = japaneseVoice;
        }
        utterance.lang = 'ja-JP';

        // 速度を調整(1.0が標準速度)
        utterance.rate = 1.0;

        // イベントハンドラ
        utterance.onend = () => {
          isPlayingRef.current = false;
          utteranceRef.current = null;
          if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          resolve();
        };

        utterance.onerror = (event) => {
          console.error('[Audio] Speech synthesis error:', event);
          isPlayingRef.current = false;
          utteranceRef.current = null;
          if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          resolve();
        };

        // 再生開始
        synth.speak(utterance);

        // maxDuration秒後に強制停止
        timeoutRef.current = window.setTimeout(() => {
          if (utteranceRef.current === utterance) {
            synth.cancel();
            isPlayingRef.current = false;
            utteranceRef.current = null;
            resolve();
          }
        }, maxDuration * 1000);
      });
    },
    []
  );

  /**
   * 現在再生中の音声を停止
   */
  const stopCurrentAudio = useCallback(() => {
    // テキスト読み上げを停止
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (utteranceRef.current) {
      utteranceRef.current = null;
    }

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // カスタム音声を停止
    if (customAudioRef.current) {
      customAudioRef.current.pause();
      customAudioRef.current.currentTime = 0;
      customAudioRef.current = null;
    }

    isPlayingRef.current = false;
  }, []);

  return {
    speakTextWithLimit,
    playGunshotSound: playGunshotSoundHandler,
    playPhoneRingSound: playPhoneRingSoundHandler,
    playCustomAudio: playCustomAudioHandler,
    stopCurrentAudio,
    isPlaying: isPlayingRef.current,
  };
}
