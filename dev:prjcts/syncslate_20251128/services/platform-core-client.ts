/**
 * Platform Core Client
 *
 * Platform Coreとの統合クライアント
 *
 * 機能:
 * - Clerk認証統合
 * - サブスクリプション管理
 * - 使用量クォータチェック
 * - 使用量記録
 *
 * Platform Core API:
 * - GET  /api/auth/session - セッション確認
 * - GET  /api/subscriptions/:userId - サブスクリプション取得
 * - GET  /api/quotas/:userId - クォータ取得
 * - POST /api/usage - 使用量記録
 */

import Clerk from '@clerk/clerk-js';
import type {
  User,
  Subscription,
  UsageQuota,
  UsageRecord,
  PlatformCoreConfig,
} from '../types/sync';

// ============================================================
// Default Quotas
// ============================================================

const DEFAULT_QUOTAS: Record<string, UsageQuota> = {
  free: {
    sessionsPerMonth: 10,
    concurrentDevices: 2,
    storageMB: 100,
    maxDurationMinutes: 10,
  },
  pro: {
    sessionsPerMonth: 100,
    concurrentDevices: 10,
    storageMB: 1000,
    maxDurationMinutes: 60,
  },
  enterprise: {
    sessionsPerMonth: -1, // unlimited
    concurrentDevices: -1,
    storageMB: -1,
    maxDurationMinutes: -1,
  },
};

// ============================================================
// Platform Core Client
// ============================================================

export class PlatformCoreClient {
  private config: PlatformCoreConfig;
  private clerk: Clerk | null = null;
  private currentUser: User | null = null;
  private currentSubscription: Subscription | null = null;
  private currentQuota: UsageQuota | null = null;

  constructor(config: PlatformCoreConfig) {
    this.config = config;
  }

  // ========================================
  // Authentication
  // ========================================

  /**
   * Clerk初期化
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[PlatformCore] Disabled - running in guest mode');
      return;
    }

    try {
      this.clerk = new Clerk(this.config.clerkPublishableKey);
      await this.clerk.load();

      // セッション確認
      if (this.clerk.session) {
        await this.loadUserInfo();
      }

      console.log('[PlatformCore] Initialized successfully');
    } catch (error) {
      console.error('[PlatformCore] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * サインイン
   */
  async signIn(): Promise<void> {
    if (!this.clerk) {
      throw new Error('Clerk not initialized');
    }

    await this.clerk.openSignIn();
  }

  /**
   * サインアウト
   */
  async signOut(): Promise<void> {
    if (!this.clerk) {
      throw new Error('Clerk not initialized');
    }

    await this.clerk.signOut();
    this.currentUser = null;
    this.currentSubscription = null;
    this.currentQuota = null;
  }

  /**
   * 認証状態を取得
   */
  isAuthenticated(): boolean {
    return this.clerk?.session !== null && this.currentUser !== null;
  }

  /**
   * 現在のユーザーを取得
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // ========================================
  // Subscription & Quotas
  // ========================================

  /**
   * サブスクリプション情報を取得
   */
  async getSubscription(): Promise<Subscription | null> {
    if (!this.config.enabled || !this.currentUser) {
      return this.getGuestSubscription();
    }

    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/subscriptions/${this.currentUser.id}`,
        {
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch subscription: ${response.statusText}`);
      }

      const subscription: Subscription = await response.json();
      this.currentSubscription = subscription;
      return subscription;
    } catch (error) {
      console.error('[PlatformCore] Failed to fetch subscription:', error);
      return this.getGuestSubscription();
    }
  }

  /**
   * クォータ情報を取得
   */
  async getQuota(): Promise<UsageQuota> {
    if (!this.config.enabled || !this.currentUser) {
      return DEFAULT_QUOTAS.free;
    }

    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/quotas/${this.currentUser.id}`,
        {
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch quota: ${response.statusText}`);
      }

      const quota: UsageQuota = await response.json();
      this.currentQuota = quota;
      return quota;
    } catch (error) {
      console.error('[PlatformCore] Failed to fetch quota:', error);
      return DEFAULT_QUOTAS.free;
    }
  }

  /**
   * クォータチェック
   */
  async checkQuota(
    deviceCount: number,
    durationMinutes: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const quota = this.currentQuota || (await this.getQuota());

    // デバイス数チェック
    if (quota.concurrentDevices !== -1 && deviceCount > quota.concurrentDevices) {
      return {
        allowed: false,
        reason: `Device limit exceeded. Max: ${quota.concurrentDevices}`,
      };
    }

    // 期間チェック
    if (quota.maxDurationMinutes !== -1 && durationMinutes > quota.maxDurationMinutes) {
      return {
        allowed: false,
        reason: `Duration limit exceeded. Max: ${quota.maxDurationMinutes} minutes`,
      };
    }

    return { allowed: true };
  }

  /**
   * 使用量を記録
   */
  async recordUsage(record: Omit<UsageRecord, 'userId'>): Promise<void> {
    if (!this.config.enabled || !this.currentUser) {
      console.log('[PlatformCore] Guest mode - usage not recorded');
      return;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/usage`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...record,
          userId: this.currentUser.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to record usage: ${response.statusText}`);
      }

      console.log('[PlatformCore] Usage recorded:', record);
    } catch (error) {
      console.error('[PlatformCore] Failed to record usage:', error);
    }
  }

  // ========================================
  // Private Methods
  // ========================================

  /**
   * ユーザー情報を読み込み
   */
  private async loadUserInfo(): Promise<void> {
    if (!this.clerk?.user) {
      throw new Error('No active session');
    }

    this.currentUser = {
      id: this.clerk.user.id,
      email: this.clerk.user.primaryEmailAddress?.emailAddress || '',
      displayName:
        this.clerk.user.fullName ||
        this.clerk.user.username ||
        this.clerk.user.firstName ||
        undefined,
    };

    // サブスクリプション情報を取得
    await this.getSubscription();
    await this.getQuota();
  }

  /**
   * 認証ヘッダーを取得
   */
  private getAuthHeaders(): Record<string, string> {
    if (!this.clerk?.session) {
      return {};
    }

    // Clerk セッショントークンを取得
    const token = this.clerk.session.lastActiveToken?.getRawString();
    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * ゲストモード用のサブスクリプション
   */
  private getGuestSubscription(): Subscription {
    return {
      id: 'guest',
      userId: 'guest',
      plan: 'free',
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let platformCoreClient: PlatformCoreClient | null = null;

/**
 * Platform Core Client インスタンスを取得
 */
export function getPlatformCoreClient(config?: PlatformCoreConfig): PlatformCoreClient {
  if (!platformCoreClient && config) {
    platformCoreClient = new PlatformCoreClient(config);
  }

  if (!platformCoreClient) {
    throw new Error('PlatformCoreClient not initialized. Call with config first.');
  }

  return platformCoreClient;
}

/**
 * Platform Core の有効/無効を環境変数から判定
 */
export function isPlatformCoreEnabled(): boolean {
  return import.meta.env.VITE_PLATFORM_CORE_ENABLED === 'true';
}

/**
 * Platform Core設定を環境変数から読み込み
 */
export function loadPlatformCoreConfig(): PlatformCoreConfig {
  return {
    baseUrl: import.meta.env.VITE_PLATFORM_CORE_URL || 'http://localhost:3001',
    clerkPublishableKey:
      import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
      'pk_test_placeholder',
    enabled: isPlatformCoreEnabled(),
  };
}
