/**
 * src/core/gqa/queries/DynamicQuery.ts
 * Prototype DynamicQuery class - returns EditPattern for dynamic_cut
 */

import { SharedFeatures, EditPattern } from '../types';

export class DynamicQuery {
  public readonly name: EditPattern['name'] = 'dynamic_cut';

  constructor(private options?: { aggressive?: boolean; minShotLength?: number }) {}

  generate(shared: SharedFeatures): EditPattern {
    const shotBoundaries = shared.video?.shotBoundaries ?? [0, 3, 15, 30, 50];
    const beats = Array.from(shared.music?.beats ?? new Float32Array([0]));

    // Basic heuristic for dynamic cuts:
    // - prefer shorter shots -> create cuts aligned to shots and beats
    const operations: any[] = [];
    for (let i = 0; i < shotBoundaries.length - 1; i++) {
      const start = shotBoundaries[i];
      const end = shotBoundaries[i + 1];
      // align to nearest beat if available
      const nearestBeat = beats.reduce(
        (prev, curr) => (Math.abs(curr - start) < Math.abs(prev - start) ? curr : prev),
        beats[0]
      );
      const weight = this.options?.aggressive ? 1.0 : 0.6;
      operations.push({
        type: 'cut',
        start,
        end,
        alignToBeat: nearestBeat,
        weight,
        rationale: 'dynamic - shot boundary + beat alignment',
      });
    }

    const pattern: EditPattern = {
      name: 'dynamic_cut',
      description: 'Short, beat-aligned cuts with emphasis on energy and pacing.',
      operations,
    };
    return pattern;
  }
}