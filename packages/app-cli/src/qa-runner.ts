/**
 * packages/app-cli/src/qa-runner.ts
 * Simple QA suite runner (PoC).
 *
 * Usage:
 *   npx tsx packages/app-cli/src/qa-runner.ts --mode=demo-pass --outDir=./qa-results
 */

import fs from 'fs';
import path from 'path';
import logger from '../../obs/src/logger';
import { storeExplain } from '../../obs/src/explainSink';

type QaResult = {
  success: boolean;
  explain?: any;
  errors?: any[];
};

function parseArgs(argv: string[]) {
  const opts: Record<string, any> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const val = argv[i + 1] && !String(argv[i + 1]).startsWith('--') ? argv[++i] : true;
      opts[key] = val;
    } else {
      if (!opts._) opts._ = [];
      opts._.push(a);
    }
  }
  return opts;
}

async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function generateMockExplain(opts: any) {
  const subscores = {
    sync: 0.92,
    semantic: 0.9,
    visual: 0.88,
    stability: 0.87,
  };
  const reasons = [
    '音楽同期: P95 ≤ 3フレーム',
    '編集リズム: 最小ショット長遵守',
    '歌詞テロップ: 文字数/表示時間適正',
    '出力XML: スキーマ検証通過',
    'パフォーマンス: メモリ閾値内',
  ];
  const aggregateConfidence =
    (subscores.sync + subscores.semantic + subscores.visual + subscores.stability) / 4;
  return {
    pattern: opts.pattern || 'dynamic_cut',
    subscores,
    aggregateConfidence: Number(aggregateConfidence.toFixed(3)),
    reasons,
    warnings: [],
    project_seed: 123456789,
    meta: {
      mode: opts.mode || 'demo-pass',
      timestamp: new Date().toISOString(),
    },
  };
}

async function runQaSuite(opts: any): Promise<QaResult> {
  // Demo fail mode for CI testing of failure path
  if (opts.mode === 'demo-fail') {
    const errors = [
      { check: 'validateDuration', message: '完成尺が0フレーム一致していません' },
      { check: 'validateLyricsCues', message: 'テロップ重なり - 1件' },
    ];
    return { success: false, errors };
  }

  // Default: demo-pass (PoC)
  const explain = generateMockExplain(opts);
  const success = explain.aggregateConfidence >= 0.88;
  return { success, explain, errors: success ? [] : [{ message: 'aggregateConfidence too low' }] };
}

async function writeOutput(outDir: string, result: QaResult) {
  await ensureDir(outDir);
  if (result.success && result.explain) {
    const explainPath = path.join(outDir, 'explain.json');
    await fs.promises.writeFile(explainPath, JSON.stringify(result.explain, null, 2), 'utf8');
    console.log('QA合格: explain.json を生成しました:', explainPath);

    // Observability: store explain.json into the explain sink and emit structured log
    try {
      const storedPath = await storeExplain(result.explain, { source: 'qa-runner', path: explainPath });
      logger.info('qa.explain_stored', { explainPath, storedPath });
    } catch (err) {
      logger.error('qa.explain_store_failed', { error: String(err), explainPath });
    }
  } else {
    const errPath = path.join(outDir, 'error_report.json');
    await fs.promises.writeFile(errPath, JSON.stringify({ errors: result.errors || [] }, null, 2), 'utf8');
    console.log('QA不合格: error_report.json を生成しました:', errPath);

    // Observability: store error report as well for diagnostics
    try {
      const stubExplain = {
        pattern: 'error_report',
        reasons: (result.errors || []).map((e: any) => String(e.message ?? e)),
        aggregateConfidence: 0.0,
        warnings: [],
        project_seed: null,
        meta: {
          mode: 'qa-error',
          timestamp: new Date().toISOString(),
        },
        originalErrorReportPath: errPath,
      };
      const storedPath = await storeExplain(stubExplain, { source: 'qa-runner', path: errPath });
      logger.warn('qa.error_report_stored', { errPath, storedPath });
    } catch (err) {
      logger.error('qa.error_report_store_failed', { error: String(err), errPath });
    }
  }
}

async function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const outDir = String(opts.outDir || opts.out || './qa-results');
    console.log('[qa-runner] 開始: オプション', opts);

    const result = await runQaSuite(opts);
    await writeOutput(outDir, result);

    if (!result.success) {
      console.error('[qa-runner] QA 失敗');
      process.exit(2);
    }
    console.log('[qa-runner] QA 成功');
    process.exit(0);
  } catch (e) {
    console.error('[qa-runner] 実行エラー:', e);
    process.exit(1);
  }
}

main();