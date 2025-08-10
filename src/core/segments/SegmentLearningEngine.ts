/**
 * src/core/segments/SegmentLearningEngine.ts
 * PoC SegmentLearningEngine
 *
 * Usage:
 *   npx tsx src/core/segments/SegmentLearningEngine.ts "サビの盛り上がりが最高" dynamic_cut
 */

import fs from 'fs';
import path from 'path';
import SegmentAnalyzer, { SegmentName, SegmentFeatures } from './SegmentAnalyzer.ts';

type SegmentProfile = {
  sync: number;
  visual: number;
  energy: number;
  cutDensity: number;
  first_frame_impact?: number;
  confidence: number;
  preferred_shots?: string[];
  avg_shot_length?: number;
};

type UserProfile = {
  userId?: string;
  platform?: string;
  segments: Record<SegmentName, SegmentProfile>;
  lastUpdate?: string;
};

export class SegmentLearningEngine {
  private analyzer: SegmentAnalyzer;
  constructor(analyzer?: SegmentAnalyzer) {
    this.analyzer = analyzer ?? new SegmentAnalyzer();
  }

  getDefaultProfile(): UserProfile {
    const baseline: SegmentProfile = {
      sync: 0.5,
      visual: 0.5,
      energy: 0.5,
      cutDensity: 1.0,
      first_frame_impact: 0.5,
      confidence: 0.7,
      preferred_shots: [],
      avg_shot_length: 1.5,
    };

    return {
      userId: 'demo_user',
      platform: 'tiktok',
      segments: {
        hook: { ...baseline },
        development: { ...baseline },
        main: { ...baseline },
        climax: { ...baseline },
        outro: { ...baseline },
      },
      lastUpdate: new Date().toISOString(),
    };
  }

  // Calculate heuristic adjustments from feedback for a target segment
  calculateAdjustment(feedback: string, segment: SegmentName): Partial<SegmentProfile> {
    const txt = (feedback || '').toLowerCase();
    const adj: Partial<SegmentProfile> = {};

    // Common heuristics based on docs examples
    if (segment === 'climax') {
      // "サビ" feedback
      adj.sync = 0.15;
      adj.energy = 0.20;
      adj.cutDensity = 0.10;
    } else if (segment === 'hook') {
      // "出だし" feedback
      adj.energy = 0.25;
      adj.first_frame_impact = 0.30;
      adj.cutDensity = 0.20;
    } else if (segment === 'development') {
      adj.energy = 0.15;
      adj.cutDensity = 0.10;
    } else if (segment === 'main') {
      adj.energy = 0.05;
      adj.sync = 0.05;
    } else if (segment === 'outro') {
      adj.energy = 0.05;
      adj.cutDensity = -0.05;
    }

    // Keyword-driven boosts
    if (txt.includes('サビ') || txt.includes('盛り上がり') || txt.includes('最高')) {
      if (!adj.sync) adj.sync = 0.1;
      if (!adj.energy) adj.energy = 0.1;
    }
    if (txt.includes('出だし') || txt.includes('つかみ')) {
      if (!adj.first_frame_impact) adj.first_frame_impact = 0.15;
    }
    if (txt.includes('ダレ') || txt.includes('弱い')) {
      if (!adj.energy) adj.energy = 0.1;
    }

    // fallback small nudges if nothing matched
    if (Object.keys(adj).length === 0) {
      adj.energy = 0.05;
    }

    return adj;
  }

  getLearningRate(confidence: number): number {
    if (confidence < 0.5) return 0.2;
    if (confidence < 0.8) return 0.1;
    return 0.05;
  }

  applyUpdate(profile: SegmentProfile, adjustment: Partial<SegmentProfile>, learningRate: number): SegmentProfile {
    const updated: SegmentProfile = { ...profile };
    for (const k of Object.keys(adjustment) as (keyof SegmentProfile)[]) {
      // Safely coerce adjustment and existing value to numbers before arithmetic
      const rawDelta = adjustment[k];
      const delta: number = typeof rawDelta === 'number' ? rawDelta : 0;
      const rawOld = updated[k] as unknown;
      const old: number = typeof rawOld === 'number' ? rawOld : 0;

      const next = old + delta * learningRate;
      // clamp to [0,1] with 3 decimal precision
      const clamped = Math.max(0, Math.min(1, Number(next.toFixed(3))));
      (updated[k] as number) = clamped;
    }
    // increase confidence slightly
    updated.confidence = Math.max(
      0,
      Math.min(1, Number((updated.confidence + 0.01 * learningRate).toFixed(3)))
    );
    return updated;
  }

  updateSegmentPreferences(feedback: string, selectedPattern: string, currentProfile?: UserProfile): UserProfile {
    const profile = currentProfile ? JSON.parse(JSON.stringify(currentProfile)) : this.getDefaultProfile();
    const targetSegments = this.analyzer.identifyTargetSegments(feedback);

    for (const seg of targetSegments) {
      const adj = this.calculateAdjustment(feedback, seg);
      const currentSegProfile = profile.segments[seg];
      const lr = this.getLearningRate(currentSegProfile.confidence);
      const updatedSeg = this.applyUpdate(currentSegProfile, adj, lr);
      profile.segments[seg] = updatedSeg;
    }

    profile.lastUpdate = new Date().toISOString();
    return profile;
  }
}

// CLI support (ESM-friendly)
// Run directly via: npx tsx src/core/segments/SegmentLearningEngine.ts "フィードバック" pattern [profile.json]
if (process.argv.length > 1 && process.argv[1].endsWith('SegmentLearningEngine.ts')) {
  (async () => {
    const argv = process.argv.slice(2);
    const feedback = argv[0] ?? 'サビの盛り上がりが最高';
    const pattern = argv[1] ?? 'dynamic_cut';
    const profilePath = argv[2]; // optional path to existing profile JSON

    let profile: UserProfile | undefined = undefined;
    if (profilePath) {
      try {
        const raw = fs.readFileSync(path.resolve(process.cwd(), profilePath), 'utf8');
        profile = JSON.parse(raw);
      } catch (e) {
        console.warn('プロファイル読み込み失敗、デフォルトプロファイルを使用します:', String(e));
      }
    }

    const engine = new SegmentLearningEngine();
    const updated = engine.updateSegmentPreferences(feedback, pattern, profile);
    const out = JSON.stringify(updated, null, 2);
    console.log(out);
    process.exit(0);
  })();
}