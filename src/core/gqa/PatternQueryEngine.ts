/**
 * src/core/gqa/PatternQueryEngine.ts
 * Orchestrates SharedFeatureExtractor + FeatureStore + Query engines
 * Provides generatePatterns(input) => { dynamic, narrative, hybrid, shared }
 */

import { SharedFeatures, EditPattern } from './types';
import { SharedFeatureExtractor } from './SharedFeatureExtractor';
import FeatureStore from './FeatureStore';
import { DynamicQuery } from './queries/DynamicQuery';
import { NarrativeQuery } from './queries/NarrativeQuery';
import { HybridQuery } from './queries/HybridQuery';

export interface PatternQueryEngineOptions {
  extractor?: SharedFeatureExtractor;
  store?: FeatureStore;
  dynamicOptions?: ConstructorParameters<typeof DynamicQuery>[0];
  narrativeOptions?: ConstructorParameters<typeof NarrativeQuery>[0];
  hybridOptions?: ConstructorParameters<typeof HybridQuery>[0];
  storeOptions?: ConstructorParameters<typeof FeatureStore>[0];
}

export class PatternQueryEngine {
  private extractor: SharedFeatureExtractor;
  private store: FeatureStore;
  private dynamicQuery: DynamicQuery;
  private narrativeQuery: NarrativeQuery;
  private hybridQuery: HybridQuery;

  constructor(options?: PatternQueryEngineOptions) {
    this.extractor = options?.extractor ?? new SharedFeatureExtractor();
    this.store = options?.store ?? new FeatureStore(options?.storeOptions);
    this.dynamicQuery = new DynamicQuery(options?.dynamicOptions);
    this.narrativeQuery = new NarrativeQuery(options?.narrativeOptions);
    this.hybridQuery = new HybridQuery(options?.hybridOptions);
  }

  private computeCacheKey(input: { audio?: string | Buffer; video?: string | Buffer; lyrics?: string }) {
    const parts: string[] = [];
    if (input.audio && typeof input.audio === 'string') parts.push(`audio:${input.audio}`);
    else if (input.audio && Buffer.isBuffer(input.audio)) parts.push(`audio:buffer-${input.audio.length}`);
    if (input.video && typeof input.video === 'string') parts.push(`video:${input.video}`);
    if (input.lyrics) parts.push(`lyrics:${input.lyrics.slice(0, 80)}`);
    return parts.length ? parts.join('|') : 'shared:default';
  }

  async generatePatterns(input: { audio?: string | Buffer; video?: string | Buffer; lyrics?: string; cacheKey?: string }) {
    const key = input.cacheKey ?? this.computeCacheKey(input);

    const shared = await this.store.getOrCompute(key, async () => {
      // run extractors in parallel
      const [music, video, lyrics] = await Promise.all([
        this.extractor.analyzeMusic(input.audio ?? ''),
        this.extractor.analyzeVideo(input.video ?? ''),
        this.extractor.analyzeLyrics(input.lyrics ?? ''),
      ]);

      const metadata = {
        duration: 60,
        fps: 30,
        resolution: { width: 1080, height: 1920 },
        timestamp: Date.now(),
      };

      const sharedFeatures: SharedFeatures = {
        music,
        video,
        lyrics,
        metadata,
      };

      return sharedFeatures;
    });

    // generate three patterns
    const dynamic = this.dynamicQuery.generate(shared);
    const narrative = this.narrativeQuery.generate(shared);
    const hybrid = this.hybridQuery.generate(shared);

    return {
      shared,
      patterns: {
        dynamic,
        narrative,
        hybrid,
      },
      meta: {
        cacheKey: key,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

export default PatternQueryEngine;