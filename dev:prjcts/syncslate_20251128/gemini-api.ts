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
  private preloadProgress: number = 0;
  private isPreloading: boolean = false;
  private preloadCompleted: boolean = false;
  private muted: boolean = false;

  constructor() {
    this.initSpeech();
  }

  /**
   * Initialize Web Speech API
   */
  private initSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.speechSynth = window.speechSynthesis;
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
   * Ensure AudioContext is in 'running' state
   *
   * iOS/Safari requires explicit waiting for state transition.
   * This method guarantees the AudioContext is ready before audio playback.
   *
   * @param maxWaitMs - Maximum wait time in milliseconds (default: 1000ms)
   * @returns Promise that resolves when AudioContext is running
   * @throws Error if AudioContext fails to resume within timeout
   */
  private async ensureAudioContextRunning(maxWaitMs: number = 1000): Promise<void> {
    const ctx = this.getAudioContext();
    if (!ctx) {
      throw new Error('AudioContext not available');
    }

    // Already running, no action needed
    if (ctx.state === 'running') {
      return;
    }

    // Resume if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Wait for state to become 'running' with timeout
    const startTime = Date.now();
    while (ctx.state !== 'running') {
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(`AudioContext failed to resume within ${maxWaitMs}ms (state: ${ctx.state})`);
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    console.log(`[GeminiAudio] AudioContext is now running (took ${Date.now() - startTime}ms)`);
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
   * @throws Error if AudioContext is unavailable, file loading fails, or playback fails
   */
  private async playJapaneseNumberVoice(num: number): Promise<void> {
    if (num < 0 || num > 60) {
      const error = new Error(`Number out of range: ${num} (must be 0-60)`);
      console.error('[GeminiAudio]', error.message);
      throw error;
    }

    // Ensure AudioContext is running before attempting playback
    try {
      await this.ensureAudioContextRunning();
    } catch (error) {
      console.error('[GeminiAudio] Failed to resume AudioContext:', error);
      throw error;
    }

    const ctx = this.getAudioContext()!; // Safe after ensureAudioContextRunning()
    const audioKey = `jp-num-${num}`;
    const paddedNum = num.toString().padStart(3, '0');
    const audioPath = `/voices/num${paddedNum}_02_01.wav`;

    // Check if buffer is already cached
    if (this.audioBufferCache.has(audioKey)) {
      const buffer = this.audioBufferCache.get(audioKey)!;
      return this.playAudioBuffer(buffer, ctx);
    }

    // Load and decode audio file
    try {
      const response = await fetch(audioPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Cache the decoded buffer
      this.audioBufferCache.set(audioKey, audioBuffer);

      return this.playAudioBuffer(audioBuffer, ctx);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[GeminiAudio] Failed to load/decode audio: ${audioPath}`, errorMsg);
      throw new Error(`Failed to load Japanese voice file: ${errorMsg}`);
    }
  }

  /**
   * Play an AudioBuffer using Web Audio API
   *
   * @param buffer - AudioBuffer to play
   * @param ctx - AudioContext instance
   * @returns Promise that resolves when playback completes
   * @throws Error if playback fails
   */
  private playAudioBuffer(buffer: AudioBuffer, ctx: AudioContext): Promise<void> {
    return new Promise((resolve, reject) => {
      // Skip playback if muted
      if (this.muted) {
        console.log('[GeminiAudio] Playback skipped (muted)');
        resolve();
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Create GainNode for volume control (iOS compatibility)
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.0; // Full volume

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.onended = () => {
        resolve();
      };

      // Reject on error instead of silently resolving
      let hasStarted = false;
      try {
        source.start(0);
        hasStarted = true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[GeminiAudio] Failed to start AudioBuffer playback:', errorMsg);
        reject(new Error(`AudioBuffer playback failed: ${errorMsg}`));
      }

      // Safety timeout: if source doesn't end within reasonable time, reject
      // Most voice files are < 2 seconds, so 5 seconds is generous
      if (hasStarted) {
        setTimeout(() => {
          console.warn('[GeminiAudio] AudioBuffer playback timeout - forcing completion');
          resolve(); // Resolve (not reject) to avoid blocking subsequent audio
        }, 5000);
      }
    });
  }

  /**
   * Speak text using Web Speech API
   *
   * @param text - Text to speak
   * @param config - Voice configuration
   * @returns Promise that resolves when speech completes
   * @throws Error if speech synthesis fails and no fallback is available
   */
  async speak(text: string, config: VoiceConfig): Promise<void> {
    // Skip speech if muted
    if (this.muted) {
      console.log('[GeminiAudio] Speech skipped (muted)');
      return;
    }

    // For Japanese language, check if the text is a number (0-60)
    // If so, use pre-recorded voice files instead of Web Speech API
    if (config.language === 'jp') {
      const num = parseInt(text.trim(), 10);
      if (!isNaN(num) && num >= 0 && num <= 60) {
        try {
          await this.playJapaneseNumberVoice(num);
          return; // Success - no need for Web Speech API
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.warn('[GeminiAudio] Japanese voice file failed, trying Web Speech API:', errorMsg);
          // Fall through to Web Speech API as fallback
        }
      }
    }

    // Web Speech API fallback
    if (!this.speechSynth) {
      const error = new Error('Speech synthesis not supported in this browser');
      console.error('[GeminiAudio]', error.message);
      throw error;
    }

    // Translate standard phrases
    const translatedText = this.translatePhrase(text, config.language);

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
          console.error('[GeminiAudio] Speech synthesis error:', event.error);
          // Don't reject on "interrupted" or "canceled" errors - these are recoverable
          if (event.error === 'interrupted' || event.error === 'canceled') {
            console.warn('[GeminiAudio] Speech was interrupted/canceled, resolving anyway');
            resolve();
          } else {
            reject(new Error(`Speech synthesis failed: ${event.error}`));
          }
        };

        this.speechSynth!.speak(utterance);
      };

      waitForSpeechEnd();
    });
  }

  /**
   * Play tone as fallback
   *
   * Synchronous interface for backward compatibility, but handles AudioContext state properly.
   * Use this when you need immediate audio feedback without async/await.
   *
   * @param frequency - Frequency in Hz
   * @param duration - Duration in seconds
   * @param type - Oscillator type (sine, square, sawtooth, triangle)
   */
  playTone(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    // Skip tone if muted
    if (this.muted) {
      console.log('[GeminiAudio] Tone skipped (muted)');
      return;
    }

    const ctx = this.getAudioContext();
    if (!ctx) {
      console.warn('[GeminiAudio] AudioContext not available for tone playback');
      return;
    }

    // Resume if suspended (fire-and-forget is acceptable for tones)
    if (ctx.state === 'suspended') {
      ctx.resume().catch((error) => {
        console.error('[GeminiAudio] Failed to resume AudioContext for tone:', error);
      });
    }

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
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[GeminiAudio] Tone playback error:', errorMsg);
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

  /**
   * Preload Japanese voice files (0-60) to eliminate playback delays
   *
   * This method preloads all countdown voice files in the background
   * to ensure instant playback when needed. Uses progressive loading
   * to avoid blocking the UI.
   *
   * @param range - Range to preload (default: 0-60)
   * @param onProgress - Optional callback for progress updates (0-100)
   * @returns Promise that resolves when preloading completes
   */
  async preloadJapaneseVoices(
    range: { start: number; end: number } = { start: 0, end: 60 },
    onProgress?: (progress: number) => void
  ): Promise<void> {
    if (this.isPreloading) {
      console.log('[GeminiAudio] Preload already in progress');
      return;
    }

    if (this.preloadCompleted) {
      console.log('[GeminiAudio] Preload already completed');
      return;
    }

    this.isPreloading = true;
    this.preloadProgress = 0;

    const ctx = this.getAudioContext();
    if (!ctx) {
      console.error('[GeminiAudio] AudioContext not available for preload');
      this.isPreloading = false;
      return;
    }

    // Resume AudioContext if suspended
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (error) {
        console.warn('[GeminiAudio] Failed to resume AudioContext:', error);
      }
    }

    const { start, end } = range;
    const total = end - start + 1;
    let loaded = 0;
    let succeeded = 0;
    let failed = 0;

    console.log(`[GeminiAudio] Starting preload: ${start}-${end} (${total} files)`);

    // Load files in batches to avoid overwhelming the network
    const batchSize = 5;
    for (let i = start; i <= end; i += batchSize) {
      const batchEnd = Math.min(i + batchSize - 1, end);
      const batch: Promise<void>[] = [];

      for (let num = i; num <= batchEnd; num++) {
        const audioKey = `jp-num-${num}`;

        // Skip if already cached
        if (this.audioBufferCache.has(audioKey)) {
          loaded++;
          succeeded++;
          this.preloadProgress = Math.round((loaded / total) * 100);
          onProgress?.(this.preloadProgress);
          continue;
        }

        const paddedNum = num.toString().padStart(3, '0');
        const audioPath = `/voices/num${paddedNum}_02_01.wav`;

        // Load and decode audio file
        const loadPromise = (async () => {
          try {
            const response = await fetch(audioPath);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

            // Cache the decoded buffer
            this.audioBufferCache.set(audioKey, audioBuffer);
            succeeded++;
          } catch (error) {
            console.warn(`[GeminiAudio] Failed to preload ${audioPath}:`, error);
            failed++;
          } finally {
            loaded++;
            this.preloadProgress = Math.round((loaded / total) * 100);
            onProgress?.(this.preloadProgress);
          }
        })();

        batch.push(loadPromise);
      }

      // Wait for current batch to complete before starting next
      await Promise.all(batch);

      // Small delay between batches to prevent network congestion
      if (batchEnd < end) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    this.isPreloading = false;
    this.preloadCompleted = true;

    console.log(`[GeminiAudio] Preload completed: ${succeeded} succeeded, ${failed} failed`);
  }

  /**
   * Get preload progress (0-100)
   */
  getPreloadProgress(): number {
    return this.preloadProgress;
  }

  /**
   * Check if preload is in progress
   */
  isPreloadingVoices(): boolean {
    return this.isPreloading;
  }

  /**
   * Check if preload is completed
   */
  isPreloadComplete(): boolean {
    return this.preloadCompleted;
  }

  /**
   * Set muted state
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    console.log(`[GeminiAudio] Muted: ${muted}`);
  }

  /**
   * Get muted state
   */
  isMuted(): boolean {
    return this.muted;
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
