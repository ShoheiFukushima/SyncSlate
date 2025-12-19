# SMART CUES データアーキテクチャ設計

## 📊 型定義

### SmartCue型

```typescript
/**
 * SMART CUEの基本型定義
 */
interface SmartCue {
  /** 一意識別子 (UUID v4) */
  id: string;

  /** タイムスタンプ（秒単位、0始まり） */
  timestamp: number;

  /** 音声タイプ */
  audioType: AudioType;

  /** テキスト読み上げ用（audioType='text'の場合） */
  text?: string;

  /** 電話コール回数（audioType='phone'の場合、1-10） */
  phoneRings?: number;

  /** カスタム音声URL（audioType='custom'の場合、Base64 data URL） */
  customAudioUrl?: string;

  /** カスタム音声の長さ（秒単位） */
  customAudioDuration?: number;

  /** カスタム音声のファイル名 */
  customAudioFilename?: string;

  /** 作成日時（ISO 8601） */
  createdAt: string;

  /** 最終更新日時（ISO 8601） */
  updatedAt: string;
}

/**
 * 音声タイプの列挙型
 */
type AudioType = 'number' | 'text' | 'gunshot' | 'phone' | 'custom';

/**
 * 音声タイプのメタデータ
 */
interface AudioTypeMetadata {
  type: AudioType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const AUDIO_TYPE_METADATA: Record<AudioType, AudioTypeMetadata> = {
  number: {
    type: 'number',
    label: '数字',
    icon: '🔢',
    color: '#6B7280',
    description: '通常のカウント数字を読み上げ',
  },
  text: {
    type: 'text',
    label: 'テキスト',
    icon: '📝',
    color: '#8B5CF6',
    description: '指定したテキストを読み上げ（最大0.8秒）',
  },
  gunshot: {
    type: 'gunshot',
    label: '鉄砲',
    icon: '🔫',
    color: '#DC2626',
    description: '銃声効果音を再生',
  },
  phone: {
    type: 'phone',
    label: '電話コール',
    icon: '📞',
    color: '#059669',
    description: '電話のコール音を指定回数再生',
  },
  custom: {
    type: 'custom',
    label: 'カスタム音声',
    icon: '🎵',
    color: '#EA580C',
    description: 'アップロードした音声ファイルを再生',
  },
};
```

### Session型

```typescript
/**
 * セッション（撮影テイク）の型定義
 */
interface Session {
  /** セッションID（例: "session_20250112_001"） */
  id: string;

  /** セッション名（ユーザーが編集可能） */
  name: string;

  /** シーン番号 */
  sceneNumber?: string;

  /** テイク番号 */
  takeNumber?: number;

  /** セッションに関連するCUE一覧 */
  smartCues: SmartCue[];

  /** セッション設定 */
  config: SessionConfig;

  /** 作成日時（ISO 8601） */
  createdAt: string;

  /** 最終更新日時（ISO 8601） */
  updatedAt: string;
}

/**
 * セッション設定
 */
interface SessionConfig {
  /** シーケンス長（秒単位） */
  sequenceDuration: number;

  /** Pre-roll時間（秒単位） */
  preRollDuration: number;

  /** ビープ音の有効/無効 */
  beepEnabled: boolean;

  /** カウント音声の有効/無効 */
  countVoiceEnabled: boolean;

  /** SMART CUESの有効/無効 */
  smartCuesEnabled: boolean;
}
```

### LocalStorage構造

```typescript
/**
 * LocalStorageに保存されるデータ構造
 */
interface SyncSlateStorage {
  /** 現在のセッションID */
  currentSessionId: string | null;

  /** すべてのセッション */
  sessions: Session[];

  /** アプリケーション設定 */
  appSettings: AppSettings;

  /** バージョン番号（マイグレーション用） */
  version: string;
}

/**
 * アプリケーション設定
 */
interface AppSettings {
  /** Gemini APIキー（暗号化推奨） */
  geminiApiKey?: string;

  /** デフォルトのシーケンス長 */
  defaultSequenceDuration: number;

  /** デフォルトのPre-roll時間 */
  defaultPreRollDuration: number;

  /** テーマ（light/dark） */
  theme: 'light' | 'dark';

  /** 言語 */
  language: 'ja' | 'en';
}
```

---

## 🗄️ ステート管理設計

### Reactステート構造

```typescript
// メインアプリケーションステート
function SyncSlateApp() {
  // セッション管理
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  // SMART CUES管理
  const [smartCues, setSmartCues] = useState<SmartCue[]>([]);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);

  // スレート実行状態
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lastPinTime, setLastPinTime] = useState(0);

  // UI状態
  const [showSmartCuesEditor, setShowSmartCuesEditor] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  // AudioContext（音声再生用）
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // ...
}
```

