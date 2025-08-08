# LLMコーディング支援コンテキストガイド
Version: 1.0
Date: 2025-08-08
Status: Active

## 目的
LLM（Large Language Model）が効率的かつ正確にコーディングを行うために必要な情報を体系化し、プロジェクトの実装品質を向上させる。

---

## 1. 🎯 LLMが最も必要とする情報

### 1.1 プロジェクトコンテキスト

```yaml
# PROJECT_CONTEXT.yaml として用意すると良い
project:
  name: "AutoEditTATE"
  type: "desktop-application"
  stage: "MVP開発"
  
tech_stack:
  frontend: ["React", "TypeScript", "Electron"]
  backend: ["Node.js", "Rust (予定)"]
  database: ["SQLite (ローカル)"]
  build_tools: ["Vite", "electron-builder"]
  
conventions:
  naming: "camelCase for functions, PascalCase for components"
  file_structure: "feature-based"
  error_handling: "Result pattern with explicit error types"
```

### 1.2 依存関係の明示

```json
// DEPENDENCIES_SNAPSHOT.json
{
  "production": {
    "electron": "^27.0.0",
    "react": "^18.2.0",
    "typescript": "^5.3.0"
  },
  "available_utilities": {
    "lodash": true,
    "date-fns": true,
    "zod": true
  },
  "do_not_use": [
    "moment.js (use date-fns instead)",
    "axios (use native fetch)"
  ]
}
```

---

## 2. 📁 ファイル構造とパターン

### 2.1 ディレクトリマップ

```markdown
# CODEBASE_MAP.md
## Core Directories
- `/app/main/` - Electronメインプロセス (IPC通信、ファイルシステム)
- `/app/renderer/` - React UI (ユーザーインターフェース)
- `/app/preload/` - セキュリティブリッジ (contextBridge API)
- `/native/` - Rust拡張 (パフォーマンスクリティカル処理)

## Key Files
- `app/main/main.ts` - エントリーポイント、ウィンドウ管理
- `app/preload/preload.ts` - API露出、セキュリティ
- `app/renderer/App.tsx` - UIルートコンポーネント
```

### 2.2 コードパターンサンプル

```typescript
// CODE_PATTERNS.ts
// 既存のエラーハンドリングパターン
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// 既存のIPC通信パターン
export const ipcPattern = {
  invoke: "invoke:channel-name",
  handle: "handle:channel-name",
  on: "on:channel-name"
};

// 既存のコンポーネントパターン
export const ComponentPattern = ({ data }: Props) => {
  const [state, setState] = useState();
  // implementation
  return <div>...</div>;
};
```

---

## 3. 🔧 実装制約と要件

### 3.1 技術的制約

```markdown
# CONSTRAINTS.md
## Must Follow
- Electron contextIsolation: true (必須)
- nodeIntegration: false (セキュリティ)
- CSP (Content Security Policy) 準拠
- 非同期処理は全てPromise/async-await

## Performance Requirements
- 起動時間: < 3秒
- メモリ使用量: < 500MB (アイドル時)
- レンダリング: 60fps維持

## Security Requirements
- ユーザー入力は必ずサニタイズ
- ファイルパスは必ず検証
- 外部URLは許可リスト制御
```

### 3.2 ビジネスロジック仕様

```typescript
// BUSINESS_RULES.ts
export const BusinessRules = {
  video: {
    maxDuration: 300, // 秒
    supportedFormats: ['mp4', 'mov', 'mxf'],
    minResolution: { width: 640, height: 480 }
  },
  
  timeline: {
    minClipLength: 12, // フレーム
    maxClips: 200,
    snapThreshold: 3 // フレーム
  },
  
  export: {
    presets: ['H.264', 'ProRes'],
    defaultQuality: 'high'
  }
};
```

---

## 4. 🎨 UI/UXガイドライン

### 4.1 デザインシステム

