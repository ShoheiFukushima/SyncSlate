/**
 * packages/obs/src/logger.ts
 * Lightweight structured logger for AutoEditTATE observability (PoC).
 *
 * Exports:
 * - info(tag: string, meta?: any)
 * - warn(tag: string, meta?: any)
 * - error(tag: string, meta?: any)
 */

function formatLog(level: string, tag: string, meta?: any) {
  const entry = { ts: new Date().toISOString(), level, tag, meta };
  // Structured JSON log (can be ingested by log aggregators)
  console.log(JSON.stringify(entry));
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