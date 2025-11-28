/**
 * 高精度タイマーサービス
 *
 * Performance.now()ベースの高精度タイマー
 * Date.now()より精度が高い（マイクロ秒単位）
 *
 * 特徴:
 * - サーバー時刻との同期
 * - 一時停止/再開機能
 * - マイクロ秒精度
 */

import { timeSync } from './time-sync';

export class PrecisionTimer {
  private startTime: number = 0;
  private pauseTime: number = 0;
  private isPaused: boolean = false;
  private isRunning: boolean = false;

  /**
   * タイマーを開始
   * @param absoluteStartTime - 絶対開始時刻（サーバー時刻、ms）
   */
  start(absoluteStartTime: number) {
    this.startTime = absoluteStartTime;
    this.isPaused = false;
    this.isRunning = true;

    console.log('[PrecisionTimer] タイマー開始:', {
      startTime: this.startTime,
      serverTime: timeSync.getServerTime(),
      timeUntilStart: absoluteStartTime - timeSync.getServerTime()
    });
  }

  /**
   * 経過時間を取得（ミリ秒）
   *
   * @returns 経過時間（ms）、開始前の場合は負の値
   */
  getElapsed(): number {
    if (!this.isRunning) {
      return 0;
    }

    if (this.isPaused) {
      return this.pauseTime - this.startTime;
    }

    return timeSync.getServerTime() - this.startTime;
  }

  /**
   * 経過時間を秒単位で取得
   */
  getElapsedSeconds(): number {
    return this.getElapsed() / 1000;
  }

  /**
   * 次のフレームまでの時間を取得
   * @param targetTime - 目標時刻（サーバー時刻、ms）
   * @returns 残り時間（ms）
   */
  getTimeUntil(targetTime: number): number {
    return targetTime - timeSync.getServerTime();
  }

  /**
   * 特定の時刻に達したかチェック
   * @param targetTime - 目標時刻（サーバー時刻、ms）
   * @returns 到達していればtrue
   */
  hasReached(targetTime: number): boolean {
    return timeSync.getServerTime() >= targetTime;
  }

  /**
   * 一時停止
   */
  pause() {
    if (!this.isPaused && this.isRunning) {
      this.pauseTime = timeSync.getServerTime();
      this.isPaused = true;
      console.log('[PrecisionTimer] 一時停止:', { elapsed: this.getElapsed() });
    }
  }

  /**
   * 再開
   */
  resume() {
    if (this.isPaused && this.isRunning) {
      const pauseDuration = timeSync.getServerTime() - this.pauseTime;
      this.startTime += pauseDuration;
      this.isPaused = false;
      console.log('[PrecisionTimer] 再開:', { pauseDuration });
    }
  }

  /**
   * 停止
   */
  stop() {
    if (this.isRunning) {
      const elapsed = this.getElapsed();
      this.isRunning = false;
      this.isPaused = false;
      console.log('[PrecisionTimer] 停止:', { elapsed });
      return elapsed;
    }
    return 0;
  }

  /**
   * リセット
   */
  reset() {
    this.startTime = 0;
    this.pauseTime = 0;
    this.isPaused = false;
    this.isRunning = false;
  }

  /**
   * 現在の状態を取得
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      startTime: this.startTime,
      elapsed: this.getElapsed(),
      elapsedSeconds: this.getElapsedSeconds()
    };
  }

  /**
   * デバッグ情報を出力
   */
  debug() {
    console.log('[PrecisionTimer] Status:', this.getStatus());
  }
}

// シングルトンインスタンス
export const precisionTimer = new PrecisionTimer();
