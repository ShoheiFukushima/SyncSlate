/**
 * packages/obs/src/logger.ts
 * Hardened structured logger for AutoEditTATE
 *
 * Improvements:
 * - exported sanitizeObject / safeStringify for reuse
 * - adds pid/host/correlation_id top-level fields
 * - non-blocking file write via async queue (sequential append)
 * - truncation of overly large log lines
 *
 * Environment variables:
 * - OBS_LOG_LEVEL: error|warn|info|debug  (default: info)
 * - OBS_LOG_OUTPUT: console|file           (default: console)
 * - OBS_LOG_MAX_LENGTH: max length of a log line (default: 200000)
 * - SERVICE_NAME: service name to include in logs
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
 
type LogLevel = 'error' | 'warn' | 'info' | 'debug';
const LEVEL_PRIORITIES: Record<LogLevel, number> = {
  error: 40,
  warn: 30,
  info: 20,
  debug: 10,
};
 
const REDACT_KEYS = [
  /password/i,
  /passphrase/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /auth/i,
  /access_token/i,
  /api[_-]?key/i,
  /apikey/i,
  /llm[_-]?api[_-]?key/i,
  /gemini[_-]?api[_-]?key/i,
  /client[_-]?secret/i,
  /secret[_-]?key/i,
  /private[_-]?key/i,
  /credential/i,
];
const DEFAULT_MAX_LINE = Number(process.env.OBS_LOG_MAX_LENGTH ?? '200000');
const LOG_OUT_DIR = path.join(process.cwd(), 'obs', 'logs');
const MAX_QUEUE_LENGTH = Number(process.env.OBS_LOG_QUEUE_MAX ?? '5000');
 
function getEnvLogLevel(): LogLevel {
  const raw = (process.env.OBS_LOG_LEVEL ?? 'info').toLowerCase();
  return (['error', 'warn', 'info', 'debug'].includes(raw) ? raw : 'info') as LogLevel;
}
 
function shouldLog(level: LogLevel) {
  return LEVEL_PRIORITIES[level] >= LEVEL_PRIORITIES[getEnvLogLevel()];
}
 
export function sanitizeObject(obj: any, maxDepth = 10): any {
  if (obj == null) return obj;
  const seen = new WeakSet();
  const _sanitize = (value: any, depth = 0) => {
    if (depth > maxDepth) return '[MaxDepth]';
    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      if (Array.isArray(value)) return value.map(v => _sanitize(v, depth + 1));
      const out: any = {};
      for (const k of Object.keys(value)) {
        const v = value[k];
        if (typeof k === 'string' && REDACT_KEYS.some(rx => rx.test(k))) {
          out[k] = '[REDACTED]';
        } else {
          out[k] = _sanitize(v, depth + 1);
        }
      }
      return out;
    } else if (typeof value === 'string') {
      // very long strings are truncated to avoid log explosion
      if (value.length > 10000) return value.slice(0, 10000) + '... [TRUNCATED]';
      return value;
    } else {
      return value;
    }
  };
  return _sanitize(obj);
}
 
export function safeStringify(obj: any, space?: number, redact = true, maxLen = DEFAULT_MAX_LINE): string {
  try {
    // sanitize first to handle circulars and redact known keys
    const toSerialize = redact ? sanitizeObject(obj) : obj;
    const s = JSON.stringify(toSerialize, null, space);
    if (s && s.length > maxLen) return s.slice(0, maxLen) + '... [TRUNCATED]';
    return s;
  } catch (err) {
    // fallback: circular-safe replacer with redaction
    try {
      const seen = new WeakSet();
      const s = JSON.stringify(obj, function (key, value) {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        if (redact && typeof key === 'string' && REDACT_KEYS.some(rx => rx.test(key))) return '[REDACTED]';
        return value;
      }, space);
      return s.length > maxLen ? s.slice(0, maxLen) + '... [TRUNCATED]' : s;
    } catch {
      // last resort: toString fallback
      try {
        const fallback = String(obj);
        return fallback.length > maxLen ? fallback.slice(0, maxLen) + '... [TRUNCATED]' : fallback;
      } catch {
        return '[UNSERIALIZABLE]';
      }
    }
  }
}
 
// Simple in-memory queue to serialize file appends (best-effort, sequential)
type QueueItem = { line: string };
const logQueue: QueueItem[] = [];
let isDraining = false;
 
async function drainQueue() {
  if (isDraining) return;
  isDraining = true;
  try {
    try {
      await fs.mkdir(LOG_OUT_DIR, { recursive: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('logger.mkdir_failed', String(err));
      // continue; appendFile will likely fail but attempt writes anyway
    }
    const file = path.join(LOG_OUT_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
    while (logQueue.length > 0) {
      const item = logQueue.shift()!;
      try {
        await fs.appendFile(file, item.line + '\n', 'utf8');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('logger.file_write_failed', String(err));
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('logger.drain_failed', String(err));
  } finally {
    isDraining = false;
  }
}
 
function writeToFile(line: string) {
  const truncated = line.length > DEFAULT_MAX_LINE ? line.slice(0, DEFAULT_MAX_LINE) + '... [TRUNCATED]' : line;
  // keep queue bounded to avoid memory blowup; drop oldest entries when full
  if (logQueue.length >= MAX_QUEUE_LENGTH) {
    // remove oldest to make room
    logQueue.shift();
    // mark that logs were dropped (best-effort indicator)
    logQueue.push({ line: '[LOG DROPPED]' });
  }
  logQueue.push({ line: truncated });
  if (!isDraining) {
    // fire-and-forget
    void drainQueue();
  }
}
 
function formatLog(level: LogLevel, tag: string, meta?: any) {
  if (!shouldLog(level)) return;
  const sanitized = sanitizeObject(meta);
  let correlationId: string | undefined;
  let metaForEntry: any = undefined;

  if (sanitized && typeof sanitized === 'object') {
    const { correlation_id, correlationId: correlationIdAlt, ...rest } = sanitized;
    correlationId = (correlation_id ?? correlationIdAlt) as string | undefined;
    metaForEntry = Object.keys(rest).length ? rest : undefined;
  } else if (sanitized) {
    metaForEntry = sanitized;
  }

  const entry: any = {
    ts: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME ?? 'qa',
    env: process.env.NODE_ENV ?? 'development',
    pid: process.pid,
    host: os.hostname(),
    tag,
  };
  if (correlationId) entry.correlation_id = correlationId;
  if (metaForEntry) entry.meta = metaForEntry;

  const line = safeStringify(entry);
  const output = (process.env.OBS_LOG_OUTPUT ?? 'console').toLowerCase();
  if (output === 'file') {
    void writeToFile(line);
  } else {
    // default console
    // eslint-disable-next-line no-console
    if (level === 'error') console.error(line);
    else console.log(line);
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
 
/**
 * Flush any pending log writes (returns when queue drained).
 * Exported for tests / graceful shutdown handling.
 */
export async function flushLogs(timeoutMs = 5000): Promise<void> {
  // Kick off a drain if nothing is currently draining
  if (!isDraining && logQueue.length > 0) {
    try {
      await drainQueue();
    } catch {
      // ignore
    }
  }
  const start = Date.now();
  // Wait until queue is drained or timeout reached
  while ((isDraining || logQueue.length > 0) && Date.now() - start < timeoutMs) {
    // small sleep
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) => setTimeout(res, 50));
  }
}
 
function handleShutdown(signal: string) {
  // best-effort: attempt to flush logs, then exit
  void flushLogs()
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error('flushLogs failed on shutdown', String(e));
    })
    .finally(() => {
      // eslint-disable-next-line no-console
      console.log(`exiting due to ${signal}`);
      // use process.exit to ensure termination after flush
      process.exit(0);
    });
}
 
// Attach process signal handlers to try to flush logs before exit
try {
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('beforeExit', () => {
    if (logQueue.length > 0) void flushLogs();
  });
} catch {
  // If signals are unavailable in some environments, ignore
}
 
const logger = { info, warn, error, sanitizeObject, safeStringify, flushLogs };
export default logger;