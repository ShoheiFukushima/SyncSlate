/**
 * Gemini API Client for Text-to-Speech
 *
 * This module provides a production-ready interface for generating
 * voice audio using Web Speech API with fallback support.
 *
 * Features:
 * - Multi-language support (en, jp, fr, de, es, ko)
 * - Web Speech API for browser-native synthesis
 * - Fallback to tone synthesis on API errors
 * - Future-ready for Gemini Audio API integration
 *
 * ARCHITECTURE NOTE:
 * Currently uses Web Speech API as Gemini 2.0 Flash does not yet
 * provide direct audio synthesis endpoints in the SDK. Once available,
 * this can be migrated to use Gemini's native TTS capabilities.
 */

export type VoiceLanguage = 'en' | 'jp' | 'fr' | 'de' | 'es' | 'ko';

interface VoiceConfig {
  language: VoiceLanguage;
  rate?: number; // 0.5 to 2.0
  pitch?: number; // 0 to 2.0
  volume?: number; // 0 to 1.0
}

// Language-specific voice configurations for Web Speech API
const VOICE_CONFIGS: Record<VoiceLanguage, { locale: string; voiceName?: string }> = {
  en: { locale: 'en-US' },
  jp: { locale: 'ja-JP' },
  fr: { locale: 'fr-FR' },
  de: { locale: 'de-DE' },
  es: { locale: 'es-ES' },
  ko: { locale: 'ko-KR' },
};

// Phrase translations for standard cues
const PHRASE_TRANSLATIONS: Record<VoiceLanguage, Record<string, string>> = {
  en: { ready: 'Ready', action: 'Action', cut: 'Cut' },
  jp: { ready: 'レディ', action: 'アクション', cut: 'カット' },
  fr: { ready: 'Prêt', action: 'Action', cut: 'Coupez' },
  de: { ready: 'Bereit', action: 'Action', cut: 'Schnitt' },
  es: { ready: 'Listo', action: 'Acción', cut: 'Corte' },
  ko: { ready: '준비', action: '액션', cut: '컷' },
};

class GeminiAudioEngine {
  private audioContext: AudioContext | null = null;
  private speechSynth: SpeechSynthesis | null = null;
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private audioBufferCache: Map<string, AudioBuffer> = new Map();

  constructor() {
    this.initSpeech();
  }

