/**
 * packages/obs/src/explainSink.ts
 *
 * Lightweight explain.json sink (PoC -> hardened)
 * - saves explain objects to ./obs/explain/<timestamp>-<seed>-<basename>
 * - notifies local structured logger (packages/obs/src/logger.ts)
 *
 * Usage:
 *   import { storeExplain } from '../../obs/src/explainSink';
 *   await storeExplain(explainObj, { source: 'qa-runner', path: 'qa-results/explain.json' });
 */
import fs from 'fs/promises';
import path from 'path';
import logger, { safeStringify, sanitizeObject } from './logger';
 
export type StoreOptions = {
  source?: string;
  path?: string; // optional original path (e.g., qa-results/explain.json)
  outDir?: string; // optional override, defaults to ./obs/explain
  redact?: boolean; // if true, redact sensitive keys when saving (optional, default true)
  correlationId?: string; // optional correlation id to include in saved metadata
};
 
export async function storeExplain(explain: any, opts?: StoreOptions): Promise<string> {
  const outDir = opts?.outDir ?? path.join(process.cwd(), 'obs', 'explain');
  try {
    await fs.mkdir(outDir, { recursive: true });
  } catch (err) {
    logger.warn('explain.mkdir_failed', { error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err), outDir });
    // continue; writeFile below will fail and be handled
  }
 
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const seed = explain?.project_seed ?? Math.floor(Math.random() * 1e9);
  const originalBase = opts?.path ? path.basename(opts.path) : `explain.json`;
  const safeBase = `${ts}-${seed}-${originalBase.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const dest = path.join(outDir, safeBase);
 
  try {
    // use shared safeStringify (redaction controlled by opts.redact)
    const content = safeStringify(explain, 2, opts?.redact ?? true);
    await fs.writeFile(dest, content, 'utf8');
 
    const meta: any = {
      dest,
      source: opts?.source ?? 'unknown',
      seed,
      service: process.env.SERVICE_NAME ?? 'qa',
      env: process.env.NODE_ENV ?? 'production',
    };
    if (opts?.correlationId) meta.correlationId = opts.correlationId;
    if (explain?.correlation_id) meta.correlationId = explain.correlation_id;
    // optionally include saved file size (best-effort)
    try {
      const stat = await fs.stat(dest);
      meta.size = stat.size;
    } catch {
      // ignore stat error
    }
 
    logger.info('explain.saved', sanitizeObject(meta));
    return dest;
  } catch (err) {
    const errorMeta = err instanceof Error ? { message: err.message, stack: err.stack, code: (err as any).code } : { message: String(err) };
    logger.error('explain.save_failed', { error: errorMeta, target: dest });
    throw err;
  }
}
 
export default { storeExplain };