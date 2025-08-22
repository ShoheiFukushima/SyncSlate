import { create } from 'xmlbuilder2';
import { promises as fs } from 'fs';
import path from 'path';
import type { EditDecision, EditPattern } from '@autoedittate/matching';
import type { 
  PremiereXML,
  Sequence,
  ClipItem,
  XMLGenerateOptions,
} from './types.js';

/**
 * XML生成器
 * 編集決定からPremiere Pro互換のXMLを生成
 */
export class XMLGenerator {
  private readonly options: Required<XMLGenerateOptions>;
  private fileIdCounter = 1;
  private clipIdCounter = 1;
  
  constructor(options: XMLGenerateOptions) {
    this.options = {
      projectName: options.projectName,
      frameRate: options.frameRate || 30,
      resolution: options.resolution || { width: 1920, height: 1080 },
      includeAudio: options.includeAudio ?? true,
      includeEffects: options.includeEffects ?? false,
      includeMarkers: options.includeMarkers ?? true,
      includeColorCorrection: options.includeColorCorrection ?? false,
      outputFormat: options.outputFormat || 'premiere',
    };
  }
  
  /**
   * 編集パターンからXMLを生成
   */
  public async generateFromPattern(
    pattern: EditPattern,
    outputPath: string
  ): Promise<void> {
    console.log(`Generating XML for pattern: ${pattern.name}`);
    
    // XML構造を構築
    const xml = this.buildXML(pattern);
    
    // XMLを文字列に変換
    const xmlString = this.serializeXML(xml);
    
    // ファイルに保存
    await fs.writeFile(outputPath, xmlString, 'utf-8');
    
    console.log(`XML saved to: ${outputPath}`);
  }
  
  /**
   * XMLを構築
   */
  private buildXML(pattern: EditPattern): PremiereXML {
    const sequence = this.createSequence(pattern);
    
    return {
      xmeml: {
        $: {
          version: '5',
        },
        sequence,
      },
    };
  }
  
  /**
   * シーケンスを作成
   */
  private createSequence(pattern: EditPattern): Sequence {
    const duration = this.calculateSequenceDuration(pattern.decisions);
    
    return {
      name: `${this.options.projectName}_${pattern.name}`,
      duration,
      rate: {
        timebase: this.options.frameRate,
        ntsc: false,
      },
      media: {
        video: this.createVideoTrack(pattern.decisions),
        audio: this.options.includeAudio ? 
          this.createAudioTrack(pattern.decisions) : undefined,
      },
      timecode: {
        rate: {
          timebase: this.options.frameRate,
          ntsc: false,
        },
        string: '00:00:00:00',
        frame: 0,
        displayformat: 'NDF',
      },
      uuid: this.generateUUID(),
    };
  }
  
  /**
   * ビデオトラックを作成
   */
  private createVideoTrack(decisions: EditDecision[]): Sequence['media']['video'] {
    return {
      format: {
        samplecharacteristics: {
          width: this.options.resolution.width,
          height: this.options.resolution.height,
          pixelaspectratio: 'square',
          fielddominance: 'none',
          rate: {
            timebase: this.options.frameRate,
            ntsc: false,
          },
          codec: {
            name: 'Apple ProRes 422',
          },
        },
      },
      track: [
        {
          clipitem: decisions.map(d => this.createClipItem(d)),
          enabled: true,
          locked: false,
        },
      ],
    };
  }
  
  /**
   * オーディオトラックを作成
   */
  private createAudioTrack(decisions: EditDecision[]): Sequence['media']['audio'] {
    return {
      format: {
        samplecharacteristics: {
          samplerate: 48000,
          depth: 16,
        },
      },
      track: [
        {
          clipitem: decisions.map(d => this.createAudioClipItem(d)),
          enabled: true,
          locked: false,
        },
      ],
    };
  }
  