### カスタムフック設計

#### useSmartCues

```typescript
/**
 * SMART CUES管理のカスタムフック
 */
function useSmartCues(sessionId: string) {
  const [cues, setCues] = useState<SmartCue[]>([]);

  // CUEの追加
  const addCue = useCallback((timestamp: number): SmartCue => {
    const newCue: SmartCue = {
      id: uuidv4(),
      timestamp,
      audioType: 'text',
      text: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCues(prev => [...prev, newCue].sort((a, b) => a.timestamp - b.timestamp));
    return newCue;
  }, []);

  // CUEの更新
  const updateCue = useCallback((id: string, updates: Partial<SmartCue>) => {
    setCues(prev =>
      prev.map(cue =>
        cue.id === id
          ? { ...cue, ...updates, updatedAt: new Date().toISOString() }
          : cue
      )
    );
  }, []);

  // CUEの削除
  const deleteCue = useCallback((id: string) => {
    setCues(prev => prev.filter(cue => cue.id !== id));
  }, []);

  // すべてのCUEをクリア
  const clearAllCues = useCallback(() => {
    setCues([]);
  }, []);

  // 特定のタイムスタンプのCUEを取得
  const getCueByTimestamp = useCallback(
    (timestamp: number): SmartCue | undefined => {
      return cues.find(cue => cue.timestamp === timestamp);
    },
    [cues]
  );

  // LocalStorageへの保存
  useEffect(() => {
    const storage = loadStorage();
    const session = storage.sessions.find(s => s.id === sessionId);
    if (session) {
      session.smartCues = cues;
      session.updatedAt = new Date().toISOString();
      saveStorage(storage);
    }
  }, [cues, sessionId]);

  return {
    cues,
    addCue,
    updateCue,
    deleteCue,
    clearAllCues,
    getCueByTimestamp,
  };
}
```

#### useAudioPlayback

```typescript
/**
 * 音声再生管理のカスタムフック
 */
function useAudioPlayback() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // AudioContextの初期化
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  // テキスト読み上げ（0.8秒制限）
  const speakTextWithLimit = useCallback(
    async (text: string, maxDuration: number = 0.8) => {
      const audioContext = initAudioContext();
      const audioBuffer = await generateTTS(text);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      currentSourceRef.current = source;

      const startTime = audioContext.currentTime;
      source.start(startTime);

      // 0.8秒後に強制停止
      setTimeout(() => {
        if (currentSourceRef.current === source) {
          source.stop();
          currentSourceRef.current = null;
        }
      }, maxDuration * 1000);

      return new Promise<void>(resolve => {
        source.onended = () => resolve();
      });
    },
    [initAudioContext]
  );

  // プリセット効果音の再生
  const playPresetSound = useCallback(
    async (soundType: 'gunshot' | 'phone') => {
      const audioContext = initAudioContext();
      const audioBuffer = await loadPresetSound(soundType);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      currentSourceRef.current = source;
      source.start(audioContext.currentTime);

      return new Promise<void>(resolve => {
        source.onended = () => {
          currentSourceRef.current = null;
          resolve();
        };
      });
    },
    [initAudioContext]
  );

  // 電話コールの再生（指定回数）
  const playPhoneRings = useCallback(
    async (rings: number) => {
      for (let i = 0; i < rings; i++) {
        await playPresetSound('phone');
        if (i < rings - 1) {
          await sleep(0.3); // コール間の間隔
        }
      }
    },
    [playPresetSound]
  );

  // カスタム音声の再生
  const playCustomAudio = useCallback(
    async (dataUrl: string, duration: number) => {
      return new Promise<void>((resolve, reject) => {
        const audio = new Audio(dataUrl);

        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('音声再生エラー'));

        audio.play();

        // 安全のため、duration + 0.1秒で強制終了
        setTimeout(() => {
          audio.pause();
          resolve();
        }, (duration + 0.1) * 1000);
      });
    },
    []
  );

  // 現在の音声を停止
  const stopCurrentAudio = useCallback(() => {
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
    }
  }, []);

  return {
    speakTextWithLimit,
    playPresetSound,
    playPhoneRings,
    playCustomAudio,
    stopCurrentAudio,
  };
}
```

#### useFileUpload

