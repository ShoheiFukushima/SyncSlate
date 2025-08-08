/**
 * packages/obs/src/explainSink.ts
 *
 * Lightweight explain.json sink (PoC).
 * - saves explain objects to ./obs/explain/<timestamp>-<seed>.json
 * - notifies local structured logger (packages/obs/src/logger.ts)
 *
 * Usage:
 *   import { storeExplain } from '../../obs/src/explainSink';
 *   await storeExplain(explainObj, { source: 'qa-runner', path: 'qa-results/explain.json' });
 */

import fs from 'fs/promises';
import path from 'path';
import logger from './logger';

export type StoreOptions = {
  source?: string;
  path?: string; // optional original path (e.g., qa-results/explain.json)
  outDir?: string; // optional override, defaults to ./obs/explain
};

export async function storeExplain(explain: any, opts?: StoreOptions): Promise<string> {
  const outDir = opts?.outDir ?? path.join(process.cwd(), 'obs', 'explain');
  await fs.mkdir(outDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const seed = explain?.project_seed ?? Math.floor(Math.random() * 1e9);
  const baseName = opts?.path ? path.basename(opts.path) : `explain-${ts}-${seed}.json`;
  const dest = path.join(outDir, `${ts}-${seed}-${baseName}`);

  try {
    await fs.writeFile(dest, JSON.stringify(explain, null, 2), 'utf8');
    logger.info('explain.saved', { dest, source: opts?.source ?? 'unknown', seed });
    return dest;
  } catch (err) {
    logger.error('explain.save_failed', { error: String(err), target: dest });
    throw err;
  }
}

export default { storeExplain };