  /**
   * クリップアイテムを作成
   */
  private createClipItem(decision: EditDecision): ClipItem {
    const clipId = `clip_${this.clipIdCounter++}`;
    const fileId = `file_${this.fileIdCounter++}`;
    
    // フレーム数に変換
    const fps = this.options.frameRate;
    const startFrame = Math.round((decision.time / 1000) * fps);
    const durationFrames = Math.round((decision.duration / 1000) * fps);
    const endFrame = startFrame + durationFrames;
    
    // ショット内のIn/Out点
    const inFrame = Math.round((decision.inPoint / 1000) * fps);
    const outFrame = Math.round((decision.outPoint / 1000) * fps);
    
    const clipItem: ClipItem = {
      id: clipId,
      name: decision.shot.id,
      duration: durationFrames,
      rate: {
        timebase: fps,
        ntsc: false,
      },
      start: startFrame,
      end: endFrame,
      in: inFrame,
      out: outFrame,
      file: {
        id: fileId,
        name: decision.shot.id,
        pathurl: `file://localhost/${decision.shot.id}.mov`, // 仮のパス
        rate: {
          timebase: fps,
          ntsc: false,
        },
        duration: Math.round((decision.shot.duration / 1000) * fps),
        media: {
          video: {
            duration: Math.round((decision.shot.duration / 1000) * fps),
            samplecharacteristics: {
              width: this.options.resolution.width,
              height: this.options.resolution.height,
              pixelaspectratio: 'square',
            },
          },
        },
      },
      logginginfo: {
        description: `Confidence: ${decision.confidence.toFixed(2)}`,
        scene: decision.matchingDetails.segmentName,
        shottake: decision.matchingDetails.editPoint?.type || 'manual',
        lognote: this.createLogNote(decision),
        good: decision.shot.isHeroShot,
      },
      labels: {
        label: this.getLabel(decision),
      },
    };
    
    // エフェクトを追加
    if (this.options.includeEffects) {
      clipItem.filter = this.createEffects(decision);
    }
    
    // カラー補正を追加
    if (this.options.includeColorCorrection) {
      clipItem.colorinfo = this.createColorInfo(decision);
    }
    
    return clipItem;
  }
  
  /**
   * オーディオクリップアイテムを作成
   */
  private createAudioClipItem(decision: EditDecision): ClipItem {
    // ビデオクリップと同じタイミング
    const clipItem = this.createClipItem(decision);
    
    // オーディオ固有の設定
    if (clipItem.file) {
      clipItem.file.media = {
        audio: {
          samplecharacteristics: {
            samplerate: 48000,
            depth: 16,
          },
        },
      };
    }
    
    return clipItem;
  }
  
  /**
   * ログノートを作成
   */
  private createLogNote(decision: EditDecision): string {
    const notes: string[] = [];
    
    // スコア情報
    notes.push(`Visual: ${decision.scores.visual.toFixed(2)}`);
    notes.push(`Sync: ${decision.scores.sync.toFixed(2)}`);
    notes.push(`Semantic: ${decision.scores.semantic.toFixed(2)}`);
    notes.push(`Stability: ${decision.scores.stability.toFixed(2)}`);
    notes.push(`Overall: ${decision.scores.overall.toFixed(2)}`);
    
    // 音楽コンテキスト
    if (decision.matchingDetails.musicalContext) {
      const ctx = decision.matchingDetails.musicalContext;
      if (ctx.isDownbeat) {
        notes.push('Downbeat');
      }
      notes.push(`Measure: ${ctx.measurePosition.toFixed(2)}`);
    }
    
    // トランジション情報
    if (decision.transition?.validation) {
      const val = decision.transition.validation;
      notes.push(`30% Rule: ${val.isValid ? 'OK' : 'NG'}`);
      notes.push(`Max Change: ${val.maxChange.toFixed(2)} (${val.changeDimension})`);
    }
    
    return notes.join('; ');
  }
  
  /**
   * ラベルを取得
   */
  private getLabel(decision: EditDecision): string {
    // 確信度に基づいてラベルを設定
    if (decision.confidence >= 0.9) {
      return 'Iris'; // 高確信度
    } else if (decision.confidence >= 0.7) {
      return 'Caribbean'; // 中確信度
    } else if (decision.confidence >= 0.5) {
      return 'Yellow'; // 低確信度
    } else {
      return 'Red'; // 要確認
    }
  }
  
