import { parseString } from 'xml2js';
import { promises as fs } from 'fs';
import path from 'path';
import type {
  PremiereXML,
  Sequence,
  ClipItem,
  MediaClip,
  MaterialPath,
  CuePoint,
  XMLParseResult,
} from './types.js';

/**
 * Premiere Pro XML パーサー
 * XMLファイルから編集情報を抽出
 */
export class PremiereXMLParser {
  private xmlData?: PremiereXML;
  private basePath: string = '';
  
  /**
   * XMLファイルをパース
   */
  public async parse(xmlPath: string): Promise<XMLParseResult> {
    console.log(`Parsing Premiere XML: ${xmlPath}`);
    
    // XMLファイルを読み込み
    const xmlContent = await fs.readFile(xmlPath, 'utf-8');
    this.basePath = path.dirname(xmlPath);
    
    // XMLをパース
    this.xmlData = await this.parseXML(xmlContent);
    
    // 情報を抽出
    const sequence = this.extractSequence();
    const clips = this.extractClips();
    const materials = await this.resolveMaterialPaths(clips);
    const cuePoints = this.extractCuePoints(sequence);
    const metadata = this.extractMetadata(sequence);
    
    return {
      sequence,
      clips,
      materials,
      cuePoints,
      metadata,
    };
  }
  