```css
/* DESIGN_TOKENS.css */
:root {
  /* Colors */
  --primary: #3B82F6;
  --secondary: #10B981;
  --danger: #EF4444;
  --background: #FFFFFF;
  --surface: #F9FAFB;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  /* Typography */
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

### 4.2 コンポーネントライブラリ

```typescript
// COMPONENT_INVENTORY.ts
export const AvailableComponents = {
  // 既に実装済み
  existing: [
    'Button',
    'Input',
    'Modal',
    'Timeline',
    'VideoPlayer'
  ],
  
  // インポート可能
  fromLibrary: {
    '@radix-ui': ['Dialog', 'Dropdown', 'Tooltip'],
    'lucide-react': ['icons'],
    'framer-motion': ['motion components']
  },
  
  // 実装が必要
  needsImplementation: [
    'ThumbnailGrid',
    'SceneMarker',
    'LyricsEditor'
  ]
};
```

---

## 5. 🧪 テストとデバッグ

### 5.1 テスト戦略

```javascript
// TEST_GUIDE.js
module.exports = {
  structure: {
    unit: '__tests__/*.test.ts',
    integration: '__tests__/integration/*.test.ts',
    e2e: 'e2e/*.spec.ts'
  },
  
  commands: {
    test: 'npm test',
    testWatch: 'npm test -- --watch',
    testCoverage: 'npm test -- --coverage'
  },
  
  mockPatterns: {
    electron: 'use __mocks__/electron.js',
    fs: 'use memfs for file system',
    api: 'use msw for API mocking'
  }
};
```

### 5.2 デバッグ情報

```typescript
// DEBUG_HELPERS.ts
export const DebugInfo = {
  // ログレベル
  logLevels: ['error', 'warn', 'info', 'debug', 'trace'],
  
  // デバッグコマンド
  commands: {
    inspector: 'npm run dev -- --inspect',
    devtools: 'Ctrl+Shift+I in app',
    clearCache: 'npm run clear-cache'
  },
  
  // よくある問題と解決法
  commonIssues: {
    'Module not found': 'Run npm install in both root and app/renderer',
    'IPC timeout': 'Check main/preload bridge implementation',
    'White screen': 'Check console for React errors'
  }
};
```

---

## 6. 📝 コード生成テンプレート

### 6.1 新機能追加テンプレート

```typescript
// FEATURE_TEMPLATE.ts
// 新機能を追加する際の標準構造

// 1. Types definition
export interface FeatureProps {
  // props
}

// 2. Main implementation
export const Feature: React.FC<FeatureProps> = (props) => {
  // hooks
  // handlers
  // effects
  // render
};

// 3. IPC handlers (if needed)
ipcMain.handle('feature:action', async (event, args) => {
  // implementation
});

// 4. Tests
describe('Feature', () => {
  it('should...', () => {
    // test
  });
});
```

---

## 7. 🚀 実装優先順位

```markdown
# IMPLEMENTATION_PRIORITY.md
## Critical Path (MVP必須)
1. ✅ 基本UI構造
2. ⬜ 動画インポート機能
3. ⬜ サムネイル生成
4. ⬜ タイムライン実装
5. ⬜ 書き出し機能

## Nice to Have
- ⬜ ショートカットキー
- ⬜ Undo/Redo
- ⬜ プリセット保存

## Future
- ⬜ AI解析機能
- ⬜ クラウド同期
```

---

## 8. 🔍 既存実装の参照箇所

```yaml
# WHERE_TO_LOOK.yaml
patterns:
  ipc_communication:
    example: "app/main/main.ts:45-67"
    pattern: "ipcMain.handle()"
    
  react_component:
    example: "app/renderer/App.tsx"
    pattern: "functional component with hooks"
    
  error_handling:
    example: "app/shared/utils/result.ts"
    pattern: "Result<T, E> type"
    
  async_operations:
    example: "app/main/handlers/fileHandler.ts"
    pattern: "async/await with try-catch"
```

---

## 9. ⚠️ アンチパターン（避けるべき実装）

```typescript
// AVOID_PATTERNS.ts
// ❌ 避けるべき
const badExample = {
  directDOM: document.getElementById('...'), // React内でのDOM直接操作
  syncFileOps: fs.readFileSync(), // メインプロセスでの同期処理
  globalState: window.globalVar = value, // グローバル変数
  anyType: (data: any) => {}, // any型の使用
};

// ✅ 推奨
const goodExample = {
  reactRef: useRef(),
  asyncFileOps: await fs.promises.readFile(),
  contextState: useContext(AppContext),
  strictTypes: (data: VideoMetadata) => {},
};
```

---

## 10. 📋 チェックリスト

LLMがコードを生成する前に確認すべき項目：

- [ ] 既存のコードパターンを確認したか
- [ ] 依存関係が利用可能か確認したか
- [ ] セキュリティ制約を考慮したか
- [ ] エラーハンドリングを適切に実装したか
- [ ] TypeScriptの型を正しく定義したか
- [ ] 既存のコンポーネント/ユーティリティを再利用したか
- [ ] テストを書く準備ができているか
- [ ] パフォーマンス要件を満たしているか

---

## 更新履歴
| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2025-08-08 | 1.0 | 初版作成 |