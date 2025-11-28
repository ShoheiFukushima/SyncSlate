/**
 * usePlatformCore Hook
 *
 * Platform Core機能をReactコンポーネントで利用するためのカスタムフック
 *
 * 機能:
 * - 認証状態管理
 * - サブスクリプション情報取得
 * - クォータチェック
 * - 使用量記録
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getPlatformCoreClient,
  loadPlatformCoreConfig,
} from '../services/platform-core-client';
import type {
  User,
  Subscription,
  UsageQuota,
  UsageRecord,
} from '../types/sync';

// ============================================================
// Hook Return Type
// ============================================================

export interface UsePlatformCoreReturn {
  // 状態
  isInitialized: boolean;
  isAuthenticated: boolean;
  user: User | null;
  subscription: Subscription | null;
  quota: UsageQuota | null;
  isLoading: boolean;
  error: Error | null;

  // 認証
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;

  // クォータ
  checkQuota: (deviceCount: number, durationMinutes: number) => Promise<{
    allowed: boolean;
    reason?: string;
  }>;
  recordUsage: (record: Omit<UsageRecord, 'userId'>) => Promise<void>;

  // 再読み込み
  refreshSubscription: () => Promise<void>;
  refreshQuota: () => Promise<void>;
}

// ============================================================
// Custom Hook
// ============================================================

export function usePlatformCore(): UsePlatformCoreReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [quota, setQuota] = useState<UsageQuota | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Platform Core Client インスタンス
  const [client] = useState(() => {
    const config = loadPlatformCoreConfig();
    return getPlatformCoreClient(config);
  });

  // ========================================
  // 初期化
  // ========================================

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        await client.initialize();

        // 認証状態を確認
        const authenticated = client.isAuthenticated();
        setIsAuthenticated(authenticated);

        if (authenticated) {
          const currentUser = client.getCurrentUser();
          setUser(currentUser);

          // サブスクリプション情報を取得
          const sub = await client.getSubscription();
          setSubscription(sub);

          // クォータ情報を取得
          const q = await client.getQuota();
          setQuota(q);
        }

        setIsInitialized(true);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[usePlatformCore] Initialization failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [client]);

  // ========================================
  // 認証
  // ========================================

  const signIn = useCallback(async () => {
    try {
      setIsLoading(true);
      await client.signIn();

      // 認証後の状態を更新
      const authenticated = client.isAuthenticated();
      setIsAuthenticated(authenticated);

      if (authenticated) {
        const currentUser = client.getCurrentUser();
        setUser(currentUser);

        const sub = await client.getSubscription();
        setSubscription(sub);

        const q = await client.getQuota();
        setQuota(q);
      }

      setError(null);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      await client.signOut();

      setIsAuthenticated(false);
      setUser(null);
      setSubscription(null);
      setQuota(null);
      setError(null);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // ========================================
  // クォータ
  // ========================================

  const checkQuota = useCallback(
    async (deviceCount: number, durationMinutes: number) => {
      try {
        return await client.checkQuota(deviceCount, durationMinutes);
      } catch (err) {
        setError(err as Error);
        return {
          allowed: false,
          reason: 'Failed to check quota',
        };
      }
    },
    [client]
  );

  const recordUsage = useCallback(
    async (record: Omit<UsageRecord, 'userId'>) => {
      try {
        await client.recordUsage(record);
      } catch (err) {
        setError(err as Error);
      }
    },
    [client]
  );

  // ========================================
  // 再読み込み
  // ========================================

  const refreshSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      const sub = await client.getSubscription();
      setSubscription(sub);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const refreshQuota = useCallback(async () => {
    try {
      setIsLoading(true);
      const q = await client.getQuota();
      setQuota(q);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // ========================================
  // Return
  // ========================================

  return {
    // 状態
    isInitialized,
    isAuthenticated,
    user,
    subscription,
    quota,
    isLoading,
    error,

    // 認証
    signIn,
    signOut,

    // クォータ
    checkQuota,
    recordUsage,

    // 再読み込み
    refreshSubscription,
    refreshQuota,
  };
}
