/**
 * tests/unit/gqa/pattern_engine.spec.ts
 * Simple smoke test executable by `npx tsx` to assert GQA patterns generation and cache
 */

import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const lyrics = await fs.readFile('tests/fixtures/media/sample_lyrics_60.txt','utf8');

  // Dynamic import to ensure resolution from project root regardless of test runner resolution semantics
  const PatternQueryEngine = (await import(path.resolve(process.cwd(), 'src/core/gqa/PatternQueryEngine'))).default;
  const FeatureStore = (await import(path.resolve(process.cwd(), 'src/core/gqa/FeatureStore'))).default;

  const store = new FeatureStore({ maxEntries: 50, ttlSeconds: 3600 });
  const engine = new PatternQueryEngine({ store });
  const input = { audio: 'tests/fixtures/media/sample_audio_60.wav', lyrics, cacheKey: 'unit-smoke-1' };

  console.log('Running PatternQueryEngine unit smoke...');
  const t0 = Date.now();
  const out1 = await engine.generatePatterns(input);
  const t1 = Date.now();
  const dur1 = t1 - t0;

  // Basic assertions
  assert(out1 && out1.patterns, 'patterns missing from output');
  assert(out1.patterns.dynamic, 'dynamic pattern missing');
  assert(out1.patterns.narrative, 'narrative pattern missing');
  assert(out1.patterns.hybrid, 'hybrid pattern missing');
  const dynOps = out1.patterns.dynamic.operations?.length ?? 0;
  const narOps = out1.patterns.narrative.operations?.length ?? 0;
  const hybOps = out1.patterns.hybrid.operations?.length ?? 0;
  assert(dynOps > 0, 'dynamic operations empty');

  console.log('First run durations(ms):', dur1, 'ops:', { dynOps, narOps, hybOps });

  // Second run (expect cache)
  const t2 = Date.now();
  const out2 = await engine.generatePatterns(input);
  const t3 = Date.now();
  const dur2 = t3 - t2;

  const cacheHit = store.has(out1.meta.cacheKey);
  assert(cacheHit, 'FeatureStore missing expected cache key');

  // Require that second run is not significantly slower than first
  if (dur2 > dur1 + 50) {
    throw new Error(`Second run slower than first (dur1=${dur1}ms, dur2=${dur2}ms)`);
  }

  const result = {
    cacheKey: out1.meta.cacheKey,
    duration1: dur1,
    duration2: dur2,
    cacheHit,
    ops1: { dynamic: dynOps, narrative: narOps, hybrid: hybOps },
    ops2: {
      dynamic: out2.patterns.dynamic.operations?.length ?? 0,
      narrative: out2.patterns.narrative.operations?.length ?? 0,
      hybrid: out2.patterns.hybrid.operations?.length ?? 0,
    },
  };

  await fs.writeFile('gqa-unit-results.json', JSON.stringify(result, null, 2), 'utf8');
  console.log('PatternQueryEngine unit smoke passed. Results written to gqa-unit-results.json');
  process.exit(0);
}

main().catch((err) => {
  console.error('Pattern engine unit smoke failed:', err);
  process.exit(2);
});