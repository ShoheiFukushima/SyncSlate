import type { 
  Beat, 
  Onset, 
  MusicSegment,
  EditPoint,
  RelativeDynamics,
  MusicAnalysisOptions
} from './types.js';

/**
 * 編集点検出器
 * ビート、オンセット、セグメント境界などから編集点候補を検出
 */
export class EditPointDetector {
  private readonly options: MusicAnalysisOptions;
  private readonly minInterval: number;
  
  constructor(options: MusicAnalysisOptions) {
    this.options = options;
    this.minInterval = options.minEditPointInterval || 500; // デフォルト500ms
  }
  
  /**
   * 編集点を検出
   */
  public detectEditPoints(
    beats: Beat[],
    onsets: Onset[],
    segments: MusicSegment[],
    dynamics: RelativeDynamics[],
    duration: number
  ): EditPoint[] {
    const editPoints: EditPoint[] = [];
    
    // ビートからの編集点
    if (this.options.extractBeats) {
      editPoints.push(...this.detectFromBeats(beats));
    }
    
    // オンセットからの編集点
    if (this.options.extractOnsets) {
      editPoints.push(...this.detectFromOnsets(onsets));
    }
    
    // セグメント境界からの編集点
    if (this.options.extractSegments) {
      editPoints.push(...this.detectFromSegments(segments));
    }
    
    // ダイナミクスピークからの編集点
    editPoints.push(...this.detectFromDynamics(dynamics));
    
    // 無音部分の検出
    editPoints.push(...this.detectSilence(dynamics));
    
    // 編集点を統合・フィルタリング
    const merged = this.mergeEditPoints(editPoints);
    const filtered = this.filterByMinInterval(merged);
    
    // 音楽的コンテキストを追加
    return this.addMusicalContext(filtered, beats);
  }
  
  /**
   * ビートから編集点を検出
   */
  private detectFromBeats(beats: Beat[]): EditPoint[] {
    const editPoints: EditPoint[] = [];
    const sensitivity = this.options.editPointSensitivity || 0.5;
    
    // 強いビートを編集点候補に
    for (const beat of beats) {
      if (beat.strength > sensitivity) {
        editPoints.push({
          time: beat.time,
          confidence: beat.strength * beat.confidence,
          flexibility: 50, // ±50ms
          type: 'beat',
          reason: `Strong beat (strength: ${beat.strength.toFixed(2)})`,
        });
      }
    }
    
    // ダウンビート（小節の頭）を検出
    const downbeats = this.detectDownbeats(beats);
    for (const downbeat of downbeats) {
      const existing = editPoints.find(ep => 
        Math.abs(ep.time - downbeat.time) < 50
      );
      
      if (existing) {
        // 既存の編集点の信頼度を上げる
        existing.confidence = Math.min(1.0, existing.confidence * 1.2);
        existing.reason += ' (downbeat)';
      } else {
        editPoints.push({
          time: downbeat.time,
          confidence: downbeat.confidence * 0.9,
          flexibility: 30, // ダウンビートはより厳密
          type: 'beat',
          reason: 'Downbeat',
        });
      }
    }
    
    return editPoints;
  }
  
  /**
   * オンセットから編集点を検出
   */
  private detectFromOnsets(onsets: Onset[]): EditPoint[] {
    const editPoints: EditPoint[] = [];
    const sensitivity = this.options.editPointSensitivity || 0.5;
    
    // 強いオンセットを編集点候補に
    for (const onset of onsets) {
      if (onset.strength > sensitivity) {
        // パーカッシブなオンセットを優先
        const confidenceBoost = onset.type === 'percussive' ? 1.1 : 1.0;
        
        editPoints.push({
          time: onset.time,
          confidence: onset.strength * confidenceBoost,
          flexibility: 30, // オンセットは比較的厳密
          type: 'onset',
          reason: `${onset.type} onset (strength: ${onset.strength.toFixed(2)})`,
        });
      }
    }
    
    return editPoints;
  }
  
  /**
   * セグメント境界から編集点を検出
   */
  private detectFromSegments(segments: MusicSegment[]): EditPoint[] {
    const editPoints: EditPoint[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // セグメント開始点
      editPoints.push({
        time: segment.startTime,
        confidence: segment.confidence * 0.9,
        flexibility: 100, // セグメント境界は柔軟性を持たせる
        type: 'segment_boundary',
        reason: `Start of ${segment.type}`,
      });
      
      // 重要なセグメント（サビなど）は終了点も追加
      if (segment.type === 'chorus' || segment.type === 'bridge') {
        editPoints.push({
          time: segment.endTime,
          confidence: segment.confidence * 0.7,
          flexibility: 100,
          type: 'segment_boundary',
          reason: `End of ${segment.type}`,
        });
      }
    }
    
    return editPoints;
  }
  
