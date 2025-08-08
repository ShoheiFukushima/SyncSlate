/**
 * packages/domain/src/validators/explainValidator.ts
 *
 * explain.json の構造検証と QA 判定ルールを提供する軽量バリデータ (PoC)。
 *
 * 使い方:
 *   npx tsx packages/domain/src/validators/explainValidator.ts ./qa-results/explain.json
 *
 * エクスポート関数:
 *  - validateExplainStructure(explain): ValidationResult
 *  - isQaPass(explain, options?): { pass: boolean, details: any }
 *  - validateExplainFile(filePath): Promise<{ ok: boolean, validation, explain }>
 *
 * ※ 本ファイルは外部ライブラリに依存せず、実運用では `ajv` 等の JSON Schema バリデータ導入を推奨します。
 */

import fs from 'fs';
import path from 'path';

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateExplainStructure(explain: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!explain || typeof explain !== 'object' || Array.isArray(explain)) {
    errors.push('explain must be an object');
    return { valid: false, errors, warnings };
  }

  // 必須フィールドチェック
  const requiredKeys = ['pattern', 'subscores', 'aggregateConfidence', 'reasons', 'project_seed', 'meta'];
  for (const k of requiredKeys) {
    if (!(k in explain)) {
      errors.push(`missing required field: ${k}`);
    }
  }

  // pattern
  const allowedPatterns = ['dynamic_cut', 'narrative_flow', 'hybrid_balance'];
  if ('pattern' in explain && !allowedPatterns.includes(explain.pattern)) {
    errors.push(`pattern must be one of: ${allowedPatterns.join(', ')}`);
  }

  // subscores
  if ('subscores' in explain) {
    const s = explain.subscores;
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      errors.push('subscores must be an object');
    } else {
      const subKeys = ['sync', 'semantic', 'visual', 'stability'];
      for (const sk of subKeys) {
        if (!(sk in s)) {
          errors.push(`subscores missing field: ${sk}`);
        } else {
          const v = s[sk];
          if (typeof v !== 'number' || Number.isNaN(v) || v < 0 || v > 1) {
            errors.push(`subscores.${sk} must be a number between 0 and 1`);
          }
        }
      }
      // 予期しない subscores 内キーは警告
      const allowedSubSet = new Set(subKeys);
      for (const key of Object.keys(s)) {
        if (!allowedSubSet.has(key)) {
          warnings.push(`subscores contains unexpected key: ${key}`);
        }
      }
    }
  }

  // aggregateConfidence
  if ('aggregateConfidence' in explain) {
    const ac = explain.aggregateConfidence;
    if (typeof ac !== 'number' || Number.isNaN(ac) || ac < 0 || ac > 1) {
      errors.push('aggregateConfidence must be a number between 0 and 1');
    } else {
      if (ac < 0.88) {
        warnings.push('aggregateConfidence < 0.88 (below QA pass threshold)');
      }
    }
  }

  // reasons
  if ('reasons' in explain) {
    if (!Array.isArray(explain.reasons)) {
      errors.push('reasons must be an array of strings');
    } else {
      if (explain.reasons.length < 5) {
        errors.push('reasons must contain at least 5 items');
      }
      for (let i = 0; i < explain.reasons.length; i++) {
        if (typeof explain.reasons[i] !== 'string') {
          errors.push(`reasons[${i}] must be a string`);
        }
      }
    }
  }

  // warnings (optional)
  if ('warnings' in explain) {
    if (!Array.isArray(explain.warnings)) {
      errors.push('warnings must be an array');
    } else {
      for (let i = 0; i < explain.warnings.length; i++) {
        if (typeof explain.warnings[i] !== 'string') {
          errors.push(`warnings[${i}] must be a string`);
        }
      }
    }
  }

  // project_seed
  if ('project_seed' in explain) {
    const ps = explain.project_seed;
    if (!Number.isInteger(ps)) {
      errors.push('project_seed must be an integer');
    }
  }

  // meta: 必須 mode, timestamp
  if ('meta' in explain) {
    const meta = explain.meta;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      errors.push('meta must be an object');
    } else {
      if (!('mode' in meta)) errors.push('meta.mode is required');
      if (!('timestamp' in meta)) errors.push('meta.timestamp is required');
      if ('timestamp' in meta) {
        const ts = String(meta.timestamp);
        const d = new Date(ts);
        if (isNaN(d.getTime())) {
          errors.push('meta.timestamp must be an ISO-8601 date-time string');
        }
      }
    }
  }

  // 追加プロパティ検出（スキーマでは許可されていないことを前提にエラー扱い）
  const allowedTopKeys = new Set([
    'pattern',
    'subscores',
    'aggregateConfidence',
    'reasons',
    'warnings',
    'project_seed',
    'meta',
  ]);
  for (const key of Object.keys(explain)) {
    if (!allowedTopKeys.has(key)) {
      errors.push(`unexpected top-level field: ${key}`);
    }
  }

  const valid = errors.length === 0;
  return { valid, errors, warnings };
}

export function isQaPass(explain: any, options?: { confidenceThreshold?: number }) {
  const threshold = options?.confidenceThreshold ?? 0.88;
  const struct = validateExplainStructure(explain);
  if (!struct.valid) {
    return { pass: false, reason: 'structure_invalid', details: struct };
  }
  const ac = explain.aggregateConfidence;
  const reasonsCount = Array.isArray(explain.reasons) ? explain.reasons.length : 0;
  const pass = ac >= threshold && reasonsCount >= 5;
  const details = {
    aggregateConfidence: ac,
    reasonsCount,
    threshold,
    structureWarnings: struct.warnings,
  };
  return { pass, details };
}

export async function validateExplainFile(filePath: string) {
  const abs = path.resolve(process.cwd(), String(filePath));
  let raw: string;
  try {
    raw = await fs.promises.readFile(abs, 'utf8');
  } catch (e) {
    return { ok: false, error: `cannot read file: ${String(e)}` };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `invalid JSON: ${String(e)}` };
  }
  const validation = validateExplainStructure(parsed);
  const pass = validation.valid && parsed.aggregateConfidence >= 0.88 && Array.isArray(parsed.reasons) && parsed.reasons.length >= 5;
  return { ok: pass, validation, explain: parsed };
}

// CLI 実行サポート
if (process.argv.length > 2) {
  (async () => {
    const filePath = process.argv[2];
    const r = await validateExplainFile(filePath);
    if (!r.ok) {
      console.error('Explain validation: FAIL');
      if (r.error) {
        console.error('Error:', r.error);
      } else {
        console.error('Validation details:', JSON.stringify(r.validation, null, 2));
      }
      process.exit(2);
    }
    const qa = isQaPass(r.explain);
    console.log('Explain validation: OK');
    console.log('QA pass:', qa.pass);
    console.log('Details:', JSON.stringify(qa.details, null, 2));
    process.exit(0);
  })();
}