```typescript
/**
 * ファイルアップロード管理のカスタムフック
 */
function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadAudioFile = useCallback(
    async (file: File): Promise<{ dataUrl: string; duration: number }> => {
      // ファイルサイズチェック（5MB制限）
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) {
        throw new Error('ファイルサイズは5MB以下にしてください');
      }

      // 対応フォーマットチェック
      const SUPPORTED_FORMATS = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
      if (!SUPPORTED_FORMATS.includes(file.type)) {
        throw new Error('対応していない音声フォーマットです（mp3, wav, oggのみ）');
      }

      setUploading(true);
      setProgress(0);

      try {
        // FileをBase64に変換
        const dataUrl = await fileToBase64(file, (percent) => {
          setProgress(percent);
        });

        // 音声の長さを取得
        const duration = await getAudioDuration(dataUrl);

        setProgress(100);
        return { dataUrl, duration };
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    []
  );

  return {
    uploading,
    progress,
    uploadAudioFile,
  };
}

/**
 * FileをBase64に変換
 */
function fileToBase64(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error('ファイル読み込みエラー'));
    };

    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 音声の長さを取得
 */
function getAudioDuration(dataUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(dataUrl);

    audio.onloadedmetadata = () => {
      resolve(audio.duration);
    };

    audio.onerror = () => {
      reject(new Error('音声メタデータの取得に失敗'));
    };
  });
}
```

---

## 💾 LocalStorage操作

### ストレージ操作ユーティリティ

```typescript
const STORAGE_KEY = 'syncslate_storage';
const STORAGE_VERSION = '1.0.0';

/**
 * ストレージの読み込み
 */
function loadStorage(): SyncSlateStorage {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return getDefaultStorage();
    }

    const storage: SyncSlateStorage = JSON.parse(data);

    // バージョンチェック＆マイグレーション
    if (storage.version !== STORAGE_VERSION) {
      return migrateStorage(storage);
    }

    return storage;
  } catch (error) {
    console.error('Storage load error:', error);
    return getDefaultStorage();
  }
}

/**
 * ストレージの保存
 */
function saveStorage(storage: SyncSlateStorage): void {
  try {
    const data = JSON.stringify(storage);
    localStorage.setItem(STORAGE_KEY, data);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('ストレージ容量が不足しています。不要なセッションを削除してください。');
    }
    throw error;
  }
}

/**
 * デフォルトストレージの取得
 */
function getDefaultStorage(): SyncSlateStorage {
  return {
    currentSessionId: null,
    sessions: [],
    appSettings: {
      defaultSequenceDuration: 10,
      defaultPreRollDuration: 3,
      theme: 'light',
      language: 'ja',
    },
    version: STORAGE_VERSION,
  };
}

/**
 * ストレージのマイグレーション
 */
function migrateStorage(oldStorage: any): SyncSlateStorage {
  console.log('Migrating storage from', oldStorage.version, 'to', STORAGE_VERSION);

  // バージョン別のマイグレーションロジック
  // 例: v0.9.0 -> v1.0.0
  if (!oldStorage.version || oldStorage.version === '0.9.0') {
    return {
      ...getDefaultStorage(),
      sessions: oldStorage.sessions || [],
    };
  }

  return oldStorage;
}
```

### セッション操作

```typescript
/**
 * 新しいセッションを作成
 */
function createSession(config?: Partial<SessionConfig>): Session {
  const now = new Date().toISOString();
  const sessionId = `session_${Date.now()}`;

  const defaultConfig: SessionConfig = {
    sequenceDuration: 10,
    preRollDuration: 3,
    beepEnabled: true,
    countVoiceEnabled: true,
    smartCuesEnabled: true,
  };

  return {
    id: sessionId,
    name: `Session ${new Date().toLocaleString('ja-JP')}`,
    smartCues: [],
    config: { ...defaultConfig, ...config },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * セッションを保存
 */
function saveSession(session: Session): void {
  const storage = loadStorage();

  const existingIndex = storage.sessions.findIndex(s => s.id === session.id);
  if (existingIndex >= 0) {
    storage.sessions[existingIndex] = {
      ...session,
      updatedAt: new Date().toISOString(),
    };
  } else {
    storage.sessions.push(session);
  }

  storage.currentSessionId = session.id;
  saveStorage(storage);
}

/**
 * セッションを削除
 */
function deleteSession(sessionId: string): void {
  const storage = loadStorage();
  storage.sessions = storage.sessions.filter(s => s.id !== sessionId);

  if (storage.currentSessionId === sessionId) {
    storage.currentSessionId = storage.sessions[0]?.id || null;
  }

  saveStorage(storage);
}

/**
 * セッションを読み込み
 */
function loadSession(sessionId: string): Session | null {
  const storage = loadStorage();
  return storage.sessions.find(s => s.id === sessionId) || null;
}

/**
 * すべてのセッションを取得
 */
function getAllSessions(): Session[] {
  const storage = loadStorage();
  return storage.sessions.sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
```

---

## 🔄 データフロー図

