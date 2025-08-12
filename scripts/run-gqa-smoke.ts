/**
 * scripts/run-gqa-smoke.ts
 *
 * Enhanced smoke test for PatternQueryEngine (PoC)
 * - Run generatePatterns multiple times (measure each run with high-resolution timer)
 * - Emit per-run cache presence and store metrics (size / memory estimate)
 * - Compute median/mean and write `gqa-smoke-results.json` with diagnostics
 *
 * Usage:
 *   SMOKE_RUNS=5 npx tsx scripts/run-gqa-smoke.ts
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
 
function median(arr: number[]) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
 
function mean(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
 
async function main() {
  const audioPath = 'tests/fixtures/media/sample_audio_60.wav';
  const lyricsPath = 'tests/fixtures/media/sample_lyrics_60.txt';
  const lyrics = (await safeRead(lyricsPath)).slice(0, 2000);
 
  const store = new FeatureStore({ maxEntries: 50, ttlSeconds: 3600 });
  const engine = new PatternQueryEngine({ store });
 
  const cacheKey = 'smoke-sample-1';
  const runs = Number(process.env.SMOKE_RUNS ?? 5);
 
  const input = {
    audio: audioPath,
    lyrics,
    cacheKey,
  };
 
  console.log(`=== GQA smoke: performing ${runs} runs (HR timer) ===`);
  const runDetails: Array<{
    run: number;
    durationMs: number;
    hasBefore: boolean;
    hasAfter: boolean;
    storeSize: number;
    storeApproxBytes: number;
    cacheKeyUsed: string | null;
  }> = [];
 
  let firstOut: any = null;
  for (let i = 0; i < runs; i++) {
    const hasBefore = store.has(input.cacheKey);
    const t0 = process.hrtime.bigint();
    const out = await engine.generatePatterns(input);
    const t1 = process.hrtime.bigint();
    const durationMs = Number(t1 - t0) / 1e6;
    const hasAfter = store.has(out.meta.cacheKey);
    const mem = store.estimateMemoryUsage ? store.estimateMemoryUsage() : { entries: store.size ? store.size() : 0, approximateBytes: 0 };
    const size = store.size ? store.size() : 0;
 
    if (i === 0) firstOut = out;
 
    runDetails.push({
      run: i + 1,
      durationMs,
      hasBefore: Boolean(hasBefore),
      hasAfter: Boolean(hasAfter),
      storeSize: size,
      storeApproxBytes: mem.approximateBytes ?? 0,
      cacheKeyUsed: out?.meta?.cacheKey ?? null,
    });
 
    console.log(`[run ${i + 1}/${runs}] duration(ms): ${durationMs.toFixed(3)} hasBefore:${hasBefore} hasAfter:${hasAfter} storeSize:${size} approxBytes:${mem.approximateBytes ?? 0}`);
  }
 
  // Summarize
  const durations = runDetails.map(r => r.durationMs);
  const firstDuration = durations[0] ?? 0;
  const laterDurations = durations.slice(1);
  const medianLater = median(laterDurations);
  const meanLater = mean(laterDurations);
  const cacheHitsBefore = runDetails.filter(r => r.hasBefore).length;
  const cacheHitsAfter = runDetails.filter(r => r.hasAfter).length;
 
  console.log('\n=== Summary ===');
  console.log('cacheKey (first run):', firstOut?.meta?.cacheKey ?? null);
  console.log('durations(ms):', durations.map(d => d.toFixed(3)).join(', '));
  console.log('firstDuration(ms):', firstDuration.toFixed(3));
  console.log('medianLater(ms):', (medianLater || 0).toFixed(3));
  console.log('meanLater(ms):', (meanLater || 0).toFixed(3));
  console.log('cacheHitsBefore (count):', cacheHitsBefore, `/${runs}`);
  console.log('cacheHitsAfter (count):', cacheHitsAfter, `/${runs}`);
  console.log('store.entries:', store.size ? store.size() : 'n/a', 'estimateMemory:', store.estimateMemoryUsage ? JSON.stringify(store.estimateMemoryUsage()) : 'n/a');
 
  const result = {
    cacheKey: firstOut?.meta?.cacheKey ?? null,
    runs,
    runDetails,
    durations,
    firstDuration,
    medianLater,
    meanLater,
    cacheHitsBefore,
    cacheHitsAfter,
    storeInfo: store.estimateMemoryUsage ? store.estimateMemoryUsage() : { entries: store.size ? store.size() : 0, approximateBytes: 0 },
  };
 
  await fs.writeFile('gqa-smoke-results.json', JSON.stringify(result, null, 2), 'utf8');
  console.log('\nWrote gqa-smoke-results.json');
 
  if (laterDurations.length > 0 && medianLater < firstDuration) {
    console.log('✅ Median of subsequent runs is faster than first run (cache effective).');
  } else if (laterDurations.length > 0 && medianLater === 0) {
    console.warn('⚠️ Subsequent runs durations are zero — check timer resolution.');
  } else {
    console.warn('⚠️ Subsequent runs median not faster than first — consider investigating cache/key/measurement noise.');
  }
 
  console.log('Done.');
}
 
main().catch((err) => {
  console.error('Fatal error in smoke script:', err);
  process.exit(1);
});