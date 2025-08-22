import type { 
  Sequence, 
  ClipItem, 
  CuePoint 
} from './types.js';

/**
 * キューポイント抽出器
 * In/Out点やマーカーを抽出
 */
export class CuePointExtractor {
  /**
   * シーケンスからキューポイントを抽出
   */
  public extractFromSequence(sequence: Sequence): CuePoint[] {
    const cuePoints: CuePoint[] = [];
    
    // ビデオトラックから抽出
    if (sequence.media.video) {
      cuePoints.push(...this.extractFromVideoTracks(sequence.media.video.track));
    }
    
    // オーディオトラックから抽出
    if (sequence.media.audio) {
      cuePoints.push(...this.extractFromAudioTracks(sequence.media.audio.track));
    }
    
    // 重複を除去して時間順にソート
    return this.deduplicateAndSort(cuePoints);
  }
  
  /**
   * ビデオトラックから抽出
   */
  private extractFromVideoTracks(
    tracks: Array<{ clipitem: ClipItem[]; enabled: boolean; locked: boolean }>
  ): CuePoint[] {
    const cuePoints: CuePoint[] = [];
    
    for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
      const track = tracks[trackIndex];
      
      if (!track.enabled) continue;
      
      for (const clip of track.clipitem) {
        cuePoints.push(...this.extractFromClip(clip, `V${trackIndex + 1}`));
      }
    }
    
