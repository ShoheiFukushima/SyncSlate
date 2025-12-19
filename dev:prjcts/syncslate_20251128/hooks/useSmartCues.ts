/**
 * SMART CUES管理のカスタムフック
 *
 * Phase 1: 基本機能
 * - CUEの追加、更新、削除
 * - LocalStorageへの永続化
 * - タイムスタンプによるCUE検索
 */

import { useState, useCallback, useEffect } from 'react';
import type { SmartCue } from '../types/smart-cues';

/**
 * UUIDv4生成
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * SMART CUES管理フックの戻り値型
 */
interface UseSmartCuesReturn {
  /** すべてのCUE(タイムスタンプ順にソート済み) */
  cues: SmartCue[];

  /** CUEを追加 */
  addCue: (timestamp: number) => SmartCue;

  /** CUEを更新 */
  updateCue: (id: string, updates: Partial<SmartCue>) => void;

  /** CUEを削除 */
  deleteCue: (id: string) => void;

  /** すべてのCUEをクリア */
  clearAllCues: () => void;

  /** 特定のタイムスタンプのCUEを取得 */
  getCueByTimestamp: (timestamp: number) => SmartCue | undefined;

  /** ローディング状態 */
  isLoading: boolean;
}

/**
 * SMART CUES管理のカスタムフック
 *
 * @param sessionId セッションID(将来の拡張用、現在は未使用)
 * @returns SMART CUES管理オブジェクト
 */
export function useSmartCues(sessionId?: string): UseSmartCuesReturn {
  const [cues, setCues] = useState<SmartCue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // LocalStorageキー
  const STORAGE_KEY = 'syncslate_smart_cues';

  /**
   * LocalStorageからCUEを読み込み
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SmartCue[];
        // タイムスタンプでソート
        const sorted = parsed.sort((a, b) => a.timestamp - b.timestamp);
        setCues(sorted);
      }
    } catch (error) {
      console.error('Failed to load smart cues from storage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * LocalStorageにCUEを保存
   */
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cues));
      } catch (error) {
        console.error('Failed to save smart cues to storage:', error);
        // QuotaExceededError などの場合
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          alert('ストレージ容量が不足しています。不要なCUEを削除してください。');
        }
      }
    }
  }, [cues, isLoading]);

  /**
   * CUEを追加
   */
  const addCue = useCallback((timestamp: number): SmartCue => {
    const now = new Date().toISOString();
    const newCue: SmartCue = {
      id: generateId(),
      timestamp,
      audioType: 'text',
      text: '',
      createdAt: now,
      updatedAt: now,
    };

    setCues(prev => {
      const updated = [...prev, newCue];
      // タイムスタンプでソート
      return updated.sort((a, b) => a.timestamp - b.timestamp);
    });

    return newCue;
  }, []);

  /**
   * CUEを更新
   */
  const updateCue = useCallback((id: string, updates: Partial<SmartCue>) => {
    setCues(prev =>
      prev.map(cue =>
        cue.id === id
          ? { ...cue, ...updates, updatedAt: new Date().toISOString() }
          : cue
      )
    );
  }, []);

  /**
   * CUEを削除
   */
  const deleteCue = useCallback((id: string) => {
    setCues(prev => prev.filter(cue => cue.id !== id));
  }, []);

  /**
   * すべてのCUEをクリア
   */
  const clearAllCues = useCallback(() => {
    if (confirm('すべてのCUEを削除しますか?この操作は元に戻せません。')) {
      setCues([]);
    }
  }, []);

  /**
   * 特定のタイムスタンプのCUEを取得
   */
  const getCueByTimestamp = useCallback(
    (timestamp: number): SmartCue | undefined => {
      return cues.find(cue => cue.timestamp === timestamp);
    },
    [cues]
  );

  return {
    cues,
    addCue,
    updateCue,
    deleteCue,
    clearAllCues,
    getCueByTimestamp,
    isLoading,
  };
}
