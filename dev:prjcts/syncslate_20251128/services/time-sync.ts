/**
 * NTP時刻同期サービス
 *
 * サーバーとの時刻オフセットを計算し、高精度な時刻同期を実現
 *
 * アルゴリズム:
 * 1. クライアント時刻 T1 を記録（performance.now()）
 * 2. サーバーにリクエスト送信
 * 3. サーバー時刻 Ts を受信
 * 4. クライアント時刻 T2 を記録（performance.now()）
 * 5. RTT = T2 - T1
 * 6. オフセット = Ts - (T1 + RTT/2)
 *
 * 複数回サンプリングして最小RTTを採用（最も正確）
 */

export interface TimeSyncSample {
  offset: number;    // サーバーとの時刻オフセット（ms）
  rtt: number;       // Round Trip Time (ms)
  timestamp: number; // サンプリング時刻
}

export interface TimeSyncMetrics {
  currentOffset: number;     // 現在のオフセット（ms）
  currentLatency: number;    // 現在のレイテンシ（RTT/2）
  offsetStdDev: number;      // オフセット標準偏差
  quality: 'excellent' | 'good' | 'poor'; // 同期品質
  sampleCount: number;       // サンプル数
}

class PrecisionTimeSync {
  public offset: number = 0;
  public latency: number = 0;
  private syncHistory: TimeSyncSample[] = [];
  private maxHistorySize: number = 50;
  private isInitialized: boolean = false;

  /**
   * サーバー時刻との同期
   *
   * @param url - サーバーURL
   * @param sampleCount - サンプリング回数（デフォルト: 5）
   * @returns 同期結果（オフセットとRTT）
   */
  async syncWithServer(url: string, sampleCount: number = 5): Promise<TimeSyncSample> {
    const samples: TimeSyncSample[] = [];

    // 複数回サンプリング
    for (let i = 0; i < sampleCount; i++) {
      const t1 = performance.now();

      try {
        const response = await fetch(`${url}/api/time`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientTime: t1 })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const t2 = performance.now();
        const { serverTime } = await response.json();

        const rtt = t2 - t1;
        const offset = serverTime - (t1 + rtt / 2);

        samples.push({ offset, rtt, timestamp: Date.now() });

        // サンプル間に少し待機（ネットワークノイズを分散）
        if (i < sampleCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error) {
        console.warn(`[TimeSync] サンプル ${i + 1}/${sampleCount} 失敗:`, error);
        // エラーが発生してもサンプリングを続行
        continue;
      }
    }

    if (samples.length === 0) {
      throw new Error('[TimeSync] 全てのサンプリングが失敗しました');
    }

    // RTTが最小のサンプルを採用（最も正確）
    const bestSample = samples.reduce((min, curr) =>
      curr.rtt < min.rtt ? curr : min
    );

    this.offset = bestSample.offset;
    this.latency = bestSample.rtt / 2;
    this.isInitialized = true;

    // 履歴に追加（サイズ制限あり）
    this.syncHistory.push(bestSample);
    if (this.syncHistory.length > this.maxHistorySize) {
      this.syncHistory.shift();
    }

    console.log('[TimeSync] 同期完了:', {
      offset: this.offset.toFixed(2),
      rtt: bestSample.rtt.toFixed(2),
      samples: samples.length
    });

    return bestSample;
  }

  /**
   * サーバー時刻を取得（補正済み）
   * performance.now() + オフセット
   */
  getServerTime(): number {
    if (!this.isInitialized) {
      console.warn('[TimeSync] 未初期化状態でgetServerTime()が呼ばれました');
      return performance.now();
    }
    return performance.now() + this.offset;
  }

  /**
   * クライアント時刻からサーバー時刻へ変換
   */
  toServerTime(clientTime: number): number {
    return clientTime + this.offset;
  }

  /**
   * サーバー時刻からクライアント時刻へ変換
   */
  toClientTime(serverTime: number): number {
    return serverTime - this.offset;
  }

  /**
   * 同期品質メトリクスを取得
   */
  getQualityMetrics(): TimeSyncMetrics {
    if (this.syncHistory.length === 0) {
      return {
        currentOffset: this.offset,
        currentLatency: this.latency,
        offsetStdDev: 0,
        quality: 'poor',
        sampleCount: 0
      };
    }

    // 直近10サンプルの統計
    const recentHistory = this.syncHistory.slice(-10);
    const avgOffset = recentHistory.reduce((sum, s) => sum + s.offset, 0) / recentHistory.length;
    const offsetStdDev = Math.sqrt(
      recentHistory.reduce((sum, s) => sum + Math.pow(s.offset - avgOffset, 2), 0) / recentHistory.length
    );

    // 品質判定
    let quality: 'excellent' | 'good' | 'poor';
    if (offsetStdDev < 2) {
      quality = 'excellent'; // ±2ms以内
    } else if (offsetStdDev < 5) {
      quality = 'good';      // ±5ms以内
    } else {
      quality = 'poor';      // それ以上
    }

    return {
      currentOffset: this.offset,
      currentLatency: this.latency,
      offsetStdDev,
      quality,
      sampleCount: this.syncHistory.length
    };
  }

  /**
   * 同期状態をリセット
   */
  reset() {
    this.offset = 0;
    this.latency = 0;
    this.syncHistory = [];
    this.isInitialized = false;
  }

  /**
   * 初期化済みかどうか
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 同期履歴を取得
   */
  getHistory(): TimeSyncSample[] {
    return [...this.syncHistory];
  }
}

// シングルトンインスタンス
export const timeSync = new PrecisionTimeSync();