  /**
   * エフェクトを作成
   */
  private createEffects(decision: EditDecision): ClipItem['filter'] {
    const filters: ClipItem['filter'] = [];
    
    // スローモーション効果（エンディングなど）
    if (decision.matchingDetails.segmentName === 'ending' && decision.duration > 3000) {
      filters.push({
        effect: {
          name: 'Time Remap',
          effectid: 'timeremap',
          effecttype: 'motion',
          mediatype: 'video',
          parameter: [
            {
              parameterid: 'speed',
              name: 'Speed',
              value: 50, // 50%スピード
            },
          ],
        },
      });
    }
    
    // フェード効果
    if (decision.time === 0) {
      // フェードイン
      filters.push({
        effect: {
          name: 'Cross Dissolve',
          effectid: 'crossdissolve',
          effecttype: 'transition',
          mediatype: 'video',
          parameter: [
            {
              parameterid: 'duration',
              name: 'Duration',
              value: 30, // 30フレーム
            },
          ],
        },
      });
    }
    
    return filters.length > 0 ? filters : undefined;
  }
  
  /**
   * カラー情報を作成
   */
  private createColorInfo(decision: EditDecision): ClipItem['colorinfo'] {
    // セグメントに基づいてカラーグレーディング
    let lut = 'Standard';
    let saturation = 1.0;
    
    switch (decision.matchingDetails.segmentName) {
      case 'opening':
        lut = 'Vibrant';
        saturation = 1.1;
        break;
      case 'climax':
        lut = 'Dramatic';
        saturation = 1.2;
        break;
      case 'ending':
        lut = 'Cinematic';
        saturation = 0.9;
        break;
    }
    
    return {
      lut,
      asc_sat: saturation,
    };
  }
  
  /**
   * シーケンスの総時間を計算
   */
  private calculateSequenceDuration(decisions: EditDecision[]): number {
    if (decisions.length === 0) return 0;
    
    const lastDecision = decisions[decisions.length - 1];
    const durationMs = lastDecision.time + lastDecision.duration;
    
    return Math.round((durationMs / 1000) * this.options.frameRate);
  }
  
  /**
   * XMLをシリアライズ
   */
  private serializeXML(xml: PremiereXML): string {
    const doc = create({ encoding: 'UTF-8' })
      .ele('xmeml', { version: xml.xmeml.$.version });
    
    // シーケンスを追加
    this.addSequenceToXML(doc, xml.xmeml.sequence);
    
    return doc.end({ prettyPrint: true });
  }
  
  /**
   * シーケンスをXMLに追加
   */
  private addSequenceToXML(parent: any, sequence: Sequence): void {
    const seq = parent.ele('sequence');
    
    seq.ele('name').txt(sequence.name);
    seq.ele('duration').txt(sequence.duration.toString());
    
    // レート
    const rate = seq.ele('rate');
    rate.ele('timebase').txt(sequence.rate.timebase.toString());
    rate.ele('ntsc').txt(sequence.rate.ntsc.toString());
    
    // メディア
    const media = seq.ele('media');
    
    // ビデオ
    if (sequence.media.video) {
      this.addVideoToXML(media, sequence.media.video);
    }
    
    // オーディオ
    if (sequence.media.audio) {
      this.addAudioToXML(media, sequence.media.audio);
    }
    
    // タイムコード
    const timecode = seq.ele('timecode');
    const tcRate = timecode.ele('rate');
    tcRate.ele('timebase').txt(sequence.timecode.rate.timebase.toString());
    tcRate.ele('ntsc').txt(sequence.timecode.rate.ntsc.toString());
    timecode.ele('string').txt(sequence.timecode.string);
    timecode.ele('frame').txt(sequence.timecode.frame.toString());
    timecode.ele('displayformat').txt(sequence.timecode.displayformat);
    
    if (sequence.uuid) {
      seq.ele('uuid').txt(sequence.uuid);
    }
  }
  
