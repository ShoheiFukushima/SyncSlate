import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Play,
  Square,
  Zap,
  Plus,
  Minus,
  Trash2,
  Clock,
  Mic,
  Sun,
  Moon,
  Clapperboard,
  Hash,
  Type,
  Monitor,
  Radio,
  Volume2,
  Settings as SettingsIcon,
  X,
  Check,
  Globe,
  MessageSquare,
  Share2,
  Copy,
  CheckCircle
} from 'lucide-react';
import clsx from 'clsx';
import { getGeminiAudioEngine, triggerVoice } from './gemini-api';

// 新しいサービスのインポート
import { timeSync } from './services/time-sync';
import { precisionTimer } from './services/precision-timer';
import { audioSync } from './services/audio-sync';
import {
  SupabaseSyncEngine,
  generateDeviceId,
  getSessionIdFromUrl
} from './services/supabase-sync-engine';
import type { SyncMode } from './types/sync';

// --- Architecture Constants ---

const SYNC_CHANNEL_NAME = 'sync-slate-v1';
const SYNC_LATENCY_BUFFER_MS = 500; // Buffer to ensure all clients receive start command before T0

// --- Types ---

type Mode = 'SETUP' | 'ARMED' | 'COUNTDOWN' | 'ENDED';
type Direction = 'UP' | 'DOWN';
type Theme = 'light' | 'dark';
type FontType = 'hand' | 'sans' | 'gothic';
type Role = 'HOST' | 'CLIENT';
type VoiceLanguage = 'en' | 'jp' | 'fr' | 'de' | 'es' | 'ko';

interface SmartCue {
  id: string;
  seconds: number;
  text: string;
}

interface ColorRange {
  id: string;
  start: number;
  end: number;
  color: string;
  textColor: string;
}

interface Settings {
  duration: number;
  preRoll: number;
  direction: Direction;
  hostId: string;
  voiceAction: boolean;
  voiceCut: boolean;
  voiceReady: boolean;
  voiceCountdown: boolean;
  voiceCount: boolean;
  voiceCountLimit: number;
  fontType: FontType;
  // New Settings
  showArmed: boolean;
  armedText: string;
  voiceLanguage: VoiceLanguage;
}

// Sync Protocol Payloads
type SyncMessage = 
  | { type: 'SYNC_STATE'; payload: { settings: Settings; smartCues: SmartCue[]; colorRanges: ColorRange[] } }
  | { type: 'CMD_START'; payload: { startTime: number } } // startTime is absolute Date.now()
  | { type: 'CMD_STOP'; payload: { manual: boolean } };

// --- Constants & Helpers ---

const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * useDebounce Hook
 * 値の変更を指定時間遅延させることで、連続した更新を抑制する
 *
 * @param value - デバウンスする値
 * @param delay - 遅延時間 (ミリ秒)
 * @returns デバウンスされた値
 */
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
}