    return cuePoints;
  }
  
  /**
   * オーディオトラックから抽出
   */
  private extractFromAudioTracks(
    tracks: Array<{ clipitem: ClipItem[]; enabled: boolean; locked: boolean }>
  ): CuePoint[] {
    const cuePoints: CuePoint[] = [];
    
    for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
      const track = tracks[trackIndex];
      
      if (!track.enabled) continue;
      
      for (const clip of track.clipitem) {
        cuePoints.push(...this.extractFromClip(clip, `A${trackIndex + 1}`));
      }
    }
    
    return cuePoints;
  }
  
  /**
   * クリップから抽出
   */
  private extractFromClip(clip: ClipItem, trackName: string): CuePoint[] {
    const cuePoints: CuePoint[] = [];
    
    // In点
    if (clip.in !== clip.start) {
      cuePoints.push({
        time: clip.start,
        name: `${clip.name} In`,
        type: 'in',
        comment: this.generateComment(clip, 'in', trackName),
        color: this.getColorFromLabel(clip.labels?.label),
      });
    }
    
    // Out点
    if (clip.out !== clip.end) {
      cuePoints.push({
        time: clip.end,
        name: `${clip.name} Out`,
        type: 'out',
        comment: this.generateComment(clip, 'out', trackName),
        color: this.getColorFromLabel(clip.labels?.label),
      });
    }
    
    // マーカー（ログ情報から生成）
    if (clip.logginginfo) {
      const markers = this.extractMarkersFromLoggingInfo(clip);
      cuePoints.push(...markers);
    }
    
    return cuePoints;
  }
  
  /**
   * コメントを生成
   */
  private generateComment(
    clip: ClipItem,
    type: 'in' | 'out',
    trackName: string
  ): string {
    const parts: string[] = [];
    
    // トラック名
    parts.push(`Track: ${trackName}`);
    
    // クリップ情報
    if (clip.file?.name) {
      parts.push(`File: ${clip.file.name}`);
    }
    
    // ログ情報
    if (clip.logginginfo) {
      if (clip.logginginfo.description) {
        parts.push(`Desc: ${clip.logginginfo.description}`);
      }
      if (clip.logginginfo.scene) {
        parts.push(`Scene: ${clip.logginginfo.scene}`);
      }
      if (clip.logginginfo.shottake) {
        parts.push(`Shot/Take: ${clip.logginginfo.shottake}`);
      }
    }
    
    // タイムコード
    const timecode = this.frameToTimecode(
      type === 'in' ? clip.in : clip.out,
      clip.rate.timebase,
      clip.rate.ntsc
    );
    parts.push(`TC: ${timecode}`);
    
    return parts.join(' | ');
  }
  
  /**
   * ラベルから色を取得
   */
  private getColorFromLabel(label?: string): string {
    const colorMap: Record<string, string> = {
      'Red': '#FF0000',
      'Orange': '#FFA500',
      'Yellow': '#FFFF00',
      'Green': '#00FF00',
      'Blue': '#0000FF',
      'Purple': '#800080',
      'Violet': '#EE82EE',
      'Brown': '#A52A2A',
      'Iris': '#5A4FCF',
      'Cerulean': '#007BA7',
      'Lavender': '#E6E6FA',
      'Forest': '#228B22',
      'Rose': '#FF007F',
      'Mango': '#FF8243',
      'Caribbean': '#00CED1',
    };
    
    return colorMap[label || ''] || '#808080';
  }
  
  /**
   * ログ情報からマーカーを抽出
   */
  private extractMarkersFromLoggingInfo(clip: ClipItem): CuePoint[] {
    const markers: CuePoint[] = [];
    
    if (!clip.logginginfo) return markers;
    
    // Good take マーカー
    if (clip.logginginfo.good === true) {
      markers.push({
        time: clip.start + Math.floor((clip.end - clip.start) / 2),
        name: 'Good Take',
        type: 'marker',
        comment: `${clip.name} - Good Take`,
        color: '#00FF00',
      });
    }
    
    // ログノートをマーカーとして追加
    if (clip.logginginfo.lognote) {
      const notes = clip.logginginfo.lognote.split(';');
      
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i].trim();
        if (note) {
          markers.push({
            time: clip.start + (i * 1000), // 1秒間隔で配置
            name: `Note ${i + 1}`,
            type: 'marker',
            comment: note,
            color: '#FFFF00',
          });
        }
      }
    }
    
    return markers;
  }
  
  /**
   * フレームをタイムコードに変換
   */
  private frameToTimecode(
    frame: number,
    timebase: number,
    ntsc: boolean
  ): string {
    const fps = ntsc ? timebase * 1000 / 1001 : timebase;
    const totalSeconds = frame / fps;
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const frames = Math.floor((totalSeconds % 1) * fps);
    
    const separator = ntsc ? ';' : ':';
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
      frames.toString().padStart(2, '0'),
    ].join(separator);
  }
  
  /**
   * タイムコードをフレームに変換
   */
  public timecodeToFrame(
    timecode: string,
    timebase: number,
    ntsc: boolean
  ): number {
    const parts = timecode.split(/[:;]/);
    
    if (parts.length !== 4) {
      throw new Error(`Invalid timecode format: ${timecode}`);
    }
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    const frames = parseInt(parts[3], 10);
    
    const fps = ntsc ? timebase * 1000 / 1001 : timebase;
    const totalSeconds = hours * 3600 + minutes * 60 + seconds + frames / fps;
    
    return Math.round(totalSeconds * fps);
  }
  
  /**
   * 重複を除去してソート
   */
  private deduplicateAndSort(cuePoints: CuePoint[]): CuePoint[] {
    // 時間とタイプでユニークキーを生成
    const uniqueMap = new Map<string, CuePoint>();
    
    for (const cuePoint of cuePoints) {
      const key = `${cuePoint.time}_${cuePoint.type}_${cuePoint.name}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, cuePoint);
      } else {
        // 既存のものより詳細な情報があれば更新
        const existing = uniqueMap.get(key)!;
        if (!existing.comment && cuePoint.comment) {
          uniqueMap.set(key, cuePoint);
        }
      }
    }
    
    // 配列に戻して時間順にソート
    return Array.from(uniqueMap.values()).sort((a, b) => {
      if (a.time !== b.time) {
        return a.time - b.time;
      }
      // 同じ時間の場合はタイプで順序付け（in -> marker -> out）
      const typeOrder = { in: 0, marker: 1, out: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });
  }
  
  /**
   * キューポイントをグループ化
   */
  public groupByTime(
    cuePoints: CuePoint[],
    threshold: number = 100
  ): Array<CuePoint[]> {
    const groups: Array<CuePoint[]> = [];
    let currentGroup: CuePoint[] = [];
    let lastTime = -Infinity;
    
    for (const cuePoint of cuePoints) {
      if (cuePoint.time - lastTime > threshold) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [cuePoint];
      } else {
        currentGroup.push(cuePoint);
      }
      lastTime = cuePoint.time;
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }
  
  /**
   * キューポイントをフィルタリング
   */
  public filter(
    cuePoints: CuePoint[],
    options: {
      types?: Array<'in' | 'out' | 'marker'>;
      timeRange?: [number, number];
      namePattern?: RegExp;
    }
  ): CuePoint[] {
    return cuePoints.filter(cuePoint => {
      // タイプフィルター
      if (options.types && !options.types.includes(cuePoint.type)) {
        return false;
      }
      
      // 時間範囲フィルター
      if (options.timeRange) {
        const [start, end] = options.timeRange;
        if (cuePoint.time < start || cuePoint.time > end) {
          return false;
        }
      }
      
      // 名前パターンフィルター
      if (options.namePattern && !options.namePattern.test(cuePoint.name)) {
        return false;
      }
      
      return true;
    });
  }
}