# SyncSlate AI - Architecture & Data Flow Memory

## 🎯 Core Concept

**Two-Mode Architecture**: HOST (control) + CLIENT (display-only, forever free)

## 📐 Architecture Overview

### Mode Determination
- **Location**: `index.tsx:254-259`
- **Logic**: URL parameter `?role=client` determines CLIENT mode, otherwise HOST
- **Future**: HOST will require Clerk authentication, CLIENT remains auth-free

### Sync Modes

#### 1. BroadcastChannel (Default)
- Same browser instance only
- Auto-enabled when `VITE_SUPABASE_URL` is not set
- Zero configuration required

#### 2. Supabase Realtime
- Cross-device synchronization
- Requires environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Auto-enabled when Supabase URL is configured

**Mode Detection**: `index.tsx:262-265`
```typescript
const [syncMode, setSyncMode] = useState<SyncMode>(() => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return supabaseUrl ? 'supabase' : 'broadcast';
});
```

## 📡 Message Protocol

### Three Message Types

1. **SYNC_STATE** - Settings synchronization
   - Sent: HOST on settings change (500ms debounced)
   - Received: CLIENT applies settings
   - Location: `index.tsx:641-648` (send), `index.tsx:550-558` (receive)

2. **CMD_START** - Countdown start
   - Sent: HOST on start button
   - Timing: `Date.now() + 500ms` (sync buffer)
   - Location: `index.tsx:509-526`

3. **CMD_STOP** - Countdown stop
   - Sent: HOST on stop button
   - Location: `index.tsx:384-394`

## 🗄️ Supabase Schema

### Tables

#### sync_sessions
```sql
- id (uuid, PK)
- host_id (text)
- settings (jsonb)
- smart_cues (jsonb)
- color_ranges (jsonb)
- created_at, updated_at (timestamp)
```

#### sync_devices
```sql
- id (uuid, PK)
- session_id (uuid, FK)
- device_id (text)
- role (text: 'HOST' | 'CLIENT')
- connected_at, last_seen (timestamp)
```

#### sync_events
```sql
- id (uuid, PK)
- session_id (uuid, FK)
- event_type (text)
- payload (jsonb)
- server_timestamp (timestamp)
```

## 🔄 Data Flow

### HOST Session Creation
1. `SupabaseSyncEngine.createSession()` - `services/supabase-sync-engine.ts:81-118`
2. Inserts into `sync_sessions` table
3. Joins own session as device
4. Returns session ID

### CLIENT Session Join
1. Get session ID from URL: `?session=xxx`
2. `SupabaseSyncEngine.joinSession()` - `services/supabase-sync-engine.ts:123-177`
3. Fetches session from `sync_sessions`
4. Inserts into `sync_devices` table
5. Subscribes to Realtime channel

### Settings Sync Flow
```
HOST changes settings
  ↓ (500ms debounce)
HOST: updateSession() → Supabase
  ↓ (Realtime broadcast)
CLIENT: receives SYNC_STATE
  ↓
CLIENT: applies settings to local state
```

### Countdown Flow
```
HOST: clicks START
  ↓
Calculate: startTime = Date.now() + 500ms
  ↓
Send CMD_START with startTime
  ↓ (parallel)
┌─────────────┬─────────────┐
HOST          CLIENT        CLIENT
executes      receives      receives
immediately   CMD_START     CMD_START
  ↓             ↓             ↓
All devices start countdown at exact same time
```

## 🔊 Audio System

### Audio Context Unlocking
- **Issue**: iOS/Safari blocks audio without user interaction
- **Solution**: "Click to Enable Audio" button
- **Location**: `index.tsx:829-851`

### Process
1. User clicks button
2. `AudioEngine.resume()` - `gemini-api.ts:306-311`
3. Play test tone (440Hz, 0.1s)
4. `audioEnabled = true`

### Japanese Voice Preload
- **Trigger**: When `voiceLanguage === 'jp'`
- **Location**: `index.tsx:872-918`
- **Files**: 61 voice files (0-60) from `/voices/num000_02_01.wav` to `num060_02_01.wav`
- **Method**: Web Audio API with AudioBuffer caching
- **Progress**: Real-time progress display

## 🐛 Critical Fixes Applied

### Fix 1: Supabase Query Error (PGRST116)
- **Issue**: `.single()` throws error when 0 rows
- **Fix**: Changed to `.maybeSingle()` in 3 locations
- **Commit**: `a194ec9`
- **Files**: `services/supabase-sync-engine.ts:96, 130, 146`

### Fix 2: Preload Scope Error
- **Issue**: `preloadStartedRef` defined in hook but used in component
- **Fix**: Moved ref to `ClientView` component scope
- **Commit**: `a17636e`
- **File**: `index.tsx:825-827`

### Fix 3: API Key Exposure
- **Issue**: Real Gemini API key in `.env.platform`
- **Fix**: Deleted file, kept `.env.example` with placeholders
- **Commit**: `b924b93`

## 🔒 Security Best Practices

