/**
 * XML入出力の型定義
 */

import type { EditDecision } from '@autoedittate/matching';

// Premiere Pro XML構造
export interface PremiereXML {
  xmeml: {
    $: {
      version: string;
    };
    sequence: Sequence;
    bin?: Bin;
  };
}

// シーケンス
export interface Sequence {
  name: string;
  duration: number;
  rate: {
    timebase: number;
    ntsc: boolean;
  };
  media: {
    video: VideoTrack;
    audio?: AudioTrack;
  };
  timecode: {
    rate: {
      timebase: number;
      ntsc: boolean;
    };
    string: string;
    frame: number;
    displayformat: string;
  };
  uuid?: string;
}

// ビデオトラック
export interface VideoTrack {
  format: {
    samplecharacteristics: {
      width: number;
      height: number;
      pixelaspectratio: string;
      fielddominance: string;
      rate: {
        timebase: number;
        ntsc: boolean;
      };
      codec?: {
        name: string;
      };
    };
  };
  track: Array<{
    clipitem: ClipItem[];
    enabled: boolean;
    locked: boolean;
  }>;
}

// オーディオトラック
export interface AudioTrack {
  format: {
    samplecharacteristics: {
      samplerate: number;
      depth: number;
    };
  };
  track: Array<{
    clipitem: ClipItem[];
    enabled: boolean;
    locked: boolean;
  }>;
}

// クリップアイテム
export interface ClipItem {
  id: string;
  name: string;
  duration: number;
  rate: {
    timebase: number;
    ntsc: boolean;
  };
  start: number;
  end: number;
  in: number;
  out: number;
  file?: {
    id: string;
    name: string;
    pathurl: string;
    rate: {
      timebase: number;
      ntsc: boolean;
    };
    duration: number;
    timecode?: {
      rate: {
        timebase: number;
        ntsc: boolean;
      };
      string: string;
      frame: number;
      displayformat: string;
    };
    media?: {
      video?: {
        duration: number;
        samplecharacteristics: {
          width: number;
          height: number;
          pixelaspectratio: string;
        };
      };
      audio?: {
        samplecharacteristics: {
          samplerate: number;
          depth: number;
        };
      };
    };
  };
  filter?: Array<{
    effect: {
      name: string;
      effectid: string;
      effecttype: string;
      mediatype: string;
      parameter?: Array<{
        parameterid: string;
        name: string;
        value: any;
      }>;
    };
  }>;
  logginginfo?: {
    description?: string;
    scene?: string;
    shottake?: string;
    lognote?: string;
    good?: boolean;
  };
  colorinfo?: {
    lut?: string;
    lut1?: string;
    asc_sop?: string;
    asc_sat?: number;
    asc_cdl?: string;
  };
  labels?: {
    label?: string;
    label2?: string;
  };
}

// ビン（素材管理）
export interface Bin {
  name: string;
  children?: Array<{
    clip?: MediaClip;
    bin?: Bin;
  }>;
}

// メディアクリップ
export interface MediaClip {
  id: string;
  name: string;
  duration: number;
  rate: {
    timebase: number;
    ntsc: boolean;
  };
  media: {
    video?: {
      duration: number;
      samplecharacteristics: {
        width: number;
        height: number;
        pixelaspectratio: string;
      };
    };
    audio?: {
      samplecharacteristics: {
        samplerate: number;
        depth: number;
      };
    };
  };
  logginginfo?: {
    description?: string;
    scene?: string;
    shottake?: string;
    lognote?: string;
  };
}

// 素材パス解決結果
export interface MaterialPath {
  originalPath: string;
  resolvedPath: string;
  exists: boolean;
  type: 'video' | 'audio' | 'image';
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    codec?: string;
  };
}

// キューポイント
export interface CuePoint {
  time: number;
  name: string;
  type: 'in' | 'out' | 'marker';
  comment?: string;
  color?: string;
}

// XMLパース結果
export interface XMLParseResult {
  sequence: Sequence;
  clips: MediaClip[];
  materials: MaterialPath[];
  cuePoints: CuePoint[];
  metadata: {
    projectName?: string;
    creator?: string;
    createdDate?: string;
    modifiedDate?: string;
    frameRate: number;
    resolution: {
      width: number;
      height: number;
    };
  };
}

// XML生成オプション
export interface XMLGenerateOptions {
  projectName: string;
  frameRate?: number;
  resolution?: {
    width: number;
    height: number;
  };
  includeAudio?: boolean;
  includeEffects?: boolean;
  includeMarkers?: boolean;
  includeColorCorrection?: boolean;
  outputFormat?: 'premiere' | 'resolve' | 'fcpx';
}

// 編集リスト（EDL）形式
export interface EDLEntry {
  eventNumber: number;
  sourceReel: string;
  trackType: 'V' | 'A' | 'AA' | 'B';
  editType: 'C' | 'D' | 'W' | 'K'; // Cut, Dissolve, Wipe, Key
  sourceIn: string;
  sourceOut: string;
  recordIn: string;
  recordOut: string;
  comment?: string;
}

// XMLからEDLへの変換結果
export interface EDLConversionResult {
  title: string;
  entries: EDLEntry[];
  frameRate: number;
  dropFrame: boolean;
}