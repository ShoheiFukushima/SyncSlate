# SyncSlate AI - SaaS Platform Core 統合計画書

## 📋 概要

SyncSlate AIをSaaS Platform Coreに統合し、認証・課金・使用量管理を一元化する計画書です。

## 🏗️ アーキテクチャ概要

```mermaid
graph TB
    subgraph "SyncSlate AI"
        UI[React UI]
        API[AI Voice API]
        SYNC[Sync Service]
    end

    subgraph "SaaS Platform Core"
        CLERK[Clerk Auth]
        TURSO[Turso DB]
        STRIPE[Stripe Billing]
        QUOTA[Quota Service]
    end

    UI --> CLERK
    UI --> QUOTA
    API --> QUOTA
    SYNC --> QUOTA
    QUOTA --> TURSO
    CLERK --> STRIPE
```

## 🎭 HOST/CLIENT アーキテクチャ（最重要）

### アプリケーションモード

| モード | 認証 | 課金 | 機能 | URL |
|--------|------|------|------|-----|
| **HOST** | 必要 ✅ | 対象 ✅ | フル機能（設定・制御） | `/` または `/?role=host` |
| **CLIENT** | **不要 ❌** | **不要 ❌** | 表示のみ（Slave） | `/?role=client&session=xxx` |

### CLIENT（ゲスト）モードの仕様
```
✅ 完全無料・永久無料
✅ ログイン画面を一切表示しない
✅ URL アクセスで即座に動作開始
✅ "WAITING FOR HOST" 表示
✅ HOST からの同期信号を受信して表示
❌ 設定変更不可
❌ スレート開始/停止不可（Request Control除く）
```

## 🔑 統合ポイント

### 1. 認証統合（Clerk）- **HOSTモードのみ**
- **統合レベル**: HOSTモード時のみ必須
- **CLIENTモード**: 認証バイパス
- **実装方法**: Clerk React SDK使用（条件付き）
- **共有内容**: ユーザーID、セッション情報

### 2. 使用量管理
- **リソースタイプ**:
  - `voice_generation`: AI音声生成回数
  - `sync_session`: 同期セッション数
  - `storage`: 生成音声の保存容量

### 3. プラン制限

⚠️ **重要**: **Clientモード（ゲスト）は完全無料・ログイン不要**
- URL共有を受けた端末は即座にClientモードで起動
- 認証・課金は一切不要
- 読み取り専用の同期表示のみ

**Hostモードのみ**に適用される制限：
| プラン | 月額 | 音声生成/月 | 同期セッション/月 | ストレージ |
|--------|------|-------------|------------------|-----------|
| free | ¥0 | 10回 | 5回 | 100MB |
| student | ¥0 | 50回 | 20回 | 500MB |
| teacher | ¥0 | 100回 | 50回 | 1GB |
| basic | ¥1,500 | 200回 | 100回 | 2GB |
| pro | ¥4,500 | 無制限 | 無制限 | 10GB |

## 📁 ファイル構造の変更

```
syncslate_20251128/
├── .env.local                    # 環境変数（更新）
├── src/
│   ├── lib/
│   │   ├── auth/                # Clerk認証 ✨NEW
│   │   │   ├── clerk-provider.tsx
│   │   │   └── use-auth.ts
│   │   ├── platform/            # Platform Core統合 ✨NEW
│   │   │   ├── api-client.ts
│   │   │   ├── quota-service.ts
│   │   │   └── usage-tracker.ts
│   │   └── gemini/              # AI音声生成 ✨NEW
│   │       └── voice-service.ts
│   ├── components/
│   │   ├── auth/                # 認証UI ✨NEW
│   │   │   ├── sign-in-button.tsx
│   │   │   └── user-menu.tsx
│   │   └── subscription/        # プラン管理UI ✨NEW
│   │       ├── plan-badge.tsx
│   │       └── usage-meter.tsx
│   └── hooks/                   # カスタムフック ✨NEW
│       ├── use-quota.ts
│       └── use-subscription.ts
└── index.tsx                    # メインアプリ（更新）
```

## 📅 開発フェーズ全体像

### Phase 0: MVP基本動作確認（即座〜1週間）
- ✅ GEMINI APIキー設定完了
- [ ] HOST/CLIENTモード分離の実装
- [ ] 基本同期機能の動作確認
- [ ] AI音声合成テスト

