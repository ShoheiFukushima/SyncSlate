/**
 * src/core/gqa/types.ts
 * Shared types for GQA implementation (SharedFeatures, EditPattern, helpers)
 */

export type FloatArray = Float32Array;

export type MusicStructure = {
  start: number;
  end: number;
  label?: string;
};

export type SceneChange = {
  time: number;
  confidence: number;
};

export type Histogram = number[]; // simplified color histogram

export interface SharedFeatures {
  music: {
    bpm: number;
    beats: Float32Array;
    structure: MusicStructure[];
    energy: Float32Array;
  };
  video: {
    shotBoundaries: number[];
    sceneChanges: SceneChange[];
    motionVectors: Float32Array[];
    colorHistograms: Histogram[];
  };
  lyrics: {
    phrases: string[];
    emotions: number[]; // per-phrase emotion score
    keywords: string[];
    semanticEmbeddings: Float32Array[];
  };
  metadata: {
    duration: number;
    fps: number;
    resolution: { width: number; height: number };
    timestamp: number;
  };
}

export interface EditPattern {
  name: 'dynamic_cut' | 'narrative_flow' | 'hybrid_balance';
  description?: string;
  operations?: any[];
}