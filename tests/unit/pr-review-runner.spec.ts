/**
 * tests/unit/pr-review-runner.spec.ts
 * Unit tests for scripts/pr-review-utils.js (scrubPatch)
 *
 * Executable via:
 *   npx tsx tests/unit/pr-review-runner.spec.ts
 */
import assert from 'assert';
import { scrubPatch, isLikelySecretLine } from '../../scripts/pr-review-utils.js';

async function main() {
  let exitCode = 0;
  try {
    // Case 1: OpenAI-style key (sk-...)
    const openai = `const key = 'sk-abcDEF1234567890abcdef';`;
    const r1 = scrubPatch(openai);
    assert(!/sk-abcDEF/.test(r1), 'openai key should be redacted');
    assert(/\[REDACTED\]/.test(r1), 'redaction marker expected for OpenAI key');

    // Case 2: Google API key (AIza...)
    const gkey = 'AIzaSyD-EXAMPLE-KEY1234567890';
    const r2 = scrubPatch(`export const GOOGLE_KEY = "${gkey}";`);
    assert(!/AIzaSyD-EXAMPLE/.test(r2), 'Google key should be redacted');
    assert(/\[REDACTED\]/.test(r2), 'redaction marker expected for Google key');

    // Case 3: PEM / private key block
    const pem = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
-----END PRIVATE KEY-----`;
    const r3 = scrubPatch(`some header\n${pem}\ntrailer`);
    assert(r3.includes('[REDACTED_PEM]'), 'PEM block should be replaced with [REDACTED_PEM]');

    // Case 4: JSON key:value pattern
    const kv = `"LLM_API_KEY": "mysecretxyz"`;
    const r4 = scrubPatch(`const obj = { ${kv} };`);
    assert(/\[REDACTED\]/.test(r4), 'LLM_API_KEY value should be redacted');
    assert(!/mysecretxyz/.test(r4), 'original secret should not appear');

    // Case 5: long base64-like sequence
    const b64 = 'A'.repeat(120) + '==';
    const r5 = scrubPatch(`const token = "${b64}";`);
    assert(r5.includes('[REDACTED]'), 'Long base64-like sequences should be redacted');

    // Case 6: generic hex-like long secret
    const hex = 'a'.repeat(64);
    const r6 = scrubPatch(`const h = "${hex}";`);
    assert(r6.includes('[REDACTED]'), 'Long hex strings should be redacted');

    // Case 7: isLikelySecretLine helper
    assert(isLikelySecretLine('const API_KEY = "..."'), 'isLikelySecretLine should detect api_key');
    assert(!isLikelySecretLine('const foo = "bar"'), 'isLikelySecretLine should not falsely detect');

    console.log('pr-review-runner redaction unit tests passed.');
  } catch (err) {
    console.error('pr-review-runner redaction unit tests failed:', err);
    exitCode = 2;
  } finally {
    process.exit(exitCode);
  }
}

main();