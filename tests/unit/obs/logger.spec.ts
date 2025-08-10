/**
 * tests/unit/obs/logger.spec.ts
 * Unit tests for packages/obs/src/logger.ts
 * Executable by: npx tsx tests/unit/obs/logger.spec.ts
 */

import assert from 'assert';
import path from 'path';

async function main() {
  // Load logger implementation relative to project root
  const loggerMod = await import(path.resolve(process.cwd(), 'packages/obs/src/logger.ts'));
  const logger = (loggerMod && (loggerMod.default ?? loggerMod)) ? (loggerMod.default ?? loggerMod) : loggerMod;

  const origConsoleLog = console.log;
  const captured: string[] = [];
  console.log = (...args: any[]) => {
    try {
      captured.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    } catch {
      captured.push(String(args));
    }
  };

  let exitCode = 0;
  try {
    // circular reference + PII redaction
    const obj: any = {};
    obj.self = obj;
    logger.info('unit.logger.circular', { a: obj, password: 'very-secret', nested: { token: 'abc' } });

    if (captured.length < 1) throw new Error('no log output captured for circular test');
    const parsed = JSON.parse(captured[captured.length - 1]);
    assert.strictEqual(parsed.level, 'info', 'level should be info');
    assert.strictEqual(parsed.tag, 'unit.logger.circular');
    assert.strictEqual(parsed.meta.password, '[REDACTED]', 'password must be redacted');
    // circular should be replaced by string marker
    assert(parsed.meta.a && parsed.meta.a.self === '[Circular]', 'circular reference must be marked');

    // log level filtering
    process.env.OBS_LOG_LEVEL = 'error';
    const before = captured.length;
    logger.info('unit.logger.should_suppress', { test: true });
    assert.strictEqual(captured.length, before, 'info should be suppressed when OBS_LOG_LEVEL=error');

    // restore env
    delete process.env.OBS_LOG_LEVEL;

    console.log('Logger unit tests passed.');
  } catch (err) {
    console.error('Logger unit tests failed:', err);
    exitCode = 2;
  } finally {
    console.log = origConsoleLog;
    process.exit(exitCode);
  }
}

main();