## 🚀 実装フェーズ（Platform Core統合）

### Phase 0.5: Platform Core統合準備（3日間）

#### タスク
1. **環境変数設定**
   ```bash
   # .env.local に追加
   # Clerk認証
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
   CLERK_SECRET_KEY=sk_test_xxx

   # Platform Core
   PLATFORM_CORE_URL=http://localhost:3000
   NEXT_PUBLIC_PLATFORM_CORE_URL=http://localhost:3000

   # Gemini API（設定済み）
   GEMINI_API_KEY=AIzaSyBpAYRZIgVT0asA4NOjOQQ_1WnRiXtH5Tg
   ```

2. **Clerk SDK インストール**
   ```bash
   npm install @clerk/nextjs @clerk/clerk-react
   ```

3. **Platform Core APIクライアント実装**
   ```typescript
   // src/lib/platform/api-client.ts
   export class PlatformCoreAPI {
     private baseURL = process.env.NEXT_PUBLIC_PLATFORM_CORE_URL;

     async checkQuota(resourceType: string) {
       const response = await fetch(`${this.baseURL}/api/usage/check`, {
         method: 'POST',
         headers: this.getHeaders(),
         body: JSON.stringify({ resourceType })
       });
       return response.json();
     }

     async recordUsage(resourceType: string, metadata: any) {
       const response = await fetch(`${this.baseURL}/api/usage/record`, {
         method: 'POST',
         headers: this.getHeaders(),
         body: JSON.stringify({ resourceType, metadata })
       });
       return response.json();
     }

     private getHeaders() {
       return {
         'Authorization': `Bearer ${this.getClerkToken()}`,
         'X-User-ID': this.getUserId(),
         'Content-Type': 'application/json'
       };
     }
   }
   ```

### Phase 1: 認証統合（1週間）

#### 実装内容
1. **Clerk Provider設定**
   ```tsx
   // src/lib/auth/clerk-provider.tsx
   import { ClerkProvider } from '@clerk/nextjs';

   export function AuthProvider({ children }: { children: React.ReactNode }) {
     return (
       <ClerkProvider
         publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
       >
         {children}
       </ClerkProvider>
     );
   }
   ```

2. **認証フック実装**
   ```typescript
   // src/hooks/use-auth.ts
   import { useUser, useClerk } from '@clerk/nextjs';

   export function useAuth() {
     const { user, isLoaded } = useUser();
     const { signOut } = useClerk();

     return {
       user,
       isAuthenticated: !!user,
       isLoading: !isLoaded,
       signOut
     };
   }
   ```

3. **認証ゲート実装**
   - ホストモード: 要ログイン
   - ゲストモード: ログイン不要（読み取り専用）

### Phase 2: 使用量管理統合（1週間）

#### 実装内容

1. **音声生成前のクォータチェック**
   ```typescript
   // src/lib/gemini/voice-service.ts
   export async function generateVoice(text: string, language: string) {
     // 1. クォータチェック
     const quota = await platformAPI.checkQuota('voice_generation');

     if (!quota.allowed) {
       throw new Error(`月間上限に達しました: ${quota.currentUsage}/${quota.monthlyLimit}`);
     }

     // 2. Gemini APIで音声生成
     const audio = await generateWithGemini(text, language);

     // 3. 使用量記録
     await platformAPI.recordUsage('voice_generation', {
       text,
       language,
       duration: audio.duration,
       size: audio.size
     });

     return audio;
   }
   ```

2. **同期セッションの管理**
   ```typescript
   // 同期開始前のチェック
   async function startSyncSession() {
     const quota = await platformAPI.checkQuota('sync_session');

     if (!quota.allowed) {
       showUpgradePrompt();
       return;
     }

     // セッション開始
     const sessionId = startSession();

     // 使用量記録
     await platformAPI.recordUsage('sync_session', {
       sessionId,
       participants: getParticipantCount()
     });
   }
   ```

3. **使用量表示UI**
   ```tsx
   // src/components/subscription/usage-meter.tsx
   export function UsageMeter() {
     const { usage, limit } = useQuota('voice_generation');

     return (
       <div className="usage-meter">
         <div className="progress-bar">
           <div
             className="progress-fill"
             style={{ width: `${(usage / limit) * 100}%` }}
           />
         </div>
         <span>{usage} / {limit} 音声生成</span>
       </div>
     );
   }
   ```