  /**
   * ダイナミクスから編集点を検出
   */
  private detectFromDynamics(dynamics: RelativeDynamics[]): EditPoint[] {
    const editPoints: EditPoint[] = [];
    const sensitivity = this.options.editPointSensitivity || 0.5;
    
    // ピーク検出
    for (let i = 1; i < dynamics.length - 1; i++) {
      const prev = dynamics[i - 1];
      const curr = dynamics[i];
      const next = dynamics[i + 1];
      
      // 強度のピーク
      if (curr.intensity > prev.intensity && 
          curr.intensity > next.intensity &&
          curr.intensity > sensitivity) {
        editPoints.push({
          time: curr.time,
          confidence: curr.intensity * 0.8,
          flexibility: 50,
          type: 'energy_peak',
          reason: `Energy peak (intensity: ${curr.intensity.toFixed(2)})`,
        });
      }
      
      // 大きな変化点
      if (curr.variation > sensitivity * 1.5) {
        editPoints.push({
          time: curr.time,
          confidence: curr.variation * 0.7,
          flexibility: 80,
          type: 'energy_peak',
          reason: `High variation (${curr.variation.toFixed(2)})`,
        });
      }
    }
    
    return editPoints;
  }
  
  /**
   * 無音部分を検出
   */
  private detectSilence(dynamics: RelativeDynamics[]): EditPoint[] {
    const editPoints: EditPoint[] = [];
    const silenceThreshold = 0.1;
    const minSilenceDuration = 500; // 500ms以上の無音
    
    let silenceStart: number | null = null;
    
    for (let i = 0; i < dynamics.length; i++) {
      const curr = dynamics[i];
      
      if (curr.intensity < silenceThreshold) {
        if (silenceStart === null) {
          silenceStart = curr.time;
        }
      } else if (silenceStart !== null) {
        const silenceDuration = curr.time - silenceStart;
        
        if (silenceDuration >= minSilenceDuration) {
          // 無音の終了点を編集点に
          editPoints.push({
            time: curr.time,
            confidence: 0.6,
            flexibility: 20,
            type: 'silence',
            reason: `End of silence (${silenceDuration}ms)`,
          });
        }
        
        silenceStart = null;
      }
    }
    
    return editPoints;
  }
  
  /**
   * ダウンビートを検出
   */
  private detectDownbeats(beats: Beat[]): Beat[] {
    const downbeats: Beat[] = [];
    
    // 4/4拍子を仮定（実際は拍子検出が必要）
    const beatsPerMeasure = 4;
    
    for (let i = 0; i < beats.length; i += beatsPerMeasure) {
      if (beats[i]) {
        downbeats.push({
          ...beats[i],
          confidence: Math.min(1.0, beats[i].confidence * 1.2),
        });
      }
    }
    
    return downbeats;
  }
  
  /**
   * 編集点を統合
   */
  private mergeEditPoints(editPoints: EditPoint[]): EditPoint[] {
    const merged: EditPoint[] = [];
    const mergeWindow = 100; // 100ms以内の編集点は統合
    
    // 時間順にソート
    editPoints.sort((a, b) => a.time - b.time);
    
    for (const point of editPoints) {
      const nearby = merged.find(mp => 
        Math.abs(mp.time - point.time) < mergeWindow
      );
      
      if (nearby) {
        // より信頼度の高い方を採用
        if (point.confidence > nearby.confidence) {
          nearby.time = point.time;
          nearby.confidence = point.confidence;
          nearby.flexibility = Math.min(nearby.flexibility, point.flexibility);
          nearby.reason = `${nearby.reason} + ${point.reason}`;
        } else {
          // 信頼度を加算
          nearby.confidence = Math.min(1.0, nearby.confidence + point.confidence * 0.2);
        }
      } else {
        merged.push({ ...point });
      }
    }
    
    return merged;
  }
  
  /**
   * 最小間隔でフィルタリング
   */
  private filterByMinInterval(editPoints: EditPoint[]): EditPoint[] {
    const filtered: EditPoint[] = [];
    let lastTime = -Infinity;
    
    // 信頼度順にソート
    editPoints.sort((a, b) => b.confidence - a.confidence);
    
    for (const point of editPoints) {
      if (point.time - lastTime >= this.minInterval) {
        filtered.push(point);
        lastTime = point.time;
      }
    }
    
    // 時間順に再ソート
    filtered.sort((a, b) => a.time - b.time);
    
    return filtered;
  }
  
  /**
   * 音楽的コンテキストを追加
   */
  private addMusicalContext(
    editPoints: EditPoint[],
    beats: Beat[]
  ): EditPoint[] {
    // 最も近いビートを見つけて小節内位置を計算
    const beatsPerMeasure = 4; // 仮定
    
    for (const point of editPoints) {
      // 最も近いビートを見つける
      let closestBeat: Beat | null = null;
      let minDistance = Infinity;
      
      for (const beat of beats) {
        const distance = Math.abs(beat.time - point.time);
        if (distance < minDistance) {
          minDistance = distance;
          closestBeat = beat;
        }
      }
      
      if (closestBeat) {
        const beatIndex = beats.indexOf(closestBeat);
        const measurePosition = (beatIndex % beatsPerMeasure) / beatsPerMeasure;
        const isDownbeat = beatIndex % beatsPerMeasure === 0;
        
        point.musicalContext = {
          isDownbeat,
          measurePosition,
          phrasePosition: (beatIndex % 16) / 16, // 4小節フレーズを仮定
        };
      }
    }
    
    return editPoints;
  }
}