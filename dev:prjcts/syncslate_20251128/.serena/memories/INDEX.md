# Serena Memory Index - SyncSlate AI

## 📚 Available Memories

### syncslate_architecture.md (8.7KB)
**Purpose**: Complete architecture, data flow, and recovery guide for SyncSlate AI

**Contains**:
- Core concepts (HOST/CLIENT architecture)
- Sync modes (BroadcastChannel/Supabase)
- Message protocol (SYNC_STATE, CMD_START, CMD_STOP)
- Data flow diagrams
- Supabase schema
- Audio system (iOS unlock, preload)
- Critical fixes applied (3 major fixes)
- Security best practices
- Known issues & solutions
- File locations
- Debug patterns
- Deployment info
- Testing scenarios
- Recovery commands

**When to Load**:
- ❌ App broken after changes
- 🐛 Debugging sync issues
- 📡 Understanding message flow
- 🔊 Audio system not working
- 🔒 Security audit needed
- 📦 Deployment issues

**Last Updated**: 2024-12-06
**Current Commit**: b924b93

---

## 🔄 How to Use

### Load Memory (Future)
```bash
# When Serena MCP is available
serena read_memory syncslate_architecture
```

### Manual Recovery
```bash
# Read the memory file
cat .serena/memories/syncslate_architecture.md | less

# Search for specific issue
grep -i "audio" .serena/memories/syncslate_architecture.md
grep -i "supabase" .serena/memories/syncslate_architecture.md
```

### Quick Fixes

#### Fix 1: Audio Not Playing
```typescript
// See: Audio System section
const audioEngine = getGeminiAudioEngine();
audioEngine.resume();
```

#### Fix 2: Supabase Connection Error
```typescript
// See: Known Issues section
// Check .env.local for VITE_SUPABASE_URL
```

#### Fix 3: Settings Not Syncing
```typescript
// See: Message Protocol section
// Verify HOST is sending SYNC_STATE
// Check CLIENT is receiving messages
```

---

## 📝 Memory Maintenance

### Add New Memory
1. Create markdown file in `.serena/memories/`
2. Add entry to this INDEX.md
3. Commit to git

### Update Existing Memory
1. Edit the memory file
2. Update "Last Updated" date
3. Update "Current Commit" hash
4. Commit changes

---

**Serena MCP Status**: File-based (MCP integration pending)
**Memory Location**: `.serena/memories/`
**Git Tracked**: Yes (committed with project)
