/**
 * src/core/gqa/queries/HybridQuery.ts
 * Prototype HybridQuery class - blends dynamic_cut and narrative_flow strategies.
 */

import { SharedFeatures, EditPattern } from '../types';

export class HybridQuery {
  public readonly name: EditPattern['name'] = 'hybrid_balance';

  constructor(private options?: { dynamicRatio?: number; aggressive?: boolean }) {}

  generate(shared: SharedFeatures): EditPattern {
    const shotBoundaries = shared.video?.shotBoundaries ?? [0, 3, 15, 30, 50];
    const beats = Array.from(shared.music?.beats ?? new Float32Array([0]));
    const phrases = shared.lyrics?.phrases ?? [];
    const dynamicRatio = this.options?.dynamicRatio ?? 0.5;

    const operations: any[] = [];

    // hybrid strategy:
    // - for the first part (hook) be more dynamic (higher cut density)
    // - for middle keep narrative continuity
    // - for climax favor dynamic again
    const n = shotBoundaries.length - 1;
    for (let i = 0; i < n; i++) {
      const start = shotBoundaries[i];
      const end = shotBoundaries[i + 1];
      const mid = (start + end) / 2;

      // decide mode based on position
      const t = mid / (shared.metadata?.duration ?? 60);
      let mode: 'dynamic' | 'narrative' = 'narrative';
      if (t < 0.15 || t > 0.5) {
        // hook or climax -> dynamic leaning
        mode = Math.random() < dynamicRatio ? 'dynamic' : 'narrative';
      } else {
        mode = Math.random() < (1 - dynamicRatio) ? 'narrative' : 'dynamic';
      }

      if (mode === 'dynamic') {
        const nearestBeat = beats.reduce(
          (prev, curr) => (Math.abs(curr - start) < Math.abs(prev - start) ? curr : prev),
          beats[0]
        );
        operations.push({
          type: 'cut',
          start,
          end,
          alignToBeat: nearestBeat,
          weight: this.options?.aggressive ? 1.0 : 0.7,
          mode: 'dynamic',
          rationale: 'hybrid - dynamic choice for impact',
        });
      } else {
        // narrative: possibly merge with neighbors
        const semanticScore = Math.min(1, Math.random() + (phrases.length > 0 ? 0.1 : 0));
        operations.push({
          type: 'cut',
          start,
          end,
          semanticScore: Number(semanticScore.toFixed(2)),
          mode: 'narrative',
          rationale: 'hybrid - narrative choice for continuity',
        });
      }
    }

    const pattern: EditPattern = {
      name: 'hybrid_balance',
      description: 'Balanced pattern blending short beat-aligned cuts and longer narrative segments.',
      operations,
    };
    return pattern;
  }
}