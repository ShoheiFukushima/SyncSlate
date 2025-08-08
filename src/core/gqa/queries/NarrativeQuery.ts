/**
 * src/core/gqa/queries/NarrativeQuery.ts
 * Prototype NarrativeQuery class - returns EditPattern for narrative_flow
 */

import { SharedFeatures, EditPattern } from '../types';

export class NarrativeQuery {
  public readonly name: EditPattern['name'] = 'narrative_flow';

  constructor(private options?: { preferFaces?: boolean; minShotLength?: number }) {}

  generate(shared: SharedFeatures): EditPattern {
    const shotBoundaries = shared.video?.shotBoundaries ?? [0, 3, 15, 30, 50];
    const phrases = shared.lyrics?.phrases ?? [];
    const keywords = shared.lyrics?.keywords ?? [];
    const operations: any[] = [];

    // strategy: merge shots into longer narrative segments. For each segment pick a representative shot.
    let i = 0;
    const minLen = this.options?.minShotLength ?? 2; // seconds

    while (i < shotBoundaries.length - 1) {
      let start = shotBoundaries[i];
      let end = shotBoundaries[i + 1];

      // if too short, merge with next
      if (end - start < minLen && i + 2 < shotBoundaries.length) {
        end = shotBoundaries[i + 2];
        i += 2;
      } else {
        i += 1;
      }

      // compute a simple semantic alignment score (PoC)
      const semanticScore = Math.min(1, Math.random() + (keywords.length > 0 ? 0.2 : 0));
      const preferred = this.options?.preferFaces ? 'face' : 'composition';

      operations.push({
        type: 'cut',
        start,
        end,
        emphasis: 'story',
        semanticScore: Number(semanticScore.toFixed(2)),
        rationale: `narrative - merged shot for continuity (preferred:${preferred})`,
      });
    }

    const pattern: EditPattern = {
      name: 'narrative_flow',
      description: 'Longer shots prioritized to keep story continuity; semantic/lyric alignment considered.',
      operations,
    };

    return pattern;
  }
}