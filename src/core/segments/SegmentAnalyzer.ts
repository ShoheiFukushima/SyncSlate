/**
 * src/core/segments/SegmentAnalyzer.ts
 * SegmentAnalyzer PoC for AutoEditTATE
 *
 * Responsibilities:
 * - detect music structure (mock)
 * - provide canonical segment time ranges (hook/development/main/climax/outro)
 * - identify target segments from natural language feedback
 * - extract segment features (mock)
 */

export type TimeRange = [number, number];

export type SegmentName = 'hook' | 'development' | 'main' | 'climax' | 'outro';

export interface SegmentFeatures {
  avgShotLength: number;
  cutDensity: number;
  faceRatio: number;
  motionIntensity: number;
}

export interface SegmentScore {
  segment_id: SegmentName;
  time_range: TimeRange;
  scores: {
    sync: number;
    visual: number;
    semantic: number;
    stability: number;
    energy?: number;
  };
  confidence: number;
}

export class SegmentAnalyzer {
  constructor(private duration = 60) {}

  getCanonicalSegments(): Record<SegmentName, TimeRange> {
    return {
      hook: [0, 3],
      development: [3, 10],
      main: [10, 30],
      climax: [30, 50],
      outro: [50, 60],
    };
  }

  // Mock music structure detection
  async detectMusicStructure(_audio?: string | Buffer) {
    return {
      detected_structure: {
        intro: [0, 3],
        verse1: [3, 15],
        pre_chorus: [15, 23],
        chorus1: [23, 38],
        bridge: [38, 46],
        chorus2: [46, 58],
        outro: [58, 60],
      },
      beats: new Float32Array([0, 0.5, 1.0, 1.5, 2.0]),
    };
  }

  extractSegmentFeatures(segment: TimeRange, _video?: string | Buffer): SegmentFeatures {
    // Note: segment is required and comes first to satisfy TypeScript parameter ordering rules.
    const duration = segment[1] - segment[0];
    const avgShotLength = Math.max(0.5, Math.min(4, duration / Math.max(1, Math.round(duration / 2))));
    const cutDensity = Number((1 / Math.max(avgShotLength, 0.1)).toFixed(2));
    const faceRatio = Number(Math.min(1, 0.2 + Math.random() * 0.8).toFixed(2));
    const motionIntensity = Number(Math.min(1, 0.1 + Math.random() * 0.9).toFixed(2));

    return {
      avgShotLength,
      cutDensity,
      faceRatio,
      motionIntensity,
    };
  }

  identifyTargetSegments(feedback: string): SegmentName[] {
    const text = (feedback || '').toLowerCase();
    const segmentKeywords: Record<SegmentName, string[]> = {
      hook: ['出だし', '最初', '開始', 'つかみ', '3秒', 'hook'],
      development: ['展開', '中盤', 'development'],
      main: ['中盤', '本編', 'main', 'メイン'],
      climax: ['サビ', '盛り上がり', 'クライマックス', '最高', 'climax', 'サビ前'],
      outro: ['終わり', 'ラスト', '締め', 'エンディング', 'outro'],
    };

    const hits = new Set<SegmentName>();
    for (const [seg, kws] of Object.entries(segmentKeywords) as [SegmentName, string[]][]) {
      for (const kw of kws) {
        if (text.includes(kw)) {
          hits.add(seg);
          break;
        }
      }
    }

    if (hits.size === 0) {
      if (text.includes('サビ') || text.includes('最高')) hits.add('climax');
      else hits.add('main');
    }

    return Array.from(hits);
  }

  scoreSegment(features: SegmentFeatures): { sync: number; visual: number; semantic: number; stability: number; energy: number } {
    const sync = Number(Math.max(0, Math.min(1, 0.5 + (Math.random() - 0.5) * 0.2)).toFixed(2));
    const visual = Number(Math.max(0, Math.min(1, features.faceRatio * 0.8 + 0.2)).toFixed(2));
    const semantic = Number(Math.max(0, Math.min(1, 0.4 + features.motionIntensity * 0.6)).toFixed(2));
    const stability = Number(Math.max(0, Math.min(1, 1 - 0.1 * (1 / Math.max(features.cutDensity, 0.1)))).toFixed(2));
    const energy = Number(Math.max(0, Math.min(1, features.motionIntensity)).toFixed(2));
    return { sync, visual, semantic, stability, energy };
  }
}

export default SegmentAnalyzer