### Phase 3: プラン管理UI（3日間）

#### 実装内容

1. **プラン情報表示**
   ```tsx
   // src/components/subscription/plan-badge.tsx
   export function PlanBadge() {
     const { plan } = useSubscription();

     return (
       <div className={`plan-badge plan-${plan.name}`}>
         <span>{plan.displayName}</span>
         {plan.name === 'free' && (
           <button onClick={openUpgradeModal}>
             アップグレード
           </button>
         )}
       </div>
     );
   }
   ```

2. **アップグレードフロー**
   ```typescript
   async function handleUpgrade(planId: string) {
     const response = await platformAPI.createCheckout(planId);
     window.location.href = response.checkoutUrl;
   }
   ```

## 📝 実装チェックリスト

### 必須統合項目
- [ ] Clerk認証の実装
- [ ] Platform Core APIクライアント
- [ ] 音声生成のクォータチェック
- [ ] 使用量記録
- [ ] プラン情報の取得と表示

### オプション統合項目
- [ ] Stripeポータルへのリダイレクト
- [ ] 使用量グラフ表示
- [ ] プラン比較表
- [ ] 学生/教員認証フロー

## 🧪 テスト戦略（Platform Core統合）

### 統合テストケース
```typescript
describe('Platform Core Integration', () => {
  test('音声生成時にクォータがチェックされる', async () => {
    // モック設定
    mockPlatformAPI.checkQuota.mockResolvedValue({
      allowed: false,
      currentUsage: 10,
      monthlyLimit: 10
    });

    // 音声生成を試みる
    await expect(generateVoice('test', 'en')).rejects.toThrow('月間上限');

    // クォータチェックが呼ばれたことを確認
    expect(mockPlatformAPI.checkQuota).toHaveBeenCalledWith('voice_generation');
  });

  test('使用量が正しく記録される', async () => {
    // 正常な音声生成
    await generateVoice('test', 'en');

    // 使用量記録が呼ばれたことを確認
    expect(mockPlatformAPI.recordUsage).toHaveBeenCalledWith(
      'voice_generation',
      expect.objectContaining({
        text: 'test',
        language: 'en'
      })
    );
  });
});
```

## 📊 モニタリング指標

### Platform Core統合KPI
- 認証成功率: > 99.9%
- API応答時間: < 200ms
- クォータチェック精度: 100%
- 課金エラー率: < 0.1%

## 🚨 エラーハンドリング

### API障害時のフォールバック
```typescript
// Platform Core APIが利用不可の場合
export async function checkQuotaWithFallback(resourceType: string) {
  try {
    return await platformAPI.checkQuota(resourceType);
  } catch (error) {
    console.error('Platform Core API error:', error);

    // ローカルストレージでカウント（一時的）
    const localCount = getLocalUsageCount(resourceType);
    const freeLimit = FREE_TIER_LIMITS[resourceType];

    return {
      allowed: localCount < freeLimit,
      currentUsage: localCount,
      monthlyLimit: freeLimit,
      fallback: true
    };
  }
}
```

## 🔄 マイグレーション戦略

### 既存ユーザーの移行
1. **Phase 1**: 新規ユーザーのみClerk認証必須
2. **Phase 2**: 既存ユーザーへの移行案内
3. **Phase 3**: 完全移行（ゲストモードは維持）

## 📅 統合スケジュール

| 週 | タスク | 成果物 |
|----|--------|--------|
| Week 1 | 環境設定、認証統合 | ログイン機能 |
| Week 2 | 使用量管理 | クォータチェック |
| Week 3 | プランUI、テスト | 完全統合版 |

## 🎯 次のアクション

1. **今すぐ実行**
   ```bash
   # Clerk SDK インストール
   npm install @clerk/nextjs @clerk/clerk-react

   # Platform Core APIクライアント作成
   mkdir -p src/lib/platform
   touch src/lib/platform/api-client.ts
   ```

2. **Clerk設定取得**
   - Platform Coreプロジェクトと同じClerkアプリケーションを使用
   - publishable keyとsecret keyを.env.localに設定

3. **動作確認**
   - Platform Core（localhost:3000）を起動
   - SyncSlate AI（localhost:3001）を起動
   - 認証フロー確認

---

**作成日**: 2025年11月28日
**バージョン**: 2.0.0 (Platform Core統合版)