/**
 * tests/unit/obs/explainSink.spec.ts
 * Unit tests for packages/obs/src/explainSink.ts
 * Executable by: npx tsx tests/unit/obs/explainSink.spec.ts
 */

import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

async function main() {
  let exitCode = 0;
  try {
    const module = await import(path.resolve(process.cwd(), 'packages/obs/src/explainSink.ts'));
    const storeExplain = (module && (module.storeExplain ?? module.default?.storeExplain)) as any;
    if (!storeExplain) throw new Error('storeExplain not found in module');

    // Test 1: successful save with circular + redaction
    const outDir1 = path.join(process.cwd(), 'tmp', 'obs-test', 'explain-success-' + Date.now());
    await fs.rm(outDir1, { recursive: true, force: true });
    await fs.mkdir(outDir1, { recursive: true });

    const explain1: any = { project_seed: 123, foo: 'bar', token: 'secret-token' };
    explain1.self = explain1;

    const dest1 = await storeExplain(explain1, { outDir: outDir1, source: 'unit-test', correlationId: 'cid-1' });
    const content1 = await fs.readFile(dest1, 'utf8');
    const parsed1 = JSON.parse(content1);

    assert.strictEqual(parsed1.foo, 'bar', 'saved content should preserve fields');
    assert.strictEqual(parsed1.project_seed, 123);
    assert.strictEqual(parsed1.token, '[REDACTED]', 'token must be redacted in saved file');
    assert.strictEqual(parsed1.self, '[Circular]', 'circular reference must be encoded as [Circular]');

    // Test 2: simulate write failure by making the target outDir non-writable (permissions)
    // Note: we avoid reassigning properties on ESM module namespace objects (read-only).
    const outDir2 = path.join(process.cwd(), 'tmp', 'obs-test', 'explain-fail-' + Date.now());
    await fs.rm(outDir2, { recursive: true, force: true });
    await fs.mkdir(outDir2, { recursive: true });
 
    // Preserve original permission bits so we can restore later
    let origMode = 0o755;
    try {
      const st = await fs.stat(outDir2);
      origMode = st.mode & 0o777;
    } catch {
      // ignore if stat fails; origMode stays as default
    }
 
    // Make directory non-writable to provoke a write failure (chmod to 000)
    try {
      await fs.chmod(outDir2, 0o000);
    } catch (e) {
      // If chmod is not supported in this environment, log and fall through;
      // the test will then attempt the write and may not fail, in which case
      // the test will surface that.
      // eslint-disable-next-line no-console
      console.warn('explainSink.spec: chmod failed or not permitted; write-failure simulation may not run', String(e));
    }
 
    let threw = false;
    try {
      await storeExplain({ project_seed: 999 }, { outDir: outDir2 });
    } catch (err: any) {
      threw = true;
      // Ensure we received an Error; message varies by platform (EACCES, EPERM, etc.)
      assert(err instanceof Error, 'error should be thrown on write failure');
    } finally {
      // Restore original permissions so cleanup is possible
      try {
        await fs.chmod(outDir2, origMode);
      } catch {
        // ignore restore errors
      }
    }
    if (!threw) throw new Error('expected storeExplain to throw when directory is not writable');

    console.log('ExplainSink unit tests passed.');
  } catch (err) {
    console.error('ExplainSink unit tests failed:', err);
    exitCode = 2;
  } finally {
    process.exit(exitCode);
  }
}

main();