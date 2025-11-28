/**
 * AudioContext時刻同期サービス
 *
 * AudioContextを使った1ms精度のオーディオ同期
 *
 * AudioContext.currentTimeはAudioContextが作成されてからの経過時間（秒）を
 * 高精度で提供します。これをサーバー時刻と紐付けることで、
 * 異なるデバイス間で正確にオーディオを同期できます。
 *
 * 精度: サンプルレート48kHz = 約0.02ms
 */

import { getGeminiAudioEngine } from '../gemini-api';
import { timeSync } from './time-sync';

export interface ScheduledAudio {
  id: string;
  audioBuffer: AudioBuffer;
  scheduledTime: number; // サーバー時刻（ms）
  source?: AudioBufferSourceNode;
  actualPlayTime?: number; // 実際の再生時刻（AudioContext時刻）
}

export interface AudioSyncMetrics {
  schedulingError: number;  // スケジューリング誤差（ms）
  actualPlayError: number;  // 実際の再生誤差（ms）
  scheduledCount: number;   // スケジュール済み数
  playedCount: number;      // 再生済み数
}

class AudioSyncEngine {
  private audioContext: AudioContext | null = null;
  private audioContextStartTime: number = 0; // AudioContext開始時のサーバー時刻
  private scheduledAudios: Map<string, ScheduledAudio> = new Map();
  private isInitialized: boolean = false;
  private playedCount: number = 0;

  /**
   * AudioContextを初期化
   *
   * AudioContext.currentTimeとサーバー時刻の対応を確立
   */
  initialize() {
    const engine = getGeminiAudioEngine();
    this.audioContext = engine.audioContext;

    // AudioContextが停止している場合は再開
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // AudioContext時刻とサーバー時刻の対応を記録
    // audioContextStartTime = サーバー時刻 - (AudioContext経過時間 * 1000)
    this.audioContextStartTime = timeSync.getServerTime() - (this.audioContext.currentTime * 1000);
    this.isInitialized = true;

    console.log('[AudioSync] 初期化完了:', {
      state: this.audioContext.state,
      currentTime: this.audioContext.currentTime,
      sampleRate: this.audioContext.sampleRate,
      startTime: this.audioContextStartTime
    });
  }

  /**
   * サーバー時刻からAudioContext時刻へ変換
   * @param serverTime - サーバー時刻（ms）
   * @returns AudioContext時刻（秒）
   */
  serverTimeToAudioTime(serverTime: number): number {
    const elapsedMs = serverTime - this.audioContextStartTime;
    return elapsedMs / 1000; // 秒単位
  }

  /**
   * AudioContext時刻からサーバー時刻へ変換
   * @param audioTime - AudioContext時刻（秒）
   * @returns サーバー時刻（ms）
   */
  audioTimeToServerTime(audioTime: number): number {
    return this.audioContextStartTime + (audioTime * 1000);
  }

  /**
   * 指定時刻にオーディオを再生
   *
   * @param id - スケジュールID
   * @param audioBuffer - 再生するオーディオバッファ
   * @param serverTime - 再生開始時刻（サーバー時刻、ms）
   * @returns 実際の再生時刻（AudioContext時刻）
   */
  scheduleAudio(id: string, audioBuffer: AudioBuffer, serverTime: number): number {
    if (!this.audioContext || !this.isInitialized) {
      throw new Error('[AudioSync] 初期化されていません');
    }

    const audioTime = this.serverTimeToAudioTime(serverTime);
    const currentAudioTime = this.audioContext.currentTime;

    // 過去の時刻は即座に再生（最小0.001秒後）
    const playTime = Math.max(audioTime, currentAudioTime + 0.001);

    // AudioBufferSourceNodeを作成
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // スケジューリング誤差を計算
    const schedulingError = (playTime - audioTime) * 1000; // ms単位

    // 再生開始
    source.start(playTime);

    // スケジュール記録
    this.scheduledAudios.set(id, {
      id,
      audioBuffer,
      scheduledTime: serverTime,
      source,
      actualPlayTime: playTime
    });

    // 再生終了時のクリーンアップ
    source.onended = () => {
      this.scheduledAudios.delete(id);
      this.playedCount++;
    };

    console.log('[AudioSync] オーディオスケジュール:', {
      id,
      serverTime,
      audioTime: audioTime.toFixed(6),
      playTime: playTime.toFixed(6),
      schedulingError: schedulingError.toFixed(3) + 'ms'
    });

    return playTime;
  }

  /**
   * スケジュール済みオーディオをキャンセル
   */
  cancelScheduled(id: string) {
    const scheduled = this.scheduledAudios.get(id);
    if (scheduled?.source) {
      try {
        scheduled.source.stop();
      } catch (e) {
        // 既に停止している場合のエラーを無視
      }
      this.scheduledAudios.delete(id);
      console.log('[AudioSync] スケジュールキャンセル:', id);
    }
  }

  /**
   * 全てのスケジュール済みオーディオをキャンセル
   */
  cancelAll() {
    console.log('[AudioSync] 全スケジュールキャンセル:', this.scheduledAudios.size);
    this.scheduledAudios.forEach(scheduled => {
      try {
        scheduled.source?.stop();
      } catch (e) {
        // エラーを無視
      }
    });
    this.scheduledAudios.clear();
  }

  /**
   * 現在のAudioContext時刻（サーバー時刻に変換）
   */
  getCurrentServerTime(): number {
    if (!this.audioContext || !this.isInitialized) {
      return timeSync.getServerTime();
    }
    return this.audioTimeToServerTime(this.audioContext.currentTime);
  }

  /**
   * 同期品質メトリクスを取得
   */
  getMetrics(): AudioSyncMetrics {
    const scheduled = Array.from(this.scheduledAudios.values());

    // スケジューリング誤差の平均
    const schedulingErrors = scheduled
      .filter(s => s.actualPlayTime !== undefined)
      .map(s => {
        const expectedAudioTime = this.serverTimeToAudioTime(s.scheduledTime);
        return (s.actualPlayTime! - expectedAudioTime) * 1000; // ms
      });

    const avgSchedulingError = schedulingErrors.length > 0
      ? schedulingErrors.reduce((a, b) => a + b, 0) / schedulingErrors.length
      : 0;

    return {
      schedulingError: avgSchedulingError,
      actualPlayError: 0, // 実測が必要
      scheduledCount: this.scheduledAudios.size,
      playedCount: this.playedCount
    };
  }

  /**
   * 状態を取得
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      audioContextState: this.audioContext?.state || 'null',
      currentTime: this.audioContext?.currentTime || 0,
      scheduledCount: this.scheduledAudios.size,
      playedCount: this.playedCount
    };
  }

  /**
   * リセット
   */
  reset() {
    this.cancelAll();
    this.isInitialized = false;
    this.audioContextStartTime = 0;
    this.playedCount = 0;
  }
}

// シングルトンインスタンス
export const audioSync = new AudioSyncEngine();
