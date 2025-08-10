/**
 * packages/obs/src/logger.ts
 * Improved structured logger (PoC -> production-ready improvements)
 *
 * Environment variables:
 * - OBS_LOG_LEVEL: error|warn|info|debug  (default: info)
 * - OBS_LOG_OUTPUT: console|file           (default: console)
 * - SERVICE_NAME: service name to include in logs
 *
 * Exports:
 * - info(tag: string, meta?: any)
 * - warn(tag: string, meta?: any)
 * - error(tag: string, meta?: any)
 */
import fs from 'fs/promises';
import path from 'path';
 
type LogLevel = 'error' | 'warn' | 'info' | 'debug';
const LEVEL_PRIORITIES: Record<LogLevel, number> = {
  error: 40,
  warn: 30,
  info: 20,
  debug: 10,
};
 
const REDACT_KEYS = [/password/i, /token/i, /secret/i, /authorization/i, /auth/i, /access_token/i];
 
function getEnvLogLevel(): LogLevel {
  const raw = (process.env.OBS_LOG_LEVEL ?? 'info').toLowerCase();
  return (['error', 'warn', 'info', 'debug'].includes(raw) ? raw : 'info') as LogLevel;
}
 
function shouldLog(level: LogLevel) {
  return LEVEL_PRIORITIES[level] >= LEVEL_PRIORITIES[getEnvLogLevel()];
}
 
function sanitizeObject(obj: any): any {
  if (obj == null) return obj;
  const seen = new WeakSet();
  const _sanitize = (value: any) => {
    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      if (Array.isArray(value)) return value.map(_sanitize);
      const out: any = {};
      for (const k of Object.keys(value)) {
        const v = value[k];
        if (typeof k === 'string' && REDACT_KEYS.some(rx => rx.test(k))) {
          out[k] = '[REDACTED]';
        } else {
          out[k] = _sanitize(v);
        }
      }
      return out;
    } else {
      return value;
    }
  };
  return _sanitize(obj);
}
 
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch {
    const seen = new WeakSet();
    return JSON.stringify(obj, function (key, value) {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      if (typeof key === 'string' && REDACT_KEYS.some(rx => rx.test(key))) return '[REDACTED]';
      return value;
    });
  }
}
 
async function writeToFile(line: string) {
  try {
    const outDir = path.join(process.cwd(), 'obs', 'logs');
    await fs.mkdir(outDir, { recursive: true });
    const file = path.join(outDir, `${new Date().toISOString().slice(0, 10)}.log`);
    await fs.appendFile(file, line + '\n', 'utf8');
  } catch (err) {
    // best-effort: don't throw from logger
    // eslint-disable-next-line no-console
    console.error('logger.file_write_failed', String(err));
  }
}
 
function formatLog(level: LogLevel, tag: string, meta?: any) {
  if (!shouldLog(level)) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME ?? 'qa',
    env: process.env.NODE_ENV ?? 'development',
    tag,
    meta: sanitizeObject(meta),
  };
 
  const line = safeStringify(entry);
  const output = (process.env.OBS_LOG_OUTPUT ?? 'console').toLowerCase();
  if (output === 'file') {
    // fire-and-forget
    void writeToFile(line);
  } else {
    // default console
    // eslint-disable-next-line no-console
    console.log(line);
  }
}
 
export function info(tag: string, meta?: any) {
  formatLog('info', tag, meta);
}
 
export function warn(tag: string, meta?: any) {
  formatLog('warn', tag, meta);
}
 
export function error(tag: string, meta?: any) {
  formatLog('error', tag, meta);
}
 
const logger = { info, warn, error };
export default logger;