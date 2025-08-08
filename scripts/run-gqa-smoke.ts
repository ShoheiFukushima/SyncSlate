/**
 * scripts/run-gqa-smoke.ts
 *
 * Smoke test for PatternQueryEngine (PoC)
 * - Run generatePatterns once (compute)
 * - Run generatePatterns a second time (should hit cache)
 * - Write `gqa-smoke-results.json` with timings and basic diagnostics
 *
 * Usage:
 *   npx tsx scripts/run-gqa-smoke.ts
 */

import fs from 'fs/promises';
import path from 'path';
import PatternQueryEngine from '../src/core/gqa/PatternQueryEngine';
import FeatureStore from '../src/core/gqa/FeatureStore';

async function safeRead(filePath: string) {
  try {
    return String(await fs.readFile(filePath, 'utf8'));
  } catch {
    return '';
  }
}

async function main() {
  const audioPath = 'tests/fixtures/media/sample_audio_60.wav';
  const lyricsPath = 'tests/fixtures/media/sample_lyrics_60.txt';
  const lyrics = (await safeRead(lyricsPath)).slice(0, 2000);

  const store = new FeatureStore({ maxEntries: 50, ttlSeconds: 3600 });
  const engine = new PatternQueryEngine({ store });

  const cacheKey = 'smoke-sample-1';

  const input = {
    audio: audioPath,
    lyrics,
    cacheKey,
  };

  console.log('=== GQA smoke: first run (expected compute) ===');
  const t0 = Date.now();
  const out1 = await engine.generatePatterns(input);
  const t1 = Date.now();
  const dur1 = t1 - t0;
  console.log('first run duration (ms):', dur1);
  console.log('patterns:', Object.keys(out1.patterns).join(', '));
  console.log('ops counts:', {
    dynamic: out1.patterns.dynamic.operations?.length ?? 0,
    narrative: out1.patterns.narrative.operations?.length ?? 0,
    hybrid: out1.patterns.hybrid.operations?.length ?? 0,
  });

  console.log('\n=== GQA smoke: second run (expected cache hit) ===');
  const t2 = Date.now();
  const out2 = await engine.generatePatterns(input);
  const t3 = Date.now();
  const dur2 = t3 - t2;
  console.log('second run duration (ms):', dur2);

  const hasCache = store.has(out1.meta.cacheKey);
  console.log('cacheKey:', out1.meta.cacheKey, 'store.has(cacheKey):', hasCache);

  const result = {
    cacheKey: out1.meta.cacheKey,
    duration1: dur1,
    duration2: dur2,
    cacheHit: Boolean(hasCache),
    opsCounts1: {
      dynamic: out1.patterns.dynamic.operations?.length ?? 0,
      narrative: out1.patterns.narrative.operations?.length ?? 0,
      hybrid: out1.patterns.hybrid.operations?.length ?? 0,
    },
    opsCounts2: {
      dynamic: out2.patterns.dynamic.operations?.length ?? 0,
      narrative: out2.patterns.narrative.operations?.length ?? 0,
      hybrid: out2.patterns.hybrid.operations?.length ?? 0,
    },
    meta1: out1.meta,
    meta2: out2.meta,
  };

  await fs.writeFile('gqa-smoke-results.json', JSON.stringify(result, null, 2), 'utf8');
  console.log('\nWrote gqa-smoke-results.json');
  if (dur2 < dur1) {
    console.log('✅ Second run was faster than first (cache likely used).');
  } else {
    console.warn('⚠️ Second run was not faster; verify FeatureStore/keys.');
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error in smoke script:', err);
  process.exit(1);
});