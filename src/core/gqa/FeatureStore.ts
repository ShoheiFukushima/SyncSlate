/**
 * src/core/gqa/FeatureStore.ts
 * Lightweight FeatureStore for SharedFeatures with TTL and size-based eviction.
 * Intended as a PoC: replace with a more sophisticated cache (LRU, disk-backed, etc.) as needed.
 */

import { SharedFeatures } from './types';

type CacheEntry = {
  features: SharedFeatures;
  createdAt: number;
  lastAccess: number;
  sizeBytes?: number;
};

export class FeatureStore {
  private store: Map<string, CacheEntry>;
  private maxEntries: number;
  private ttlMs: number;

  constructor(options?: { maxEntries?: number; ttlSeconds?: number }) {
    this.store = new Map();
    this.maxEntries = options?.maxEntries ?? 200;
    this.ttlMs = (options?.ttlSeconds ?? 60 * 60) * 1000; // default 1 hour
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt > this.ttlMs;
  }

  get(key: string): SharedFeatures | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }
    entry.lastAccess = Date.now();
    // Move to the end to mark as recently used
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.features;
  }

  set(key: string, features: SharedFeatures) {
    const entry: CacheEntry = {
      features,
      createdAt: Date.now(),
      lastAccess: Date.now(),
      sizeBytes: this.estimateFeaturesSize(features),
    };
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, entry);
    this.evictIfNeeded();
  }

  async getOrCompute(key: string, computeFn: () => Promise<SharedFeatures> | SharedFeatures): Promise<SharedFeatures> {
    const existing = this.get(key);
    if (existing) return existing;
    const result = await Promise.resolve(computeFn());
    this.set(key, result);
    return result;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  entries(): IterableIterator<[string, SharedFeatures]> {
    const gen = (function* (store) {
      for (const [k, v] of store) {
        yield [k, v.features] as [string, SharedFeatures];
      }
    })(this.store);
    return gen as any;
  }

  purgeExpired(): number {
    let removed = 0;
    for (const [k, v] of Array.from(this.store.entries())) {
      if (this.isExpired(v)) {
        this.store.delete(k);
        removed++;
      }
    }
    return removed;
  }

  private evictIfNeeded(): void {
    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (!oldestKey) break;
      this.store.delete(oldestKey);
    }
  }

  estimateMemoryUsage(): { entries: number; approximateBytes: number } {
    let total = 0;
    for (const [, v] of this.store) {
      total += v.sizeBytes ?? 0;
    }
    return { entries: this.store.size, approximateBytes: total };
  }

  private estimateFeaturesSize(features: SharedFeatures): number {
    // Rudimentary size estimation for in-memory accounting (PoC)
    let size = 0;
    try {
      // Count arrays and objects roughly
      if (features.music) {
        size += (features.music.beats?.length ?? 0) * 4;
        size += (features.music.energy?.length ?? 0) * 4;
        size += (features.music.structure?.length ?? 0) * 16;
      }
      if (features.video) {
        size += (features.video.shotBoundaries?.length ?? 0) * 8;
        size += (features.video.motionVectors?.length ?? 0) * 16;
      }
      if (features.lyrics) {
        size += (features.lyrics.phrases?.length ?? 0) * 32;
        size += (features.lyrics.semanticEmbeddings?.length ?? 0) * 16;
      }
      // metadata cost
      size += 128;
    } catch {
      size += 256;
    }
    return size;
  }
}

export default FeatureStore;