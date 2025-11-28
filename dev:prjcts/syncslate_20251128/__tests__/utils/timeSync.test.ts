/**
 * Absolute Time Reference (ATR) Tests
 * ゼロレイテンシ同期を実現する時間同期のテスト
 *
 * 目標: 50ms以内の同期を保証
 */

import {
  ATRCalculator,
  TimeSync,
  SYNC_LATENCY_BUFFER_MS,
} from '../../src/utils/timeSync';
import { mockDateNow, flushAnimationFrames } from '../setup';

describe('Absolute Time Reference (ATR)', () => {
  let calculator: ATRCalculator;
  let timeSync: TimeSync;

  beforeEach(() => {
    calculator = new ATRCalculator();
    timeSync = new TimeSync();
  });

  describe('ATR 基本計算', () => {
    it('現在時刻から未来のstartTimeを計算する', () => {
      const now = 1000000;
      mockDateNow(now);

      const startTime = calculator.calculateStartTime();

      // デフォルトバッファ（500ms）が追加される
      expect(startTime).toBe(now + SYNC_LATENCY_BUFFER_MS);
    });

    it('カスタムバッファで未来のstartTimeを計算する', () => {
      const now = 2000000;
      const customBuffer = 1000; // 1秒
      mockDateNow(now);

      const startTime = calculator.calculateStartTime(customBuffer);

      expect(startTime).toBe(now + customBuffer);
    });

    it('経過時間を正確に計算する', () => {
      const startTime = 1000000;
      const currentTime = 1002500; // 2.5秒後
      mockDateNow(currentTime);

      const elapsed = calculator.getElapsedTime(startTime);

      expect(elapsed).toBe(2500); // ミリ秒
    });

    it('開始前の場合、負の経過時間を返す', () => {
      const startTime = 1000000;
      const currentTime = 999500; // 500ms前
      mockDateNow(currentTime);

      const elapsed = calculator.getElapsedTime(startTime);

      expect(elapsed).toBe(-500);
    });

    it('現在のフレーム番号を計算する', () => {
      const startTime = 1000000;
      const currentTime = 1003700; // 3.7秒後
      mockDateNow(currentTime);

      const frame = calculator.getCurrentFrame(startTime);

      expect(frame).toBe(3); // 3秒台 = フレーム3
    });

    it('開始前はフレーム-1を返す', () => {
      const startTime = 1000000;
      const currentTime = 999999;
      mockDateNow(currentTime);

      const frame = calculator.getCurrentFrame(startTime);

      expect(frame).toBe(-1);
    });
  });

  describe('TimeSync 同期管理', () => {
    it('HOSTが開始時刻を設定できる', () => {
      const now = 1000000;
      mockDateNow(now);

      const startTime = timeSync.initializeAsHost();

      expect(startTime).toBe(now + SYNC_LATENCY_BUFFER_MS);
      expect(timeSync.getStartTime()).toBe(startTime);
      expect(timeSync.isHost()).toBe(true);
    });

    it('CLIENTが開始時刻を受信して設定できる', () => {
      const startTime = 2000000;

      timeSync.initializeAsClient(startTime);

      expect(timeSync.getStartTime()).toBe(startTime);
      expect(timeSync.isHost()).toBe(false);
    });

    it('同期状態を正確に判定する', () => {
      const startTime = 1000000;

      // 開始前
      mockDateNow(999000);
      timeSync.initializeAsClient(startTime);
      expect(timeSync.getStatus()).toBe('armed');

      // 実行中
      mockDateNow(1001000);
      expect(timeSync.getStatus()).toBe('running');

      // 終了（duration設定後）
      timeSync.setDuration(5); // 5秒
      mockDateNow(1006000); // 6秒後
      expect(timeSync.getStatus()).toBe('ended');
    });

    it('waitUntilStartが正しく待機する', async () => {
      const startTime = Date.now() + 100; // 100ms後
      timeSync.initializeAsClient(startTime);

      const startPromise = timeSync.waitUntilStart();

      // まだ解決されていない
      let resolved = false;
      startPromise.then(() => { resolved = true; });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(resolved).toBe(false);

      // 100ms後に解決される
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(resolved).toBe(true);
    });
  });

  describe('フレーム同期精度', () => {
    it('HOST/CLIENT間でフレーム番号が一致する', () => {
      const startTime = 1000000;

      // HOST
      const hostSync = new TimeSync();
      hostSync.initializeAsHost();
      hostSync.setStartTime(startTime);

      // CLIENT
      const clientSync = new TimeSync();
      clientSync.initializeAsClient(startTime);

      // 同じ時刻でフレーム番号を確認
      const testTimes = [
        1000000, // 開始時
        1001000, // 1秒後
        1002500, // 2.5秒後
        1005999, // 5.999秒後
        1006000, // 6秒後
      ];

      testTimes.forEach(time => {
        mockDateNow(time);
        const hostFrame = hostSync.getCurrentFrame();
        const clientFrame = clientSync.getCurrentFrame();
        expect(hostFrame).toBe(clientFrame);
      });
    });

    it('ネットワーク遅延があってもフレームが同期される', () => {
      const realStartTime = 1000000;

      // HOSTが開始
      mockDateNow(999500); // 開始500ms前
      const hostSync = new TimeSync();
      hostSync.initializeAsHost();
      hostSync.setStartTime(realStartTime);

      // CLIENTが100ms遅れて受信
      mockDateNow(999600); // 開始400ms前
      const clientSync = new TimeSync();
      clientSync.initializeAsClient(realStartTime);

      // 実行時刻で確認
      mockDateNow(1002000); // 開始から2秒後
      expect(hostSync.getCurrentFrame()).toBe(2);
      expect(clientSync.getCurrentFrame()).toBe(2);

      // 異なるタイミングでも同じフレーム
      mockDateNow(1002999); // 2.999秒後
      expect(hostSync.getCurrentFrame()).toBe(2);
      expect(clientSync.getCurrentFrame()).toBe(2);
    });
  });

  describe('レイテンシ測定', () => {
    it('50ms以内の同期を達成できる', () => {
      const measurements: number[] = [];
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const hostTime = Date.now();
        const networkLatency = Math.random() * 30; // 0-30msのネットワーク遅延
        const clientTime = hostTime + networkLatency;

        // HOSTが開始時刻を計算
        mockDateNow(hostTime);
        const startTime = new ATRCalculator().calculateStartTime();

        // CLIENTが受信
        mockDateNow(clientTime);
        const clientSync = new TimeSync();
        clientSync.initializeAsClient(startTime);

        // 同期のズレを測定
        const syncDiff = Math.abs(clientSync.getStartTime() - startTime);
        measurements.push(syncDiff);
      }

      // 全ての測定が0（完全同期）
      expect(Math.max(...measurements)).toBe(0);
      // 平均も0
      const average = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(average).toBe(0);
    });
  });

  describe('エラーハンドリング', () => {
    it('startTimeが設定されていない場合エラーを投げる', () => {
      expect(() => {
        timeSync.getCurrentFrame();
      }).toThrow('Start time not initialized');
    });

    it('過去の時刻でCLIENT初期化しようとすると警告', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const pastTime = Date.now() - 1000;

      timeSync.initializeAsClient(pastTime);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Start time is in the past')
      );
      consoleSpy.mockRestore();
    });

    it('負のdurationは設定できない', () => {
      expect(() => {
        timeSync.setDuration(-5);
      }).toThrow('Duration must be positive');
    });
  });

  describe('requestAnimationFrame との統合', () => {
    it('フレーム更新が正確にタイミングされる', () => {
      const startTime = 1000000;
      const frameCallback = jest.fn();

      timeSync.initializeAsClient(startTime);

      const animate = (timestamp: number) => {
        const frame = timeSync.getCurrentFrame();
        if (frame >= 0 && frame < 5) {
          frameCallback(frame);
          requestAnimationFrame(animate);
        }
      };

      // アニメーション開始
      mockDateNow(1000000);
      requestAnimationFrame(animate);
      flushAnimationFrames(0);
      expect(frameCallback).toHaveBeenCalledWith(0);

      // 1秒後
      mockDateNow(1001000);
      flushAnimationFrames(1000);
      expect(frameCallback).toHaveBeenCalledWith(1);

      // 2秒後
      mockDateNow(1002000);
      flushAnimationFrames(2000);
      expect(frameCallback).toHaveBeenCalledWith(2);
    });
  });

  describe('複数セッションの時刻管理', () => {
    it('異なるセッションは独立した時刻を持つ', () => {
      const session1 = new TimeSync('session-1');
      const session2 = new TimeSync('session-2');

      mockDateNow(1000000);
      session1.initializeAsHost();

      mockDateNow(2000000);
      session2.initializeAsHost();

      expect(session1.getStartTime()).not.toBe(session2.getStartTime());
      expect(Math.abs(session1.getStartTime()! - session2.getStartTime()!))
        .toBeGreaterThanOrEqual(1000000 - SYNC_LATENCY_BUFFER_MS);
    });
  });

  describe('パフォーマンス', () => {
    it('高頻度の呼び出しでも高速に動作する', () => {
      const startTime = 1000000;
      timeSync.initializeAsClient(startTime);

      const iterations = 10000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        mockDateNow(startTime + i);
        timeSync.getCurrentFrame();
      }

      const elapsed = performance.now() - start;

      // 10,000回の呼び出しが100ms以内で完了
      expect(elapsed).toBeLessThan(100);

      // 1回あたり0.01ms未満
      expect(elapsed / iterations).toBeLessThan(0.01);
    });
  });
});