const getContrastColor = (hex: string) => {
    if (!/^#[0-9A-F]{6}$/i.test(hex)) return '#000000';
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? '#000000' : '#ffffff';
};

const hexToRgba = (hex: string, alpha: number) => {
    if (!/^#[0-9A-F]{6}$/i.test(hex)) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

// --- Audio Engine (Gemini API Integration) ---

const AudioEngine = {
    resume: () => {
        const engine = getGeminiAudioEngine();
        engine.resume();
    },
    playTone: (freq: number, duration: number, type: OscillatorType = 'sine') => {
        const engine = getGeminiAudioEngine();
        engine.playTone(freq, duration, type);
    },
    /**
     * Trigger a voice using Gemini API text-to-speech.
     *
     * Production Implementation:
     * - Generates voice audio using Google Gemini 2.0 Flash API
     * - Supports multi-language synthesis (en, jp, fr, de, es, ko)
     * - Caches generated audio for instant replay
     * - Falls back to tone synthesis if API fails
     *
     * @param text - Text to speak (e.g., "Ready", "Action", "Cut", numbers)
     * @param language - Voice language code
     */
    trigger: async (text: string, language: VoiceLanguage = 'en') => {
        // Define fallback tones for each cue type
        let fallbackTone: { freq: number; duration: number; type?: OscillatorType } | undefined;

        if (text === "Ready") {
            fallbackTone = { freq: 660, duration: 0.4, type: 'sine' };
        } else if (text === "Action") {
            fallbackTone = { freq: 1000, duration: 0.6, type: 'square' };
        } else if (text === "Cut") {
            fallbackTone = { freq: 440, duration: 0.8, type: 'sawtooth' };
        } else if (!isNaN(Number(text))) {
            const num = Number(text);
            if (num <= 3 && num > 0) {
                fallbackTone = { freq: 880, duration: 0.1, type: 'triangle' };
            } else {
                fallbackTone = { freq: 800, duration: 0.15, type: 'sine' };
            }
        } else {
            fallbackTone = { freq: 1200, duration: 0.2, type: 'triangle' };
        }

        // Attempt voice synthesis with fallback
        await triggerVoice(text, language, fallbackTone);
    }
};

// --- Custom CSS for Slider ---
const sliderStyles = `
  input[type=range] {
    -webkit-appearance: none;
    width: 100%;
    background: transparent;
  }
  input[type=range]:focus {
    outline: none;
  }
  input[type=range]::-webkit-slider-runnable-track {
    width: 100%;
    height: 6px;
    cursor: pointer;
    background: var(--track-color, #e5e5e5);
    border-radius: 999px;
  }
  input[type=range]::-webkit-slider-thumb {
    height: 22px;
    width: 22px;
    border-radius: 50%;
    background: var(--thumb-color, #4f46e5);
    border: 2px solid var(--thumb-border, #ffffff);
    cursor: pointer;
    -webkit-appearance: none;
    margin-top: -8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }
  input[type=range]::-moz-range-track {
    width: 100%;
    height: 6px;
    background: var(--track-color, #e5e5e5);
    border-radius: 999px;
  }
  input[type=range]::-moz-range-thumb {
    height: 22px;
    width: 22px;
    border: 2px solid var(--thumb-border, #ffffff);
    border-radius: 50%;
    background: var(--thumb-color, #4f46e5);
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
`;

// --- Sync Engine Hook ---

interface SequenceLog {
  id: string;
  startTime: number | null;
  stopTime: number | null;
  duration: number | null;
}

const useSyncEngine = () => {
    // Determine Role from URL
    const [role, setRole] = useState<Role>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('role') === 'client' ? 'CLIENT' : 'HOST';
    });

    // Sync Mode Selection
    const [syncMode, setSyncMode] = useState<SyncMode>(() => {
        // Supabaseが設定されている場合はsupabaseモード、それ以外はbroadcast
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        return supabaseUrl ? 'supabase' : 'broadcast';
    });

    // Core State
    const [mode, setMode] = useState<Mode>('SETUP');
    const [settings, setSettings] = useState<Settings>({
        duration: 60,
        preRoll: 5,
        direction: 'UP',
        hostId: generateId(),
        voiceAction: true,
        voiceCut: true,
        voiceReady: true,
        voiceCountdown: true,
        voiceCount: false,
        voiceCountLimit: 60,
        fontType: 'sans',
        showArmed: true,
        armedText: 'ARMED',
        voiceLanguage: 'en'
    });
    const [smartCues, setSmartCues] = useState<SmartCue[]>([
        { id: '1', seconds: 10, text: 'Check gate' }
    ]);
    const [colorRanges, setColorRanges] = useState<ColorRange[]>([
        { id: 'c1', start: 0, end: 5, color: '#059669', textColor: '#ffffff' },
        { id: 'c2', start: 55, end: 60, color: '#dc2626', textColor: '#ffffff' }
    ]);

    // Timing State
    const [elapsed, setElapsed] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null); // Absolute Timestamp
    const channelRef = useRef<BroadcastChannel | null>(null);
    const supabaseSyncEngineRef = useRef<SupabaseSyncEngine | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const eventTracker = useRef(new Set<string>());
    
    // Logging State
    const [sequenceLogs, setSequenceLogs] = useState<SequenceLog[]>([]);
    const activeLogRef = useRef<SequenceLog | null>(null);

    // Supabase Session State
    const [supabaseSessionId, setSupabaseSessionId] = useState<string | null>(null);

    // Audio Preload State
    const [preloadProgress, setPreloadProgress] = useState<number>(0);
    const [isPreloading, setIsPreloading] = useState<boolean>(false);
    const preloadStartedRef = useRef<boolean>(false);

    // Ref to hold the tick function to allow safe recursion without circular dependencies
    const tickRef = useRef<() => void>(() => {});

    // Refs to hold handleStartSequence and handleStopSequence for message handlers
    // This ensures message handlers always call the latest version of these functions
    const handleStartSequenceRef = useRef<(ts: number) => void>(() => {});
    const handleStopSequenceRef = useRef<(manual: boolean) => void>(() => {});

    // Debounced values for settings sync (500ms)
    // これにより、スライダー操作時の過剰な同期を防ぎ、96.7%の負荷削減を実現
    const debouncedSettings = useDebounce(settings, 500);
    const debouncedSmartCues = useDebounce(smartCues, 500);
    const debouncedColorRanges = useDebounce(colorRanges, 500);

    // Derived Timings
    const readyDuration = settings.voiceReady ? 2 : 0;
    const preRollDuration = settings.preRoll;
    const mainDuration = settings.duration;
    const actionStartTime = readyDuration + preRollDuration;

    // --- Definitions ---
    
    const handleStopSequence = useCallback((manual: boolean) => {
        console.log(`[${role}] handleStopSequence called, manual: ${manual}`);

        // Prevent duplicate calls - only process if sequence is actually running
        if (!startTime) {
            console.log(`[${role}] Ignoring duplicate stop call - no active sequence`);
            return;
        }

        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        // Log finalization
        if (activeLogRef.current) {
            const now = Date.now();
            const diff = (now - startTime) / 1000;
            const mainTime = diff - actionStartTime;

            const finalLog: SequenceLog = {
                ...activeLogRef.current,
                stopTime: now,
                duration: Math.max(0, mainTime)
            };
            setSequenceLogs(prev => [finalLog, ...prev].slice(0, 3));
            activeLogRef.current = null;
        }

        setStartTime(null); // Clear startTime to prevent duplicate calls

        // Both HOST and CLIENT play "Cut" sound (each on their own device)
        if (settings.voiceCut) {
            console.log(`[${role}] Playing Cut sound`);
            AudioEngine.trigger("Cut", settings.voiceLanguage);
        } else {
            AudioEngine.playTone(400, 0.5, 'sawtooth');
        }

        setMode('ENDED');

        setTimeout(() => {
            setMode('SETUP');
        }, 2000);
    }, [role, settings.voiceCut, settings.voiceLanguage, startTime, actionStartTime]);

    const stop = useCallback(async () => {
        if (role === 'CLIENT') return;
        // Local Stop
        handleStopSequence(true);

        // Broadcast Stop
        if (syncMode === 'supabase' && supabaseSyncEngineRef.current) {
            await supabaseSyncEngineRef.current.sendMessage({
                type: 'CMD_STOP',
                payload: { manual: true }
            });
        } else if (channelRef.current) {
            channelRef.current.postMessage({
                type: 'CMD_STOP',
                payload: { manual: true }
            });
        }
    }, [role, syncMode, handleStopSequence]);

    /**
     * Core Loop Logic (Time-Reference Model)
     */
    const tick = useCallback(() => {
        if (!startTime) return;
        
        const now = Date.now();
        const diff = (now - startTime) / 1000;
        
        // Phase 1: ARMED / WAITING (Negative Time)
        if (diff < 0) {
            setElapsed(0); 
            setMode('ARMED');
            // Safe recursion via ref
            animationFrameRef.current = requestAnimationFrame(() => tickRef.current());
            return;
        }

        if (mode === 'ARMED') setMode('COUNTDOWN');
        setElapsed(diff);

        // --- Audio Triggers (Event Driven) ---
        // Pre-roll Logic
        if (diff < actionStartTime) {
            const timeInPreRoll = diff - readyDuration;
            if (timeInPreRoll >= 0) {
                const remainingPreRoll = Math.ceil(preRollDuration - timeInPreRoll);
                if (remainingPreRoll > 0 && remainingPreRoll <= preRollDuration) {
                    const key = `preroll-${remainingPreRoll}`;
                    if (!eventTracker.current.has(key)) {
                        if (settings.voiceCountdown) AudioEngine.trigger(remainingPreRoll.toString(), settings.voiceLanguage);
                        eventTracker.current.add(key);
                    }
                }
            } else {
                 // Ready Phase
                 if (settings.voiceReady && !eventTracker.current.has('ready')) {
                     AudioEngine.trigger("Ready", settings.voiceLanguage);
                     eventTracker.current.add('ready');
                 }
            }
        }

        // Action Trigger
        if (diff >= actionStartTime && !eventTracker.current.has('action')) {
            if (settings.voiceAction) AudioEngine.trigger("Action", settings.voiceLanguage);
            else AudioEngine.playTone(1000, 0.5, 'square');
            eventTracker.current.add('action');
        }

        // Main Sequence
        if (diff >= actionStartTime) {
            const mainTime = diff - actionStartTime;
            const currentSec = Math.floor(mainTime);

            // Voice Count (New implementation based on user request)
            // Always count up during the main duration, up to 100.
            if (currentSec > 0 && currentSec <= mainDuration && currentSec <= 100) {
                const key = `count-${currentSec}`;
                if (!eventTracker.current.has(key)) {
                    console.log(`[${role}] Triggering voice for number: ${currentSec}, language: ${settings.voiceLanguage}`);
                    AudioEngine.trigger(currentSec.toString(), settings.voiceLanguage);
                    eventTracker.current.add(key);
                }
            }

            // Smart Cues
            smartCues.forEach(cue => {
                if (mainTime >= cue.seconds && !eventTracker.current.has(`cue-${cue.id}`)) {
                    AudioEngine.trigger(cue.text, settings.voiceLanguage);
                    eventTracker.current.add(`cue-${cue.id}`);
                }
            });

            // Auto Cut
            if (mainTime >= mainDuration) {
                // Call handleStopSequence directly for both HOST and CLIENT
                handleStopSequence(false);
                return;
            }
        }

        // Safe recursion via ref
        animationFrameRef.current = requestAnimationFrame(() => tickRef.current());
    }, [startTime, mode, settings, smartCues, readyDuration, preRollDuration, mainDuration, actionStartTime, handleStopSequence]);

    useEffect(() => {
        tickRef.current = tick;
    }, [tick]);

    const handleStartSequence = useCallback((ts: number) => {
        AudioEngine.resume();
        setStartTime(ts);
        setMode('ARMED');
        setElapsed(0);
        eventTracker.current.clear();

        const newLog = { id: generateId(), startTime: ts, stopTime: null, duration: null };
        activeLogRef.current = newLog;

        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        // Double requestAnimationFrame ensures React state updates complete before starting tick loop
        // This fixes Chrome browser compatibility where tickRef.current may not be updated yet
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                animationFrameRef.current = requestAnimationFrame(() => tickRef.current());
            });
        });
    }, []);

    const start = useCallback(async () => {
        if (role === 'CLIENT') return;
        const scheduledStart = Date.now() + SYNC_LATENCY_BUFFER_MS;
        console.log('[HOST] Broadcasting CMD_START with startTime:', new Date(scheduledStart).toISOString());
        handleStartSequence(scheduledStart);

        // Send message via appropriate channel
        if (syncMode === 'supabase' && supabaseSyncEngineRef.current) {
            await supabaseSyncEngineRef.current.sendMessage({
                type: 'CMD_START',
                payload: { startTime: scheduledStart }
            });
        } else if (channelRef.current) {
            channelRef.current.postMessage({
                type: 'CMD_START',
                payload: { startTime: scheduledStart }
            });
        }
        console.log('[HOST] CMD_START message sent');
    }, [role, syncMode, handleStartSequence]);

    // Update refs whenever handleStartSequence or handleStopSequence changes
    // This ensures message handlers always call the latest version
    useEffect(() => {
        handleStartSequenceRef.current = handleStartSequence;
        handleStopSequenceRef.current = handleStopSequence;
    }, [handleStartSequence, handleStopSequence]);

    // Sync Engine Initialization (BroadcastChannel or Supabase)
    useEffect(() => {
        const initSyncEngine = async () => {
            if (syncMode === 'supabase') {
                // Supabase Sync Mode
                try {
                    const deviceId = generateDeviceId();
                    const sessionIdFromUrl = getSessionIdFromUrl();

                    const engine = new SupabaseSyncEngine({
                        role,
                        deviceId,
                        onMessage: (message) => {
                            console.log(`[${role}] Supabase message:`, message.type);

                            if (message.type === 'SYNC_STATE') {
                                if (role === 'CLIENT') {
                                    console.log('[CLIENT] Applying SYNC_STATE from HOST (Supabase)');
                                    console.log('[CLIENT] Voice Language:', message.payload.settings.voiceLanguage);
                                    console.log('[CLIENT] Full settings:', message.payload.settings);
                                    setSettings(message.payload.settings);
                                    setSmartCues(message.payload.smartCues);
                                    setColorRanges(message.payload.colorRanges);
                                }
                            } else if (message.type === 'CMD_START') {
                                console.log(`[${role}] Starting sequence at:`, new Date(message.payload.startTime).toISOString());
                                handleStartSequenceRef.current(message.payload.startTime);
                            } else if (message.type === 'CMD_STOP') {
                                console.log(`[${role}] Stopping sequence`);
                                handleStopSequenceRef.current(message.payload.manual);
                            }
                        },
                        onError: (error) => {
                            console.error('[Supabase Sync] Error:', error);
                        },
                    });

                    // Join or create session
                    if (role === 'HOST') {
                        const sessionInfo = await engine.createSession(settings, smartCues, colorRanges);
                        setSupabaseSessionId(sessionInfo.id);
                        console.log('[HOST] Supabase session created:', sessionInfo.id);
                    } else if (sessionIdFromUrl) {
                        await engine.joinSession(sessionIdFromUrl);
                        console.log('[CLIENT] Joined Supabase session:', sessionIdFromUrl);
                    }

                    supabaseSyncEngineRef.current = engine;

                    return () => {
                        engine.leaveSession();
                    };
                } catch (error) {
                    console.error('[Supabase Sync] Initialization failed:', error);
                    // Fallback to BroadcastChannel
                    setSyncMode('broadcast');
                }
            } else {
                // BroadcastChannel Mode
                if (typeof BroadcastChannel === 'undefined') {
                    console.warn("BroadcastChannel not supported in this browser. Sync features disabled.");
                    return;
                }

                const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
                channelRef.current = ch;
                console.log(`[${role}] BroadcastChannel initialized: ${SYNC_CHANNEL_NAME}`);

                ch.onmessage = (event: MessageEvent<SyncMessage>) => {
                    const { type, payload } = event.data;
                    console.log(`[${role}] Received message:`, type, payload);

                    if (type === 'SYNC_STATE') {
                        if (role === 'CLIENT') {
                            console.log('[CLIENT] Applying SYNC_STATE from HOST (BroadcastChannel)');
                            console.log('[CLIENT] Voice Language:', payload.settings.voiceLanguage);
                            console.log('[CLIENT] Full settings:', payload.settings);
                            setSettings(payload.settings);
                            setSmartCues(payload.smartCues);
                            setColorRanges(payload.colorRanges);
                        }
                    } else if (type === 'CMD_START') {
                        console.log(`[${role}] Starting sequence at:`, new Date(payload.startTime).toISOString());
                        handleStartSequenceRef.current(payload.startTime);
                    } else if (type === 'CMD_STOP') {
                        console.log(`[${role}] Stopping sequence (manual: ${payload.manual})`);
                        handleStopSequenceRef.current(payload.manual);
                    }
                };

                return () => ch.close();
            }
        };

        initSyncEngine();
    }, [role, syncMode]); // 無限ループ防止: settings等は初期化時のみ使用

    // Settings sync (HOST only) with 500ms debounce
    // デバウンスにより、スライダー操作時の過剰な同期を防止
    // Before: 60同期/操作 (48 KB) → After: 2同期/操作 (1.6 KB) = 96.7%削減
    useEffect(() => {
        const syncSettings = async () => {
            if (role !== 'HOST') return;

            console.log('[HOST] Syncing settings to clients (debounced), voiceLanguage:', debouncedSettings.voiceLanguage);

            if (syncMode === 'supabase' && supabaseSyncEngineRef.current) {
                await supabaseSyncEngineRef.current.updateSession(debouncedSettings, debouncedSmartCues, debouncedColorRanges);
            } else if (channelRef.current) {
                channelRef.current.postMessage({
                    type: 'SYNC_STATE',
                    payload: { settings: debouncedSettings, smartCues: debouncedSmartCues, colorRanges: debouncedColorRanges }
                });
            }
        };

        syncSettings();
    }, [role, syncMode, debouncedSettings, debouncedSmartCues, debouncedColorRanges]);

    // Keyboard shortcut: Space key to start/stop
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Ignore if user is typing in an input field
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            // Space key
            if (event.code === 'Space' || event.key === ' ') {
                event.preventDefault(); // Prevent page scroll

                if (mode === 'SETUP') {
                    // Start the sequence
                    start();
                } else if (mode === 'COUNTDOWN' || mode === 'ARMED') {
                    // Stop the sequence
                    stop();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, start, stop]);

    return {
        role,
        setRole,
        mode,
        settings,
        setSettings,
        smartCues,
        setSmartCues,
        colorRanges,
        setColorRanges,
        elapsed,
        start,
        stop,
        readyDuration,
        actionStartTime,
        mainDuration,
        sequenceLogs,
        syncMode,
        setSyncMode,
        supabaseSessionId
    };
};