```
┌─────────────────────────────────────────────────────────┐
│                    User Actions                         │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│                  Event Handlers                         │
│  - handleAddPin()                                       │
│  - handleUpdateCue()                                    │
│  - handleDeleteCue()                                    │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│              Custom Hooks (State Update)                │
│  - useSmartCues.addCue()                                │
│  - useSmartCues.updateCue()                             │
│  - useSmartCues.deleteCue()                             │
└───────────────┬─────────────────────────────────────────┘
                │
                ├─────────────────────────────────┐
                ▼                                 ▼
┌────────────────────────────┐   ┌────────────────────────────┐
│   React State Update       │   │   LocalStorage Save        │
│   - setCues()              │   │   - saveStorage()          │
│   - setSmartCues()         │   │   - saveSession()          │
└────────────┬───────────────┘   └────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│                   UI Re-render                          │
│  - CueCard components                                   │
│  - SmartCuesEditor                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 セキュリティとバリデーション

### データバリデーション

```typescript
/**
 * SmartCueのバリデーション
 */
function validateSmartCue(cue: Partial<SmartCue>): ValidationResult {
  const errors: string[] = [];

  // タイムスタンプチェック
  if (cue.timestamp === undefined || cue.timestamp < 0) {
    errors.push('タイムスタンプが不正です');
  }

  // 音声タイプ別のバリデーション
  switch (cue.audioType) {
    case 'text':
      if (!cue.text || cue.text.trim().length === 0) {
        errors.push('テキストが空です');
      }
      if (cue.text && cue.text.length > 50) {
        errors.push('テキストは50文字以内にしてください');
      }
      break;

    case 'phone':
      if (!cue.phoneRings || cue.phoneRings < 1 || cue.phoneRings > 10) {
        errors.push('コール回数は1〜10回の範囲で指定してください');
      }
      break;

    case 'custom':
      if (!cue.customAudioUrl) {
        errors.push('音声ファイルが未設定です');
      }
      if (!cue.customAudioDuration || cue.customAudioDuration <= 0) {
        errors.push('音声の長さが不正です');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
```

### XSS対策

```typescript
/**
 * テキストのサニタイズ
 */
function sanitizeText(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * CUEのサニタイズ
 */
function sanitizeCue(cue: SmartCue): SmartCue {
  return {
    ...cue,
    text: cue.text ? sanitizeText(cue.text) : undefined,
    customAudioFilename: cue.customAudioFilename
      ? sanitizeText(cue.customAudioFilename)
      : undefined,
  };
}
```

---

## 📈 パフォーマンス最適化

### メモ化

```typescript
import { useMemo } from 'react';

function SmartCuesEditor({ cues }: { cues: SmartCue[] }) {
  // CUEのソート（タイムスタンプ順）
  const sortedCues = useMemo(() => {
    return [...cues].sort((a, b) => a.timestamp - b.timestamp);
  }, [cues]);

  // CUEの統計情報
  const stats = useMemo(() => {
    const byType = cues.reduce((acc, cue) => {
      acc[cue.audioType] = (acc[cue.audioType] || 0) + 1;
      return acc;
    }, {} as Record<AudioType, number>);

    return {
      total: cues.length,
      byType,
    };
  }, [cues]);

  // ...
}
```

### 仮想スクロール（50個以上のCUE）

```typescript
import { FixedSizeList as List } from 'react-window';

function SmartCuesList({ cues }: { cues: SmartCue[] }) {
  if (cues.length < 50) {
    // 通常レンダリング
    return (
      <div className="cues-grid">
        {cues.map(cue => (
          <CueCard key={cue.id} cue={cue} />
        ))}
      </div>
    );
  }

  // 仮想スクロール
  return (
    <List
      height={600}
      itemCount={cues.length}
      itemSize={150}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <CueCard cue={cues[index]} />
        </div>
      )}
    </List>
  );
}
```

---

## 🧪 テストデータ

### モックデータ生成

```typescript
/**
 * テスト用のSmartCueを生成
 */
function createMockCue(overrides?: Partial<SmartCue>): SmartCue {
  return {
    id: uuidv4(),
    timestamp: 0,
    audioType: 'text',
    text: 'アクション！',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * テスト用のSessionを生成
 */
function createMockSession(overrides?: Partial<Session>): Session {
  const now = new Date().toISOString();

  return {
    id: `session_${Date.now()}`,
    name: 'テストセッション',
    smartCues: [
      createMockCue({ timestamp: 3, audioType: 'text', text: 'アクション！' }),
      createMockCue({ timestamp: 7, audioType: 'phone', phoneRings: 3 }),
      createMockCue({ timestamp: 12, audioType: 'gunshot' }),
    ],
    config: {
      sequenceDuration: 15,
      preRollDuration: 3,
      beepEnabled: true,
      countVoiceEnabled: true,
      smartCuesEnabled: true,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
```

---

**作成日**: 2025-01-12
**最終更新**: 2025-01-12
**ステータス**: 設計完了、実装待ち