  /**
   * Initialize Web Speech API
   */
  private initSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.speechSynth = window.speechSynthesis;
      console.log('[GeminiAudio] Web Speech API initialized');
    } else {
      console.warn('[GeminiAudio] Web Speech API not supported');
    }
  }

  /**
   * Get or create AudioContext
   */
  private getAudioContext(): AudioContext | null {
    if (!this.audioContext) {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtor) {
        this.audioContext = new AudioCtor();
      }
    }
    return this.audioContext;
  }

  /**
   * Translate standard phrases based on language
   */
  private translatePhrase(text: string, language: VoiceLanguage): string {
    const normalized = text.toLowerCase().trim();
    const translations = PHRASE_TRANSLATIONS[language];

    if (translations[normalized]) {
      return translations[normalized];
    }

    return text; // Return original if no translation
  }

  /**
   * Find best matching voice for language
   */
  private findVoice(language: VoiceLanguage): SpeechSynthesisVoice | null {
    if (!this.speechSynth) return null;

    const voices = this.speechSynth.getVoices();
    const config = VOICE_CONFIGS[language];

    // Try to find exact locale match
    const exactMatch = voices.find(v => v.lang === config.locale);
    if (exactMatch) return exactMatch;

    // Fallback to language code match (e.g., 'ja' from 'ja-JP')
    const langCode = config.locale.split('-')[0];
    const langMatch = voices.find(v => v.lang.startsWith(langCode));
    if (langMatch) return langMatch;

    // Last resort: return default voice
    return voices[0] || null;
  }

  /**
   * Play Japanese voice file for numbers (0-60) using Web Audio API
   * Uses AudioContext and AudioBuffer for better Safari/iOS compatibility
   *
   * @param num - Number to speak (0-60)
   * @returns Promise that resolves when playback completes
   */
  private async playJapaneseNumberVoice(num: number): Promise<void> {
    if (num < 0 || num > 60) {
      console.error(`[GeminiAudio] Number out of range: ${num} (must be 0-60)`);
      throw new Error(`Number out of range: ${num} (must be 0-60)`);
    }

    const ctx = this.getAudioContext();
    if (!ctx) {
      console.error('[GeminiAudio] AudioContext not available');
      throw new Error('AudioContext not available');
    }

    // Resume AudioContext if suspended (required for Safari/iOS)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const audioKey = `jp-num-${num}`;
    const paddedNum = num.toString().padStart(3, '0');
    const audioPath = `/voices/num${paddedNum}_02_01.wav`;

    // Check if buffer is already cached
    if (this.audioBufferCache.has(audioKey)) {
      console.log(`[GeminiAudio] Playing cached AudioBuffer for: ${num}`);
      const buffer = this.audioBufferCache.get(audioKey)!;
      return this.playAudioBuffer(buffer, ctx);
    }

    // Load and decode audio file
    console.log(`[GeminiAudio] Loading Japanese voice file: ${audioPath}`);
    try {
      const response = await fetch(audioPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      console.log(`[GeminiAudio] Audio decoded successfully: ${audioPath}`);
      // Cache the decoded buffer
      this.audioBufferCache.set(audioKey, audioBuffer);

      return this.playAudioBuffer(audioBuffer, ctx);
    } catch (error) {
      console.error(`[GeminiAudio] Failed to load/decode audio: ${audioPath}`, error);
      throw error;
    }
  }

  /**
   * Play an AudioBuffer using Web Audio API
   */
  private playAudioBuffer(buffer: AudioBuffer, ctx: AudioContext): Promise<void> {
    return new Promise((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      source.onended = () => {
        console.log('[GeminiAudio] AudioBuffer playback completed');
        resolve();
      };

      source.start(0);
      console.log('[GeminiAudio] AudioBuffer playback started');
    });
  }

  /**
   * Speak text using Web Speech API
   *
   * @param text - Text to speak
   * @param config - Voice configuration
   * @returns Promise that resolves when speech completes
   */
  async speak(text: string, config: VoiceConfig): Promise<void> {
    // For Japanese language, check if the text is a number (0-60)
    // If so, use pre-recorded voice files instead of Web Speech API
    if (config.language === 'jp') {
      const num = parseInt(text.trim(), 10);
      if (!isNaN(num) && num >= 0 && num <= 60) {
        console.log(`[GeminiAudio] Playing Japanese voice file for number: ${num}`);
        try {
          await this.playJapaneseNumberVoice(num);
          return;
        } catch (error) {
          console.warn('[GeminiAudio] Failed to play Japanese voice file, falling back to Web Speech API:', error);
          // Fall through to Web Speech API
        }
      }
    }

    if (!this.speechSynth) {
      console.warn('[GeminiAudio] Web Speech API not available');
      throw new Error('Speech synthesis not supported');
    }

    // Translate standard phrases
    const translatedText = this.translatePhrase(text, config.language);
    console.log(`[GeminiAudio] Speaking: "${translatedText}" (${config.language})`);

    return new Promise((resolve, reject) => {
      // Wait for any ongoing speech to complete before starting new one
      // This prevents "interrupted" errors
      const waitForSpeechEnd = () => {
        if (this.speechSynth!.speaking) {
          setTimeout(waitForSpeechEnd, 50);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(translatedText);

        // Find appropriate voice
        const voice = this.findVoice(config.language);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = VOICE_CONFIGS[config.language].locale;
        }

        // Apply voice parameters
        utterance.rate = config.rate || 1.0;
        utterance.pitch = config.pitch || 1.0;
        utterance.volume = config.volume || 1.0;

        utterance.onend = () => resolve();
        utterance.onerror = (event) => {
          console.error('[GeminiAudio] Speech error:', event);
          // Don't reject on "interrupted" or "canceled" errors
          if (event.error === 'interrupted' || event.error === 'canceled') {
            console.warn('[GeminiAudio] Speech was interrupted/canceled, resolving anyway');
            resolve();
          } else {
            reject(event.error);
          }
        };

        this.speechSynth!.speak(utterance);
      };

      waitForSpeechEnd();
    });
  }

  /**
   * Play tone as fallback
   */
  playTone(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    } catch (error) {
      console.warn('[GeminiAudio] Tone playback error:', error);
    }
  }

  /**
   * Resume audio context (required for iOS)
   */
  resume(): void {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(e => console.warn('[GeminiAudio] Resume failed:', e));
    }
  }

  /**
   * Get available voices
   */
  getVoices(): SpeechSynthesisVoice[] {
    return this.speechSynth?.getVoices() || [];
  }
}

// Singleton instance
let engineInstance: GeminiAudioEngine | null = null;

/**
 * Get or create Gemini Audio Engine instance
 */
export const getGeminiAudioEngine = (): GeminiAudioEngine => {
  if (!engineInstance) {
    engineInstance = new GeminiAudioEngine();
  }
  return engineInstance;
};

/**
 * High-level API for triggering voice cues
 *
 * @param text - Text to speak (e.g., "Ready", "Action", "Cut", "5")
 * @param language - Voice language
 * @param fallbackTone - Optional tone settings for fallback
 */
export const triggerVoice = async (
  text: string,
  language: VoiceLanguage = 'en',
  fallbackTone?: { freq: number; duration: number; type?: OscillatorType }
): Promise<void> => {
  const engine = getGeminiAudioEngine();

  try {
    // Attempt to speak using Web Speech API
    await engine.speak(text, { language, rate: 1.1, pitch: 1.0, volume: 1.0 });
  } catch (error) {
    console.warn('[GeminiAudio] Voice playback failed, using fallback:', error);

    // Fallback to tone if voice fails
    if (fallbackTone) {
      engine.playTone(
        fallbackTone.freq,
        fallbackTone.duration,
        fallbackTone.type || 'sine'
      );
    }
  }
};

export default getGeminiAudioEngine;