  /**
   * ビデオをXMLに追加
   */
  private addVideoToXML(parent: any, video: Sequence['media']['video']): void {
    const v = parent.ele('video');
    
    // フォーマット
    const format = v.ele('format');
    const sc = format.ele('samplecharacteristics');
    sc.ele('width').txt(video.format.samplecharacteristics.width.toString());
    sc.ele('height').txt(video.format.samplecharacteristics.height.toString());
    sc.ele('pixelaspectratio').txt(video.format.samplecharacteristics.pixelaspectratio);
    sc.ele('fielddominance').txt(video.format.samplecharacteristics.fielddominance);
    
    const scRate = sc.ele('rate');
    scRate.ele('timebase').txt(video.format.samplecharacteristics.rate.timebase.toString());
    scRate.ele('ntsc').txt(video.format.samplecharacteristics.rate.ntsc.toString());
    
    if (video.format.samplecharacteristics.codec) {
      const codec = sc.ele('codec');
      codec.ele('name').txt(video.format.samplecharacteristics.codec.name);
    }
    
    // トラック
    for (const track of video.track) {
      const t = v.ele('track');
      
      // クリップアイテム
      for (const clip of track.clipitem) {
        this.addClipItemToXML(t, clip);
      }
      
      t.ele('enabled').txt(track.enabled.toString());
      t.ele('locked').txt(track.locked.toString());
    }
  }
  
  /**
   * オーディオをXMLに追加
   */
  private addAudioToXML(parent: any, audio: Sequence['media']['audio']): void {
    if (!audio) return;
    
    const a = parent.ele('audio');
    
    // フォーマット
    const format = a.ele('format');
    const sc = format.ele('samplecharacteristics');
    sc.ele('samplerate').txt(audio.format.samplecharacteristics.samplerate.toString());
    sc.ele('depth').txt(audio.format.samplecharacteristics.depth.toString());
    
    // トラック
    for (const track of audio.track) {
      const t = a.ele('track');
      
      // クリップアイテム
      for (const clip of track.clipitem) {
        this.addClipItemToXML(t, clip);
      }
      
      t.ele('enabled').txt(track.enabled.toString());
      t.ele('locked').txt(track.locked.toString());
    }
  }
  
  /**
   * クリップアイテムをXMLに追加
   */
  private addClipItemToXML(parent: any, clip: ClipItem): void {
    const c = parent.ele('clipitem');
    
    c.ele('id').txt(clip.id);
    c.ele('name').txt(clip.name);
    c.ele('duration').txt(clip.duration.toString());
    
    const rate = c.ele('rate');
    rate.ele('timebase').txt(clip.rate.timebase.toString());
    rate.ele('ntsc').txt(clip.rate.ntsc.toString());
    
    c.ele('start').txt(clip.start.toString());
    c.ele('end').txt(clip.end.toString());
    c.ele('in').txt(clip.in.toString());
    c.ele('out').txt(clip.out.toString());
    
    // ファイル情報
    if (clip.file) {
      const file = c.ele('file');
      file.att('id', clip.file.id);
      
      file.ele('name').txt(clip.file.name);
      file.ele('pathurl').txt(clip.file.pathurl);
      
      const fileRate = file.ele('rate');
      fileRate.ele('timebase').txt(clip.file.rate.timebase.toString());
      fileRate.ele('ntsc').txt(clip.file.rate.ntsc.toString());
      
      file.ele('duration').txt(clip.file.duration.toString());
    }
    
    // ログ情報
    if (clip.logginginfo) {
      const log = c.ele('logginginfo');
      if (clip.logginginfo.description) {
        log.ele('description').txt(clip.logginginfo.description);
      }
      if (clip.logginginfo.scene) {
        log.ele('scene').txt(clip.logginginfo.scene);
      }
      if (clip.logginginfo.shottake) {
        log.ele('shottake').txt(clip.logginginfo.shottake);
      }
      if (clip.logginginfo.lognote) {
        log.ele('lognote').txt(clip.logginginfo.lognote);
      }
      if (clip.logginginfo.good !== undefined) {
        log.ele('good').txt(clip.logginginfo.good.toString());
      }
    }
    
    // ラベル
    if (clip.labels) {
      const labels = c.ele('labels');
      if (clip.labels.label) {
        labels.ele('label').txt(clip.labels.label);
      }
    }
  }
  
  /**
   * UUIDを生成
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}