  /**
   * XMLをパース
   */
  private parseXML(xmlContent: string): Promise<PremiereXML> {
    return new Promise((resolve, reject) => {
      parseString(xmlContent, {
        explicitArray: false,
        mergeAttrs: true,
        normalize: true,
        normalizeTags: true,
      }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result as PremiereXML);
        }
      });
    });
  }
  
  /**
   * シーケンスを抽出
   */
  private extractSequence(): Sequence {
    if (!this.xmlData?.xmeml?.sequence) {
      throw new Error('No sequence found in XML');
    }
    
    const seq = this.xmlData.xmeml.sequence;
    
    // 配列の場合は最初の要素を使用
    const sequence = Array.isArray(seq) ? seq[0] : seq;
    
    return this.normalizeSequence(sequence);
  }
  
  /**
   * シーケンスを正規化
   */
  private normalizeSequence(seq: any): Sequence {
    // レート情報を抽出
    const rate = this.extractRate(seq.rate);
    
    // タイムコード情報を抽出
    const timecode = this.extractTimecode(seq.timecode);
    
    // メディア情報を抽出
    const media = {
      video: this.extractVideoTrack(seq.media?.video),
      audio: seq.media?.audio ? this.extractAudioTrack(seq.media.audio) : undefined,
    };
    
    return {
      name: seq.name || 'Untitled Sequence',
      duration: parseInt(seq.duration || '0'),
      rate,
      media,
      timecode,
      uuid: seq.uuid,
    };
  }
  
  /**
   * レート情報を抽出
   */
  private extractRate(rateData: any): Sequence['rate'] {
    if (!rateData) {
      return { timebase: 30, ntsc: false };
    }
    
    return {
      timebase: parseInt(rateData.timebase || '30'),
      ntsc: rateData.ntsc === 'true' || rateData.ntsc === true,
    };
  }
  
  /**
   * タイムコード情報を抽出
   */
  private extractTimecode(timecodeData: any): Sequence['timecode'] {
    if (!timecodeData) {
      return {
        rate: { timebase: 30, ntsc: false },
        string: '00:00:00:00',
        frame: 0,
        displayformat: 'NDF',
      };
    }
    
    return {
      rate: this.extractRate(timecodeData.rate),
      string: timecodeData.string || '00:00:00:00',
      frame: parseInt(timecodeData.frame || '0'),
      displayformat: timecodeData.displayformat || 'NDF',
    };
  }
  
  /**
   * ビデオトラックを抽出
   */
  private extractVideoTrack(videoData: any): Sequence['media']['video'] {
    if (!videoData) {
      return {
        format: {
          samplecharacteristics: {
            width: 1920,
            height: 1080,
            pixelaspectratio: 'square',
            fielddominance: 'none',
            rate: { timebase: 30, ntsc: false },
          },
        },
        track: [],
      };
    }
    
    // フォーマット情報
    const format = {
      samplecharacteristics: {
        width: parseInt(videoData.format?.samplecharacteristics?.width || '1920'),
        height: parseInt(videoData.format?.samplecharacteristics?.height || '1080'),
        pixelaspectratio: videoData.format?.samplecharacteristics?.pixelaspectratio || 'square',
        fielddominance: videoData.format?.samplecharacteristics?.fielddominance || 'none',
        rate: this.extractRate(videoData.format?.samplecharacteristics?.rate),
        codec: videoData.format?.samplecharacteristics?.codec,
      },
    };
    
    // トラック情報
    const tracks = this.extractTracks(videoData.track);
    
    return {
      format,
      track: tracks,
    };
  }
  
  /**
   * オーディオトラックを抽出
   */
  private extractAudioTrack(audioData: any): Sequence['media']['audio'] {
    if (!audioData) {
      return undefined;
    }
    
    const format = {
      samplecharacteristics: {
        samplerate: parseInt(audioData.format?.samplecharacteristics?.samplerate || '48000'),
        depth: parseInt(audioData.format?.samplecharacteristics?.depth || '16'),
      },
    };
    
    const tracks = this.extractTracks(audioData.track);
    
    return {
      format,
      track: tracks,
    };
  }
  
  /**
   * トラックを抽出
   */
  private extractTracks(trackData: any): Array<{
    clipitem: ClipItem[];
    enabled: boolean;
    locked: boolean;
  }> {
    if (!trackData) {
      return [];
    }
    
    const tracks = Array.isArray(trackData) ? trackData : [trackData];
    
    return tracks.map(track => ({
      clipitem: this.extractClipItems(track.clipitem),
      enabled: track.enabled !== 'false',
      locked: track.locked === 'true',
    }));
  }
  
  /**
   * クリップアイテムを抽出
   */
  private extractClipItems(clipData: any): ClipItem[] {
    if (!clipData) {
      return [];
    }
    
    const clips = Array.isArray(clipData) ? clipData : [clipData];
    
    return clips.map(clip => this.normalizeClipItem(clip));
  }
  
  /**
   * クリップアイテムを正規化
   */
  private normalizeClipItem(clip: any): ClipItem {
    return {
      id: clip.id || `clip_${Date.now()}_${Math.random()}`,
      name: clip.name || 'Untitled Clip',
      duration: parseInt(clip.duration || '0'),
      rate: this.extractRate(clip.rate),
      start: parseInt(clip.start || '0'),
      end: parseInt(clip.end || '0'),
      in: parseInt(clip.in || '0'),
      out: parseInt(clip.out || '0'),
      file: clip.file ? this.extractFileInfo(clip.file) : undefined,
      filter: clip.filter ? this.extractFilters(clip.filter) : undefined,
      logginginfo: clip.logginginfo,
      colorinfo: clip.colorinfo,
      labels: clip.labels,
    };
  }
  
  /**
   * ファイル情報を抽出
   */
  private extractFileInfo(fileData: any): ClipItem['file'] {
    return {
      id: fileData.id || `file_${Date.now()}`,
      name: fileData.name || 'Untitled File',
      pathurl: fileData.pathurl || '',
      rate: this.extractRate(fileData.rate),
      duration: parseInt(fileData.duration || '0'),
      timecode: fileData.timecode ? this.extractTimecode(fileData.timecode) : undefined,
      media: fileData.media,
    };
  }
  
  /**
   * フィルターを抽出
   */
  private extractFilters(filterData: any): ClipItem['filter'] {
    const filters = Array.isArray(filterData) ? filterData : [filterData];
    
    return filters.map(filter => ({
      effect: {
        name: filter.effect?.name || 'Unknown Effect',
        effectid: filter.effect?.effectid || '',
        effecttype: filter.effect?.effecttype || 'filter',
        mediatype: filter.effect?.mediatype || 'video',
        parameter: filter.effect?.parameter,
      },
    }));
  }
  
  /**
   * クリップを抽出
   */
  private extractClips(): MediaClip[] {
    const clips: MediaClip[] = [];
    
    if (!this.xmlData?.xmeml?.sequence) {
      return clips;
    }
    
    const sequence = this.xmlData.xmeml.sequence;
    
    // ビデオトラックからクリップを収集
    if (sequence.media?.video?.track) {
      const tracks = Array.isArray(sequence.media.video.track) ? 
        sequence.media.video.track : [sequence.media.video.track];
      
      for (const track of tracks) {
        if (track.clipitem) {
          const clipItems = Array.isArray(track.clipitem) ? 
            track.clipitem : [track.clipitem];
          
          for (const clipItem of clipItems) {
            if (clipItem.file) {
              clips.push(this.clipItemToMediaClip(clipItem));
            }
          }
        }
      }
    }
    
    // ビンからもクリップを収集
    if (this.xmlData.xmeml.bin) {
      clips.push(...this.extractClipsFromBin(this.xmlData.xmeml.bin));
    }
    
    // 重複を除去
    const uniqueClips = new Map<string, MediaClip>();
    for (const clip of clips) {
      uniqueClips.set(clip.id, clip);
    }
    
    return Array.from(uniqueClips.values());
  }
  
  /**
   * クリップアイテムをメディアクリップに変換
   */
  private clipItemToMediaClip(clipItem: ClipItem): MediaClip {
    return {
      id: clipItem.file?.id || clipItem.id,
      name: clipItem.file?.name || clipItem.name,
      duration: clipItem.file?.duration || clipItem.duration,
      rate: clipItem.file?.rate || clipItem.rate,
      media: clipItem.file?.media || {
        video: {
          duration: clipItem.duration,
          samplecharacteristics: {
            width: 1920,
            height: 1080,
            pixelaspectratio: 'square',
          },
        },
      },
      logginginfo: clipItem.logginginfo,
    };
  }
  
  /**
   * ビンからクリップを抽出
   */
  private extractClipsFromBin(bin: any): MediaClip[] {
    const clips: MediaClip[] = [];
    
    if (bin.children) {
      const children = Array.isArray(bin.children) ? bin.children : [bin.children];
      
      for (const child of children) {
        if (child.clip) {
          const clipData = Array.isArray(child.clip) ? child.clip : [child.clip];
          clips.push(...clipData.map((c: any) => this.normalizeMediaClip(c)));
        }
        
        if (child.bin) {
          clips.push(...this.extractClipsFromBin(child.bin));
        }
      }
    }
    
    return clips;
  }
  
  /**
   * メディアクリップを正規化
   */
  private normalizeMediaClip(clipData: any): MediaClip {
    return {
      id: clipData.id || `clip_${Date.now()}`,
      name: clipData.name || 'Untitled',
      duration: parseInt(clipData.duration || '0'),
      rate: this.extractRate(clipData.rate),
      media: clipData.media || {},
      logginginfo: clipData.logginginfo,
    };
  }
  
  /**
   * 素材パスを解決
   */
  private async resolveMaterialPaths(clips: MediaClip[]): Promise<MaterialPath[]> {
    const materials: MaterialPath[] = [];
    const processed = new Set<string>();
    
    for (const clip of clips) {
      // パスURLから実際のパスを抽出
      const pathUrl = this.extractPathFromClip(clip);
      
      if (pathUrl && !processed.has(pathUrl)) {
        processed.add(pathUrl);
        
        const material = await this.resolvePath(pathUrl);
        materials.push(material);
      }
    }
    
    return materials;
  }
  
  /**
   * クリップからパスを抽出
   */
  private extractPathFromClip(clip: MediaClip): string | null {
    // クリップのlogginginfo等からパスを探す
    // 実際の実装はXML構造に依存
    return null;
  }
  
  /**
   * パスを解決
   */
  private async resolvePath(pathUrl: string): Promise<MaterialPath> {
    // file:// URLから実際のパスに変換
    let resolvedPath = pathUrl;
    if (pathUrl.startsWith('file://')) {
      resolvedPath = pathUrl.substring(7);
    }
    
    // 相対パスの場合は基準パスから解決
    if (!path.isAbsolute(resolvedPath)) {
      resolvedPath = path.join(this.basePath, resolvedPath);
    }
    
    // ファイルの存在確認
    let exists = false;
    try {
      await fs.access(resolvedPath);
      exists = true;
    } catch {
      exists = false;
    }
    
    // ファイルタイプを判定
    const ext = path.extname(resolvedPath).toLowerCase();
    let type: MaterialPath['type'] = 'video';
    
    if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
      type = 'video';
    } else if (['.mp3', '.wav', '.aac', '.m4a'].includes(ext)) {
      type = 'audio';
    } else if (['.jpg', '.jpeg', '.png', '.tiff'].includes(ext)) {
      type = 'image';
    }
    
    return {
      originalPath: pathUrl,
      resolvedPath,
      exists,
      type,
    };
  }
  
  /**
   * キューポイントを抽出
   */
  private extractCuePoints(sequence: Sequence): CuePoint[] {
    const cuePoints: CuePoint[] = [];
    
    // ビデオトラックのクリップからIn/Out点を抽出
    for (const track of sequence.media.video.track) {
      for (const clip of track.clipitem) {
        // In点
        if (clip.in > 0) {
          cuePoints.push({
            time: clip.start + clip.in,
            name: `${clip.name} In`,
            type: 'in',
            comment: clip.logginginfo?.description,
          });
        }
        
        // Out点
        if (clip.out > 0) {
          cuePoints.push({
            time: clip.start + clip.out,
            name: `${clip.name} Out`,
            type: 'out',
            comment: clip.logginginfo?.description,
          });
        }
      }
    }
    
    // 時間順にソート
    cuePoints.sort((a, b) => a.time - b.time);
    
    return cuePoints;
  }
  
  /**
   * メタデータを抽出
   */
  private extractMetadata(sequence: Sequence): XMLParseResult['metadata'] {
    const format = sequence.media.video.format.samplecharacteristics;
    
    return {
      projectName: sequence.name,
      creator: 'AutoEditTATE',
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString(),
      frameRate: format.rate.timebase,
      resolution: {
        width: format.width,
        height: format.height,
      },
    };
  }
}