### Environment Variables
- **Location**: `.env.local` (gitignored)
- **Never commit**: `.env.local`, `.env.production`
- **Template**: `.env.example` (safe to commit)

### API Keys
- Gemini: `GEMINI_API_KEY` (no VITE_ prefix, accessed via `vite.config.ts`)
- Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Clerk (future): `VITE_CLERK_PUBLISHABLE_KEY`

## ⚠️ Known Issues & Solutions

### Issue 1: Session ID Not Displayed
- **Problem**: HOST creates session but ID not shown in UI
- **State**: `supabaseSessionId` exists in engine but unused
- **Solution**: Add share button with URL generation

### Issue 2: No CLIENT Waiting Screen
- **Problem**: CLIENT shows normal UI instead of "Waiting for HOST"
- **Solution**: Add conditional rendering for `!settings` state

### Issue 3: No Fallback on Supabase Failure
- **Problem**: No retry or fallback to BroadcastChannel
- **Solution**: Add error handling with automatic fallback

## 📁 Critical File Locations

### Core Application
- `index.tsx` - Main app, HOST/CLIENT views, sync logic
- `types/sync.ts` - All type definitions

### Services
- `services/supabase-sync-engine.ts` - Supabase Realtime integration
- `services/supabase-client.ts` - Supabase client initialization
- `services/platform-core-client.ts` - Future: Billing/auth integration
- `gemini-api.ts` - Audio engine, voice synthesis, preload

### Configuration
- `vite.config.ts` - Environment variable mapping
- `.env.example` - Template for environment variables
- `.gitignore` - Ensures secrets not committed

## 🎨 UI Component Structure

```
App (root)
├── HostView (role === 'HOST')
│   ├── Settings Panel
│   ├── Control Panel
│   └── Slate Overlay
└── ClientView (role === 'CLIENT')
    ├── Audio Enable Button
    ├── Connection Status
    └── Slate Overlay (shared)
```

## 🔍 Debug Console Logs

### Look for these patterns:
- `[HOST]` / `[CLIENT]` - Role-specific logs
- `[SupabaseSyncEngine]` - Sync engine operations
- `[Audio Preload]` - Voice file loading
- `[GeminiAudio]` - Audio playback events

### Key Success Messages
- `[SupabaseSyncEngine] Subscribed to channel: session:xxx`
- `[HOST] CMD_START message sent`
- `[CLIENT] Applying SYNC_STATE from HOST`
- `[Audio Preload] Completed successfully`

## 🚀 Deployment

### Vercel Auto-Deploy
- **Trigger**: `git push origin main`
- **Project**: syncslate_20251128
- **URL**: https://syncslate-20251128.vercel.app/

### Environment Variables (Vercel)
Must be set in Vercel dashboard:
- `GEMINI_API_KEY`
- `VITE_SUPABASE_URL` (if using Supabase)
- `VITE_SUPABASE_ANON_KEY` (if using Supabase)

## 📊 Performance Targets

| Metric | HOST | CLIENT |
|--------|------|--------|
| Initial Load | < 3s | < 1s |
| Bundle Size | < 300KB | < 50KB (future) |
| Memory | < 100MB | < 20MB |
| CPU | < 30% | < 10% |

## 🧪 Testing Scenarios

### Scenario 1: Same Browser Tabs
1. Open HOST: `http://localhost:5173/`
2. Open CLIENT: `http://localhost:5173/?role=client`
3. Change settings in HOST → CLIENT updates
4. Start countdown in HOST → Both sync

### Scenario 2: Cross-Device (Supabase)
1. Configure Supabase in `.env.local`
2. HOST creates session, gets session ID
3. CLIENT opens: `http://localhost:5173/?role=client&session=xxx`
4. Verify real-time sync across devices

## 🔧 Common Recovery Commands

### Reset Audio State
```typescript
const audioEngine = getGeminiAudioEngine();
audioEngine.resume();
```

### Clear Device ID
```javascript
localStorage.removeItem('syncslate_device_id');
```

### Force Sync Mode
```javascript
// In browser console
window.location.href = '/?role=client&session=xxx';
```

## 📚 Documentation Files

- `HOST_CLIENT_ARCHITECTURE.md` - Detailed architecture guide
- `PRECISION_SYNC_ARCHITECTURE.md` - Timing sync details
- `README.md` - User-facing documentation
- `.claude/CLAUDE.md` - AI development guidelines

## 🎯 Future Roadmap

### Phase 1: Session Sharing (Priority)
- Add "Share Session" button in HOST
- QR code generation
- Clipboard copy functionality

### Phase 2: Auth Integration
- Clerk authentication for HOST
- CLIENT remains auth-free
- Auth gate implementation

### Phase 3: Billing (Platform Core)
- Subscription management
- Usage quota checks
- Free tier for CLIENT (permanent)

### Phase 4: Optimization
- Separate HOST/CLIENT builds
- Tree-shaking for CLIENT
- Code splitting

---

**Last Updated**: 2024-12-06
**Current Commit**: b924b93
**Version**: MVP Complete
