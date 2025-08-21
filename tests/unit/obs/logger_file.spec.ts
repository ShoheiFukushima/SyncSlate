/**
 * tests/unit/obs/logger_file.spec.ts
 * Unit test to verify logger file output behavior when OBS_LOG_OUTPUT=file
 *
 * Executable via:
 *   npx tsx tests/unit/obs/logger_file.spec.ts
 */
import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  let exitCode = 0;
  try {
    // Ensure file output mode
    process.env.OBS_LOG_OUTPUT = 'file';

    const loggerMod = await import(path.resolve(process.cwd(), 'packages/obs/src/logger.ts'));
    const logger = (loggerMod && (loggerMod.default ?? loggerMod)) ? (loggerMod.default ?? loggerMod) : loggerMod;

    const logDir = path.join(process.cwd(), 'obs', 'logs');

    // Clean previous logs to ensure deterministic test
    await fs.rm(logDir, { recursive: true, force: true }).catch(() => {});

    // Emit a log entry
    logger.info('unit.logger.file', { foo: 'bar', correlation_id: 'cid-file-test' });

    // Wait for logger to flush (uses flushLogs with timeout)
    if (typeof logger.flushLogs === 'function') {
      await logger.flushLogs(5000);
    }

    // Expect file named by today's date (YYYY-MM-DD). Use same logic as logger
    const expectedFile = path.join(logDir, `${new Date().toISOString().slice(0, 10)}.log`);

    // Wait briefly until file appears (drainQueue is async)
    const start = Date.now();
    let found = false;
    while (Date.now() - start < 5000) {
      try {
        const st = await fs.stat(expectedFile);
        if (st && st.size > 0) {
          found = true;
          break;
        }
      } catch {
        // file not yet present
      }
      // sleep 100ms
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!found) throw new Error(`Log file not created or empty: ${expectedFile}`);

    const content = await fs.readFile(expectedFile, 'utf8');
    assert(content.length > 0, 'log file should contain content');
    assert(content.includes('unit.logger.file') || /"tag":\s*"unit.logger.file"/.test(content), 'log should include the tag "unit.logger.file"');

    console.log('Logger file output test passed.');
  } catch (err) {
    console.error('Logger file output test failed:', err);
    exitCode = 2;
  } finally {
    process.exit(exitCode);
  }
}

main();