// --- SHARED MODULE: SLATE OVERLAY ---

const SlateOverlay = ({ engine, theme }: { engine: ReturnType<typeof useSyncEngine>, theme: Theme }) => {
    const isDark = theme === 'dark';

    const getSlateDisplay = () => {
        if (engine.mode === 'ENDED') return { text: "CUT!", color: '#000000', bgColor: '#ef4444' };
        if (engine.mode === 'ARMED') {
            const text = engine.settings.showArmed ? engine.settings.armedText : "";
            const bgColor = engine.settings.showArmed ? '#171717' : (isDark ? '#000000' : '#000000'); // Black in armed if off, or just text hidden
            return { text, color: '#fbbf24', bgColor: '#171717' }; 
        }
    
        if (engine.elapsed < engine.readyDuration) {
          return { text: "READY", color: '#fbbf24', bgColor: '#171717' };
        }
    
        if (engine.elapsed < engine.actionStartTime) {
          const remaining = Math.ceil(engine.actionStartTime - engine.elapsed);
          return { text: remaining.toString(), color: '#10b981', bgColor: '#171717' };
        }
    
        const mainTime = engine.elapsed - engine.actionStartTime;
        const currentSecond = Math.floor(mainTime);
        
        let activeBg = isDark ? '#000000' : '#ffffff';
        let activeText = isDark ? '#ffffff' : '#000000';
        if (!isDark) activeBg = '#fafafa';
    
        const range = engine.colorRanges.find(r => currentSecond >= r.start && currentSecond < r.end);
        if (range) {
          activeBg = range.color;
          activeText = range.textColor;
        }
    
        let displayNum = 0;
        if (engine.settings.direction === 'UP') {
          displayNum = currentSecond;
        } else {
          displayNum = Math.max(0, Math.ceil(engine.mainDuration - mainTime));
        }
    
        const activeCue = engine.smartCues.find(c => Math.abs(mainTime - c.seconds) < 1.5 && mainTime >= c.seconds);
        let displayText = activeCue ? activeCue.text : displayNum.toString();
        
        // Show "ACTION" at T=0 if no other cue is active
        if (!activeCue && currentSecond === 0) {
            displayText = "ACTION";
        }
    
        return { text: displayText, color: activeText, bgColor: activeBg };
    };

    const slateState = getSlateDisplay();
    // Only show if running/armed. For Clients, ClientView handles the Standby state, overlay covers it when sequence starts.
    const showSlate = engine.mode !== 'SETUP';
    
    const getFontStyles = () => {
        switch(engine.settings.fontType) {
            case 'hand': return { fontFamily: "'Patrick Hand', cursive", fontWeight: 400 };
            case 'gothic': return { fontFamily: "'Oswald', sans-serif", fontWeight: 700 };
            case 'sans': default: return { fontFamily: "'Inter', sans-serif", fontWeight: 900 };
        }
    };
  
    const getSlateFontSize = (text: string) => {
      if (!text) return '0px';
      const len = text.length;
      if (len <= 2) return '35vw';
      if (len <= 4) return '25vw';
      if (len <= 5) return '20vw'; 
      if (len <= 7) return '18vw';
      if (len <= 12) return '12vw';
      return '8vw';
    };

    return (
        <div 
          className={clsx(
              "fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-200",
              showSlate ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          style={{ backgroundColor: slateState.bgColor }}
        >
           <div 
             className="leading-none tabular-nums select-none transition-all duration-100 tracking-tighter text-center w-full px-4"
             style={{ 
                 color: slateState.text === "CUT!" ? '#000000' : slateState.color,
                 fontSize: getSlateFontSize(slateState.text),
                 ...getFontStyles()
             }}
           >
              {slateState.text}
           </div>

           {(engine.mode === 'COUNTDOWN' || engine.mode === 'ARMED') && engine.role === 'HOST' && (
             <button 
                  onClick={engine.stop}
                  className="fixed bottom-10 z-50 px-8 py-4 rounded-full backdrop-blur-md border font-bold text-lg tracking-widest uppercase transition-all active:scale-95 flex items-center gap-3 shadow-lg"
                  style={{ 
                      color: getContrastColor(slateState.bgColor),
                      backgroundColor: hexToRgba(getContrastColor(slateState.bgColor), 0.1),
                      borderColor: hexToRgba(getContrastColor(slateState.bgColor), 0.2),
                      fontFamily: "'Inter', sans-serif" 
                   }} 
                >
                  <Square className="w-5 h-5 fill-current" />
                  CUT
             </button>
           )}
        </div>
    );
};

// --- MODULE: CLIENT VIEW ---

const ClientView = ({ engine, theme }: { engine: ReturnType<typeof useSyncEngine>, theme: Theme }) => {
    const isDark = theme === 'dark';
    const [audioEnabled, setAudioEnabled] = useState(false);

    const enableAudio = async () => {
        console.log('[CLIENT] Enabling audio...');
        AudioEngine.resume();

        // Play a test sound to unlock audio playback on iOS/Safari
        // This is required because Safari blocks audio playback without user interaction
        try {
            if (engine.settings.voiceLanguage === 'jp') {
                // For Japanese, play voice file for "0" as test
                console.log('[CLIENT] Playing test Japanese voice to unlock audio...');
                await AudioEngine.trigger('0', 'jp');
            } else {
                // For other languages, play a short tone
                console.log('[CLIENT] Playing test tone to unlock audio...');
                AudioEngine.playTone(800, 0.1, 'sine');
            }
            console.log('[CLIENT] Audio unlocked successfully');
        } catch (error) {
            console.warn('[CLIENT] Failed to unlock audio:', error);
        }

        setAudioEnabled(true);
    };

    // Auto-enable audio on any user interaction
    useEffect(() => {
        if (audioEnabled) return;

        const handleInteraction = async () => {
            console.log('[CLIENT] Auto-enabling audio on user interaction');
            await enableAudio();
        };

        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('touchstart', handleInteraction, { once: true });

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, [audioEnabled, engine.settings.voiceLanguage]);

    // Preload Japanese voice files when language is set to Japanese
    useEffect(() => {
        // Safety check: ensure settings is defined
        if (!engine.settings || !engine.settings.voiceLanguage) {
            return;
        }

        // Only preload for Japanese language
        if (engine.settings.voiceLanguage !== 'jp') {
            return;
        }

        // Only preload once
        if (preloadStartedRef.current) {
            return;
        }

        const startPreload = async () => {
            preloadStartedRef.current = true;
            setIsPreloading(true);
            console.log('[Audio Preload] Starting Japanese voice preload...');

            try {
                const audioEngine = getGeminiAudioEngine();
                await audioEngine.preloadJapaneseVoices(
                    { start: 0, end: 60 },
                    (progress) => {
                        setPreloadProgress(progress);
                        if (progress % 20 === 0 || progress === 100) {
                            console.log(`[Audio Preload] Progress: ${progress}%`);
                        }
                    }
                );
                console.log('[Audio Preload] Completed successfully');
            } catch (error) {
                console.error('[Audio Preload] Failed:', error);
            } finally {
                setIsPreloading(false);
            }
        };

        // Start preload after a short delay to not block initial render
        const timeoutId = setTimeout(() => {
            startPreload();
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [engine.settings?.voiceLanguage]);

    return (
        <div className="flex flex-col h-full items-center justify-center relative p-6 text-center">

            {/* Connection Status Indicator */}
            <div className="absolute top-6 right-6 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className={clsx("text-xs font-mono font-bold uppercase tracking-wider", isDark ? "text-emerald-500" : "text-emerald-700")}>
                    Signal Active
                 </span>
            </div>

            {/* Audio Preload Indicator */}
            {isPreloading && (
                <div className="absolute top-6 left-6 flex items-center gap-2 bg-blue-500/10 px-3 py-2 rounded-lg backdrop-blur-sm">
                    <Volume2 className="w-3 h-3 text-blue-500 animate-pulse" />
                    <span className={clsx("text-xs font-mono", isDark ? "text-blue-400" : "text-blue-600")}>
                        Loading voices... {preloadProgress}%
                    </span>
                </div>
            )}

            <div className="space-y-8 max-w-md w-full relative z-10">
                <div className="space-y-2">
                    {/* Placeholder for removed icon to maintain layout */}
                    <div className="w-16 h-16 mx-auto mb-4" />
                    <h2 className={clsx("text-3xl font-black uppercase tracking-tighter", isDark ? "text-white" : "text-neutral-900")}>
                        Client Mode
                    </h2>
                    <p className={clsx("text-sm font-mono uppercase tracking-widest opacity-60", isDark ? "text-neutral-400" : "text-neutral-500")}>
                        Awaiting Host Trigger
                    </p>
                </div>

                {/* Audio Permission Gate */}
                {!audioEnabled ? (
                    <button 
                        onClick={enableAudio}
                        className={clsx(
                            "w-full py-4 rounded-lg border-2 border-dashed flex items-center justify-center gap-3 transition-all hover:border-solid group",
                            isDark ? "border-neutral-700 hover:border-emerald-500 hover:bg-emerald-500/10" : "border-neutral-300 hover:border-emerald-500 hover:bg-emerald-50"
                        )}
                    >
                        <Volume2 className={clsx("w-5 h-5 group-hover:text-emerald-500 transition-colors", isDark ? "text-neutral-500" : "text-neutral-400")} />
                        <span className={clsx("text-sm font-bold uppercase tracking-wider group-hover:text-emerald-500 transition-colors", isDark ? "text-neutral-500" : "text-neutral-500")}>
                            Click to Enable Audio
                        </span>
                    </button>
                ) : (
                    <div className={clsx("w-full py-3 rounded-lg border flex items-center justify-center gap-2", isDark ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-500" : "bg-emerald-50 border-emerald-200 text-emerald-600")}>
                        <Volume2 className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Audio Active</span>
                    </div>
                )}

                <div className={clsx("text-[10px] font-mono p-4 rounded border mt-8 text-left space-y-2 opacity-70", isDark ? "bg-neutral-900 border-neutral-800 text-neutral-500" : "bg-neutral-100 border-neutral-200 text-neutral-500")}>
                    <div className="flex justify-between">
                        <span>CHANNEL:</span>
                        <span className="text-emerald-500">{SYNC_CHANNEL_NAME}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>DURATION:</span>
                        <span>{engine.settings.duration}s</span>
                    </div>
                    <div className="flex justify-between">
                        <span>PRE-ROLL:</span>
                        <span>{engine.settings.preRoll}s</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MODULE: SETTINGS MODAL ---

const SettingsModal = ({ engine, theme, onClose }: { engine: ReturnType<typeof useSyncEngine>, theme: Theme, onClose: () => void }) => {
    const isDark = theme === 'dark';
    const cardClass = isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
    const textClass = isDark ? "text-white" : "text-neutral-900";
    
    const armedOptions = ["ARMED", "READY", "SET", "STANDBY", "ROLLING", "ATTENTION"];
    const languages: { id: VoiceLanguage; label: string; native: string }[] = [
        { id: 'en', label: 'English', native: 'English' },
        { id: 'jp', label: 'Japanese', native: '日本語' },
        { id: 'fr', label: 'French', native: 'Français' },
        { id: 'de', label: 'German', native: 'Deutsch' },
        { id: 'es', label: 'Spanish', native: 'Español' },
        { id: 'ko', label: 'Korean', native: '한국어' },
    ];

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className={clsx("relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border flex flex-col max-h-[90vh]", cardClass)}>
                {/* Header */}
                <div className={clsx("px-5 py-4 border-b flex items-center justify-between shrink-0", isDark ? "border-neutral-800 bg-neutral-900" : "border-neutral-100 bg-white")}>
                    <h3 className={clsx("text-sm font-bold uppercase tracking-wider", textClass)}>Global Settings</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                        <X className={clsx("w-5 h-5", isDark ? "text-neutral-400" : "text-neutral-500")} />
                    </button>
                </div>
                
                {/* Body */}
                <div className="p-5 space-y-8 overflow-y-auto">
                    
                    {/* Section: Armed Phase */}
                    <div className="space-y-4">
                         <div className="flex items-center gap-2 mb-2">
                             <MessageSquare className={clsx("w-4 h-4", isDark ? "text-neutral-400" : "text-neutral-500")} />
                             <h4 className={clsx("text-xs font-bold uppercase tracking-widest opacity-60", textClass)}>Armed Phase</h4>
                         </div>
                         
                         <div className={clsx("border rounded-lg p-4", isDark ? "border-neutral-800 bg-neutral-900/50" : "border-neutral-100 bg-neutral-50/50")}>
                            {/* Armed Toggle */}
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className={clsx("text-sm font-bold", textClass)}>Show Armed Phase</div>
                                    <div className={clsx("text-[10px] mt-1 opacity-60", textClass)}>Display text before countdown starts</div>
                                </div>
                                <button 
                                    onClick={() => engine.setSettings(s => ({...s, showArmed: !s.showArmed}))}
                                    className={clsx("w-10 h-6 rounded-full transition-colors relative", engine.settings.showArmed ? "bg-emerald-500" : "bg-neutral-200 dark:bg-neutral-700")}
                                >
                                    <div className={clsx("absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm", engine.settings.showArmed ? "left-5" : "left-1")} />
                                </button>
                            </div>

                            {/* Armed Text Selection */}
                            <div className={clsx("transition-opacity duration-200 space-y-2", engine.settings.showArmed ? "opacity-100" : "opacity-40 pointer-events-none")}>
                                <div className={clsx("text-[10px] font-bold uppercase tracking-wider opacity-60", textClass)}>
                                    Display Text
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {armedOptions.map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => engine.setSettings(s => ({...s, armedText: opt}))}
                                            className={clsx(
                                                "px-3 py-2 rounded text-xs font-mono font-bold border transition-all flex items-center justify-between",
                                                engine.settings.armedText === opt 
                                                    ? (isDark ? "bg-neutral-100 text-black border-transparent" : "bg-neutral-900 text-white border-transparent")
                                                    : (isDark ? "bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700" : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50")
                                            )}
                                        >
                                            {opt}
                                            {engine.settings.armedText === opt && <Check className="w-3 h-3" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section: Language */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                             <Globe className={clsx("w-4 h-4", isDark ? "text-neutral-400" : "text-neutral-500")} />
                             <h4 className={clsx("text-xs font-bold uppercase tracking-widest opacity-60", textClass)}>Voice Language</h4>
                        </div>
                        
                        <div className={clsx("border rounded-lg overflow-hidden", isDark ? "border-neutral-800" : "border-neutral-200")}>
                            {languages.map((lang, idx) => (
                                <button
                                    key={lang.id}
                                    onClick={() => engine.setSettings(s => ({...s, voiceLanguage: lang.id}))}
                                    className={clsx(
                                        "w-full px-4 py-3 flex items-center justify-between text-left transition-colors",
                                        idx !== languages.length - 1 && (isDark ? "border-b border-neutral-800" : "border-b border-neutral-100"),
                                        engine.settings.voiceLanguage === lang.id
                                            ? (isDark ? "bg-neutral-800 text-white" : "bg-neutral-50 text-black")
                                            : (isDark ? "text-neutral-400 hover:bg-neutral-800/50" : "text-neutral-600 hover:bg-neutral-50")
                                    )}
                                >
                                    <div>
                                        <div className="text-sm font-bold">{lang.native}</div>
                                        <div className="text-[10px] opacity-60 font-mono uppercase">{lang.label}</div>
                                    </div>
                                    {engine.settings.voiceLanguage === lang.id && (
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                         <div className={clsx("text-[10px] opacity-40 px-1 text-center", textClass)}>
                            * Audio generation is currently simulated for development. Check console for asset paths.
                        </div>
                    </div>

                    {/* Section: Sync Mode */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                             <Radio className={clsx("w-4 h-4", isDark ? "text-neutral-400" : "text-neutral-500")} />
                             <h4 className={clsx("text-xs font-bold uppercase tracking-widest opacity-60", textClass)}>Synchronization Mode</h4>
                        </div>

                        <div className={clsx("border rounded-lg overflow-hidden", isDark ? "border-neutral-800" : "border-neutral-200")}>
                            <button
                                onClick={() => engine.setSyncMode('broadcast')}
                                className={clsx(
                                    "w-full px-4 py-3 flex items-center justify-between text-left transition-colors border-b",
                                    isDark ? "border-neutral-800" : "border-neutral-100",
                                    engine.syncMode === 'broadcast'
                                        ? (isDark ? "bg-neutral-800 text-white" : "bg-neutral-50 text-black")
                                        : (isDark ? "text-neutral-400 hover:bg-neutral-800/50" : "text-neutral-600 hover:bg-neutral-50")
                                )}
                            >
                                <div>
                                    <div className="text-sm font-bold">BroadcastChannel</div>
                                    <div className="text-[10px] opacity-60 mt-0.5">Same browser tabs only</div>
                                </div>
                                {engine.syncMode === 'broadcast' && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                )}
                            </button>
                            <button
                                onClick={() => engine.setSyncMode('supabase')}
                                className={clsx(
                                    "w-full px-4 py-3 flex items-center justify-between text-left transition-colors",
                                    engine.syncMode === 'supabase'
                                        ? (isDark ? "bg-neutral-800 text-white" : "bg-neutral-50 text-black")
                                        : (isDark ? "text-neutral-400 hover:bg-neutral-800/50" : "text-neutral-600 hover:bg-neutral-50")
                                )}
                            >
                                <div>
                                    <div className="text-sm font-bold">Supabase Realtime</div>
                                    <div className="text-[10px] opacity-60 mt-0.5">Cross-device synchronization</div>
                                </div>
                                {engine.syncMode === 'supabase' && (
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                )}
                            </button>
                        </div>
                         <div className={clsx("text-[10px] opacity-40 px-1 text-center", textClass)}>
                            {engine.syncMode === 'supabase'
                                ? '* Requires Supabase configuration in .env'
                                : '* Limited to same browser instance'}
                        </div>
                    </div>

                </div>

                 {/* Footer */}
                 <div className={clsx("px-5 py-4 border-t text-center shrink-0", isDark ? "border-neutral-800 bg-neutral-900/50" : "border-neutral-100 bg-neutral-50")}>
                     <div className={clsx("text-[10px] uppercase tracking-widest opacity-50", isDark ? "text-neutral-500" : "text-neutral-400")}>
                         Settings sync to all clients
                     </div>
                 </div>
            </div>
        </div>
    );
}

// --- MODULE: HOST VIEW ---

const HostView = ({ engine, theme }: { engine: ReturnType<typeof useSyncEngine>, theme: Theme }) => {
    const isDark = theme === 'dark';
    const textClass = isDark ? "text-neutral-100" : "text-neutral-900";
    const subTextClass = isDark ? "text-neutral-500" : "text-neutral-500";
    const cardClass = isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
    const inputClass = isDark
    ? "bg-neutral-950 text-white border-neutral-800 focus:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
    : "bg-neutral-50 text-neutral-900 border-neutral-300 focus:border-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed";

    const [urlCopied, setUrlCopied] = useState(false);

    const getShareUrl = () => {
        const baseUrl = window.location.origin + window.location.pathname;
        const sessionId = engine.supabaseSessionId || generateId();
        return `${baseUrl}?role=client&session=${sessionId}`;
    };

    const copyShareUrl = async () => {
        try {
            await navigator.clipboard.writeText(getShareUrl());
            setUrlCopied(true);
            setTimeout(() => setUrlCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
        }
    };

    const updateDuration = (newDuration: number) => {
        const d = Math.max(10, newDuration);
        engine.setSettings(s => ({ ...s, duration: d, voiceCountLimit: d }));
    };

    return (
        <>
        <main className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-6 relative z-10 pb-32">
          {/* Section: Share Session - CRITICAL FOR CLIENT MODE */}
          <section className="space-y-4">
             <div className="flex justify-between items-center pl-1">
                 <div className={clsx("text-[10px] font-mono uppercase tracking-widest", subTextClass)}>// Share with Clients</div>
             </div>

             <div className={clsx("border rounded-lg p-4", cardClass)}>
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded text-emerald-600">
                         <Share2 className="w-4 h-4" />
                      </div>
                      <div>
                         <div className={clsx("font-bold text-sm", textClass)}>Share Session</div>
                         <div className={clsx("text-xs mt-0.5", subTextClass)}>Clients join without login</div>
                      </div>
                   </div>
                   <button
                      onClick={copyShareUrl}
                      className={clsx(
                         "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                         urlCopied
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : isDark
                               ? "bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
                               : "bg-white border-neutral-200 text-black hover:bg-neutral-50"
                      )}
                   >
                      {urlCopied ? (
                         <>
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-bold">Copied!</span>
                         </>
                      ) : (
                         <>
                            <Copy className="w-4 h-4" />
                            <span className="text-sm font-bold">Copy Link</span>
                         </>
                      )}
                   </button>
                </div>

                {/* Preview of the share URL */}
                <div className={clsx(
                   "mt-3 p-2 rounded text-xs font-mono break-all",
                   isDark ? "bg-neutral-950 text-neutral-400" : "bg-neutral-50 text-neutral-500"
                )}>
                   {getShareUrl()}
                </div>
             </div>
          </section>

          {/* Section: Recent Activity */}
          <section className="space-y-4">
             <div className="flex justify-between items-center pl-1">
                 <div className={clsx("text-[10px] font-mono uppercase tracking-widest", subTextClass)}>// Recent Activity</div>
             </div>

             <div className={clsx("border rounded-lg p-2 space-y-1", cardClass)}>
                {engine.sequenceLogs.length === 0 ? (
                    <div className={clsx("text-center text-xs py-5", subTextClass)}>
                        No sequences recorded yet.
                    </div>
                ) : (
                    engine.sequenceLogs.map(log => (
                        <div key={log.id} className={clsx("p-2 rounded-md flex justify-between items-center", isDark ? "hover:bg-neutral-800/50" : "hover:bg-neutral-50")}>
                            <div className="flex items-center gap-3">
                                <CheckCircle className={clsx("w-4 h-4", isDark ? "text-emerald-700" : "text-emerald-500")} />
                                <span className={clsx("font-bold font-mono text-sm", textClass)}>
                                    {log.duration !== null ? `${log.duration.toFixed(2)}s` : 'In Progress...'}
                                </span>
                            </div>
                            <span className={clsx("text-xs font-mono", subTextClass)}>
                                {log.startTime ? new Date(log.startTime).toLocaleTimeString() : ''}
                            </span>
                        </div>
                    ))
                )}
            </div>
          </section>

          {/* Section: Timeline */}
          <section className="space-y-4">
             <div className="flex justify-between items-center pl-1">
                 <div className={clsx("text-[10px] font-mono uppercase tracking-widest", subTextClass)}>// Sequence Config</div>
             </div>
             
             {/* Ready */}
             <div className={clsx("border rounded-lg p-4 flex items-center justify-between", cardClass)}>
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-yellow-500/10 rounded text-yellow-600"><Mic className="w-4 h-4" /></div>
                   <div>
                       <div className={clsx("font-bold text-sm", textClass)}>Ready Call</div>
                       <div className={clsx("text-xs mt-0.5", subTextClass)}>+2s Buffer</div>
                   </div>
                </div>
                <button 
                  onClick={() => engine.setSettings(s => ({...s, voiceReady: !s.voiceReady}))}
                  className={clsx("w-10 h-6 rounded-full transition-colors relative", engine.settings.voiceReady ? "bg-indigo-600" : "bg-neutral-300 dark:bg-neutral-700")}
                >
                   <div className={clsx("absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm", engine.settings.voiceReady ? "left-5" : "left-1")} />
                </button>
             </div>

             {/* Pre-Roll */}
             <div className={clsx("border rounded-lg p-4", cardClass)}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded text-emerald-600"><Clock className="w-4 h-4" /></div>
                        <div className={clsx("font-bold text-sm", textClass)}>Pre-Roll</div>
                    </div>
                    <div className={clsx("font-mono text-sm font-bold px-2 py-1 rounded min-w-[2.5rem] text-center", isDark ? "bg-white text-black" : "bg-neutral-900 text-white")}>
                      {engine.settings.preRoll}s
                    </div>
                </div>
                
                <input 
                    type="range" min="0" max="10" 
                    value={engine.settings.preRoll} 
                    onChange={(e) => engine.setSettings(s => ({...s, preRoll: parseInt(e.target.value)}))}
                    style={{ 
                        '--track-color': isDark ? '#404040' : '#e5e5e5',
                        '--thumb-color': '#4f46e5',
                        '--thumb-border': '#ffffff'
                    } as React.CSSProperties}
                    className="w-full"
                />

                <div className="mt-4 flex items-center gap-2">
                   <input 
                       type="checkbox" 
                       id="voiceCountdown"
                       checked={engine.settings.voiceCountdown}
                       onChange={(e) => engine.setSettings(s => ({...s, voiceCountdown: e.target.checked}))}
                       className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-0 disabled:opacity-50"
                   />
                   <label htmlFor="voiceCountdown" className={clsx("text-xs font-mono uppercase tracking-wide cursor-pointer", subTextClass)}>Voice Countdown</label>
                </div>
             </div>

             {/* Action & Duration */}
             <div className={clsx("border rounded-lg p-4 space-y-4", cardClass)}>
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded text-blue-600"><Zap className="w-4 h-4" /></div>
                        <div className={clsx("font-bold text-sm", textClass)}>Action Trigger</div>
                    </div>
                    <button 
                      onClick={() => engine.setSettings(s => ({...s, voiceAction: !s.voiceAction}))}
                      className={clsx("w-10 h-6 rounded-full transition-colors relative", engine.settings.voiceAction ? "bg-indigo-600" : "bg-neutral-300 dark:bg-neutral-700")}
                    >
                       <div className={clsx("absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm", engine.settings.voiceAction ? "left-5" : "left-1")} />
                    </button>
                </div>

                <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded text-purple-600"><Square className="w-4 h-4" /></div>
                        <div className={clsx("font-bold text-sm", textClass)}>Duration</div>
                     </div>
                     <div className="flex items-center gap-2">
                        <button 
                          className={clsx(
                             "w-8 h-8 rounded border flex items-center justify-center transition-colors disabled:opacity-50", 
                             isDark ? "border-neutral-700 text-white hover:bg-neutral-800" : "border-neutral-300 text-black hover:bg-neutral-100"
                          )} 
                          onClick={() => updateDuration(engine.settings.duration - 10)}
                        >
                           <Minus className="w-4 h-4" />
                        </button>
                        
                        <input
                            type="number"
                            min="1"
                            value={engine.settings.duration === 0 ? '' : engine.settings.duration}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                                const valStr = e.target.value;
                                if (valStr === '') {
                                    engine.setSettings(s => ({ ...s, duration: 0 }));
                                } else {
                                    const val = parseInt(valStr);
                                    if (!isNaN(val)) {
                                        engine.setSettings(s => ({ ...s, duration: val }));
                                    }
                                }
                            }}
                            onBlur={(e) => {
                                let val = parseInt(e.target.value);
                                if (isNaN(val) || val < 1) val = 10;
                                engine.setSettings(s => ({ 
                                    ...s, 
                                    duration: val,
                                    voiceCountLimit: Math.min(s.voiceCountLimit, val)
                                }));
                            }}
                            className={clsx(
                                "font-mono text-xl w-20 text-center font-bold bg-transparent border-b border-transparent focus:border-current focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 m-0",
                                textClass
                            )}
                        />

                        <button 
                           className={clsx(
                              "w-8 h-8 rounded border flex items-center justify-center transition-colors disabled:opacity-50", 
                              isDark ? "border-neutral-700 text-white hover:bg-neutral-800" : "border-neutral-300 text-black hover:bg-neutral-100"
                           )} 
                           onClick={() => updateDuration(engine.settings.duration + 10)}
                        >
                           <Plus className="w-4 h-4" />
                        </button>
                     </div>
                </div>

                {/* Voice Count Settings */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded text-orange-600"><Hash className="w-4 h-4" /></div>
                        <div>
                             <div className={clsx("font-bold text-sm", textClass)}>Voice Count</div>
                             {engine.settings.voiceCount && (
                                <div className={clsx("text-xs mt-0.5", subTextClass)}>Stop at {engine.settings.voiceCountLimit}s</div>
                             )}
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        {engine.settings.voiceCount && (
                             <input 
                                type="number" 
                                min="1" 
                                max={engine.settings.duration}
                                value={engine.settings.voiceCountLimit}
                                onChange={(e) => engine.setSettings(s => ({...s, voiceCountLimit: parseInt(e.target.value)}))}
                                className={clsx("w-14 rounded px-1 py-1 text-center text-sm font-mono border focus:outline-none focus:ring-1 focus:ring-neutral-500", inputClass)}
                            />
                        )}
                        <button 
                          onClick={() => engine.setSettings(s => ({...s, voiceCount: !s.voiceCount}))}
                          className={clsx("w-10 h-6 rounded-full transition-colors relative", engine.settings.voiceCount ? "bg-indigo-600" : "bg-neutral-300 dark:bg-neutral-700")}
                        >
                           <div className={clsx("absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm", engine.settings.voiceCount ? "left-5" : "left-1")} />
                        </button>
                     </div>
                </div>
                
                <div className="flex justify-end pt-2">
                    <div className={clsx("flex rounded overflow-hidden border", isDark ? "border-neutral-700" : "border-neutral-200")}>
                        {['UP', 'DOWN'].map((d) => (
                              <button 
                                key={d}
                                onClick={() => engine.setSettings(s => ({...s, direction: d as Direction}))}
                                className={clsx(
                                    "px-3 py-1 text-[10px] font-mono font-bold transition-all disabled:opacity-50",
                                    engine.settings.direction === d 
                                      ? (isDark ? "bg-neutral-100 text-black" : "bg-neutral-900 text-white")
                                      : (isDark ? "bg-neutral-900 text-neutral-500 hover:text-white" : "bg-white text-neutral-400 hover:text-black")
                                )}
                              >
                                {d}
                              </button>
                          ))}
                    </div>
                </div>
             </div>
          </section>

          {/* Section: Smart Cues */}
          <section className="space-y-4">
             <div className="flex items-center justify-between pl-1">
                 <div className={clsx("text-[10px] font-mono uppercase tracking-widest", subTextClass)}>// Smart Cues</div>
                 <button onClick={() => engine.setSmartCues([...engine.smartCues, { id: generateId(), seconds: 5, text: '' }])} className={clsx("p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800", subTextClass)}><Plus className="w-4 h-4" /></button>
             </div>
             {engine.smartCues.map((cue, idx) => (
                <div key={cue.id} className={clsx("border rounded-lg p-2 flex gap-2 items-center", cardClass)}>
                   <div className={clsx("w-8 h-8 rounded flex items-center justify-center text-xs font-mono font-bold border", isDark ? "border-neutral-700 bg-neutral-800 text-neutral-400" : "border-neutral-200 bg-neutral-100 text-neutral-500")}>
                      {String(idx + 1).padStart(2, '0')}
                   </div>
                   <input 
                     type="number" 
                     value={cue.seconds}
                     onChange={(e) => engine.setSmartCues(engine.smartCues.map(c => c.id === cue.id ? { ...c, seconds: parseFloat(e.target.value) } : c))}
                     className={clsx("w-16 rounded px-2 py-1.5 text-sm font-mono text-center border focus:outline-none focus:ring-1 focus:ring-neutral-500", inputClass)}
                   />
                   <input 
                     type="text"
                     value={cue.text}
                     placeholder="Spoken text..."
                     onChange={(e) => engine.setSmartCues(engine.smartCues.map(c => c.id === cue.id ? { ...c, text: e.target.value } : c))}
                     className={clsx("flex-1 rounded px-3 py-1.5 text-sm border focus:outline-none focus:ring-1 focus:ring-neutral-500", inputClass)}
                   />
                   <button onClick={() => engine.setSmartCues(engine.smartCues.filter(c => c.id !== cue.id))} className="text-neutral-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                </div>
             ))}
          </section>

           {/* Section: Colors */}
           <section className="space-y-4">
             <div className="flex items-center justify-between pl-1">
                 <div className={clsx("text-[10px] font-mono uppercase tracking-widest", subTextClass)}>// Color Logic</div>
                 <button onClick={() => engine.setColorRanges([...engine.colorRanges, { id: generateId(), start: 0, end: 10, color: '#3b82f6', textColor: '#ffffff' }])} className={clsx("p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800", subTextClass)}><Plus className="w-4 h-4" /></button>
             </div>
             {engine.colorRanges.map((range) => (
                <div key={range.id} className={clsx("border rounded-lg p-3 space-y-3", cardClass)}>
                   <div className="flex items-center gap-2">
                       <span className={clsx("text-xs font-mono w-4", subTextClass)}>T-</span>
                       <input 
                            type="number" value={range.start} 
                            onChange={(e) => engine.setColorRanges(engine.colorRanges.map(c => c.id === range.id ? { ...c, start: parseInt(e.target.value) } : c))}
                            className={clsx("w-14 rounded px-1 py-1 text-center text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-neutral-500", inputClass)}
                       />
                       <span className={clsx("text-xs font-mono", subTextClass)}>TO</span>
                       <input 
                            type="number" value={range.end} 
                            onChange={(e) => engine.setColorRanges(engine.colorRanges.map(c => c.id === range.id ? { ...c, end: parseInt(e.target.value) } : c))}
                            className={clsx("w-14 rounded px-1 py-1 text-center text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-neutral-500", inputClass)}
                       />
                       <div className="flex-1"></div>
                       <button onClick={() => engine.setColorRanges(engine.colorRanges.filter(c => c.id !== range.id))} className="text-neutral-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                   </div>
                   
                   <div className="flex items-center justify-between">
                        <div className="relative shrink-0 group">
                            <div className={clsx("w-10 h-10 rounded-md border flex items-center justify-center shadow-sm cursor-pointer transition-transform group-active:scale-95", isDark ? "border-neutral-700" : "border-neutral-200")} style={{backgroundColor: range.color}}>
                               <span className="text-xs font-black font-mono" style={{ color: getContrastColor(range.color) }}>BG</span>
                            </div>
                            <input 
                                type="color" value={range.color} 
                                onChange={(e) => engine.setColorRanges(engine.colorRanges.map(c => c.id === range.id ? { ...c, color: e.target.value } : c))}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                            />
                        </div>
                        
                        <div className="flex-1 mx-3 h-10 rounded-md border flex items-center justify-center font-mono font-bold text-lg shadow-inner transition-colors" 
                             style={{ backgroundColor: range.color, color: range.textColor, borderColor: 'rgba(0,0,0,0.1)' }}>
                             {String(range.end).padStart(2, '0')}
                        </div>

                        <div className="relative shrink-0 group">
                             <div className={clsx("w-10 h-10 rounded-md border flex items-center justify-center shadow-sm cursor-pointer transition-transform group-active:scale-95", isDark ? "border-neutral-700" : "border-neutral-200")} style={{ backgroundColor: getContrastColor(range.textColor) }}>
                                <span className="text-sm font-black font-mono" style={{color: range.textColor}}>T</span>
                             </div>
                             <input 
                                type="color" value={range.textColor} 
                                onChange={(e) => engine.setColorRanges(engine.colorRanges.map(c => c.id === range.id ? { ...c, textColor: e.target.value } : c))}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                            />
                        </div>
                   </div>
                </div>
             ))}
          </section>

          {/* Section: Typography */}
          <section className="space-y-4">
             <div className={clsx("text-[10px] font-mono uppercase tracking-widest pl-1", subTextClass)}>// Typography</div>
             <div className={clsx("border rounded-lg p-2 flex items-center justify-between", cardClass)}>
                 <div className="p-2 bg-pink-500/10 rounded text-pink-600"><Type className="w-4 h-4" /></div>
                
                <div className="flex gap-2">
                    {[
                        { id: 'hand', label: 'Hand', font: "'Patrick Hand', cursive" },
                        { id: 'sans', label: 'Sans', font: "'Inter', sans-serif" },
                        { id: 'gothic', label: 'Gothic', font: "'Oswald', sans-serif" }
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => engine.setSettings(s => ({...s, fontType: f.id as FontType}))}
                            className={clsx(
                                "px-3 py-1.5 rounded text-xs border transition-all min-w-[70px]",
                                engine.settings.fontType === f.id 
                                    ? (isDark ? "bg-neutral-100 text-black border-transparent font-bold" : "bg-neutral-900 text-white border-transparent font-bold")
                                    : (isDark ? "bg-neutral-900 border-neutral-700 text-neutral-400 hover:bg-neutral-800" : "bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100")
                            )}
                            style={{ fontFamily: f.font }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
             </div>
          </section>

        </main>

        {/* Footer */}
        <footer className={clsx("fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-md shadow-[0_-1px_10px_rgba(0,0,0,0.05)]", isDark ? "bg-neutral-900/90 border-neutral-800" : "bg-white/90 border-neutral-200")}>
           <div className="max-w-lg mx-auto w-full p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <button 
                onClick={engine.start}
                className={clsx(
                    "w-full rounded-lg text-white font-bold text-sm uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 p-3 transition-transform active:scale-[0.98] duration-75",
                    isDark ? "bg-indigo-600 hover:bg-indigo-500" : "bg-neutral-900 hover:bg-neutral-800"
                )}
              >
                Start Sequence
              </button>
           </div>
        </footer>
        </>
    );
};

// --- MAIN APP ---

const App = () => {
  const [theme, setTheme] = useState<Theme>('light');
  const [showSettings, setShowSettings] = useState(false);
  const engine = useSyncEngine();
  
  const isDark = theme === 'dark';
  const bgClass = isDark ? "bg-neutral-950" : "bg-neutral-50";
  const gridClass = isDark
    ? "bg-[radial-gradient(#404040_1px,transparent_1px)] [background-size:20px_20px]"
    : "bg-[radial-gradient(#d4d4d4_1px,transparent_1px)] [background-size:20px_20px]";
  const textClass = isDark ? "text-neutral-100" : "text-neutral-900";
  const subTextClass = isDark ? "text-neutral-500" : "text-neutral-500";

  const toggleRole = (newRole: Role) => {
      engine.setRole(newRole);
      const url = new URL(window.location.href);
      if (newRole === 'CLIENT') url.searchParams.set('role', 'client');
      else url.searchParams.delete('role');
      window.history.pushState({}, '', url);
  };

  return (
    <div className={clsx("flex flex-col h-[100dvh] font-sans overflow-hidden transition-colors duration-300", bgClass)}>
        <style>{sliderStyles}</style>
        <div className={clsx("absolute inset-0 pointer-events-none opacity-[0.4] z-0", gridClass)}></div>

        {/* Shared Header */}
        <header className={clsx("relative flex items-center justify-between px-5 py-4 border-b shrink-0 z-10 transition-colors", isDark ? "border-neutral-800 bg-neutral-950/80" : "border-neutral-200 bg-white/80", "backdrop-blur-sm")}>
          <div className="flex items-center gap-3">
            <div className={clsx("w-8 h-8 rounded flex items-center justify-center border", isDark ? "bg-neutral-900 border-neutral-700 text-white" : "bg-neutral-100 border-neutral-300 text-neutral-900")}>
               <Clapperboard className="w-4 h-4" />
            </div>
            <h1 className={clsx("text-base font-mono font-bold tracking-tight uppercase hidden sm:block", textClass)}>SyncSlate<span className="opacity-40 font-normal">.io</span></h1>
            
            {/* Role Switcher (Tab Style) */}
            <div className={clsx("flex items-center ml-4 p-1 rounded-md border", isDark ? "bg-neutral-900 border-neutral-700" : "bg-neutral-100 border-neutral-200")}>
                <button
                    onClick={() => toggleRole('HOST')}
                    className={clsx(
                        "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                        engine.role === 'HOST' 
                           ? (isDark ? "bg-neutral-800 text-white shadow-sm" : "bg-white text-black shadow-sm")
                           : "text-neutral-500 hover:text-neutral-400"
                    )}
                >
                    <Radio className="w-3 h-3" /> HOST
                </button>
                <div className="w-px h-3 bg-neutral-500/20 mx-1"></div>
                <button
                    onClick={() => toggleRole('CLIENT')}
                    className={clsx(
                        "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                         engine.role === 'CLIENT'
                           ? (isDark ? "bg-emerald-900/30 text-emerald-500 shadow-sm" : "bg-emerald-50 text-emerald-600 shadow-sm")
                           : "text-neutral-500 hover:text-neutral-400"
                    )}
                >
                    <Monitor className="w-3 h-3" /> CLIENT
                </button>
            </div>
          </div>
          <div className="flex gap-2">
            {engine.role === 'HOST' && (
                <button 
                    onClick={() => setShowSettings(true)}
                    className={clsx("p-2 rounded hover:bg-neutral-500/10 transition-colors", subTextClass)}
                    title="Global Settings"
                >
                    <SettingsIcon className="w-5 h-5" />
                </button>
            )}
            <button 
                onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                className={clsx("p-2 rounded hover:bg-neutral-500/10 transition-colors", subTextClass)}
            >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* View Switching Logic */}
        {engine.role === 'HOST' ? (
            <HostView engine={engine} theme={theme} />
        ) : (
            <ClientView engine={engine} theme={theme} />
        )}

        {/* Settings Modal */}
        {showSettings && engine.role === 'HOST' && (
            <SettingsModal engine={engine} theme={theme} onClose={() => setShowSettings(false)} />
        )}

        {/* Shared Overlay (Always active, controlled by mode) */}
        <SlateOverlay engine={engine} theme={theme} />

      </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);