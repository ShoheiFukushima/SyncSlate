#!/usr/bin/env node
import process from 'process';

/**
 * scripts/auto-merge-runner.js
 *
 * Automated auto-merge runner invoked by GitHub Actions.
 * - Runs on a schedule (15m) or manual dispatch
 * - Lists open PRs, excludes drafts and PRs with exclude labels
 * - Requires commit combined status == "success" and PR mergeable_state == "clean"
 * - Runs a lightweight PII/secret heuristic on changed file patches (first 10 files)
 * - If checks pass and no PII found, calls the Merge API to merge with "merge" method
 * - Posts comments on PRs when it prevents merging or when it merges
 *
 * Environment:
 *  - GITHUB_TOKEN (required)
 *  - GITHUB_REPOSITORY (owner/repo) (required)
 *  - EXCLUDE_LABELS (comma-separated, default: "no-auto-merge")
 *
 * Safety notes:
 *  - This script does NOT execute any code from PRs. It only reads diffs and metadata.
 *  - Keep heuristics conservative; false positives will prevent auto-merge but never leak secrets.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const EXCLUDE_LABELS = (process.env.EXCLUDE_LABELS || 'no-auto-merge')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}
if (!GITHUB_REPOSITORY) {
  console.error('GITHUB_REPOSITORY is required');
  process.exit(1);
}

const [owner, repo] = GITHUB_REPOSITORY.split('/');
const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'auto-merge-runner',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listOpenPRs() {
  let prs = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Failed to list PRs: ${res.status} ${txt}`);
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    prs.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  return prs;
}

async function getPR(prNumber) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to fetch PR ${prNumber}: ${res.status} ${txt}`);
  }
  return await res.json();
}

async function getCommitStatus(sha) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}/status`, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to get commit status for ${sha}: ${res.status} ${txt}`);
  }
  return await res.json();
}

async function getCheckRuns(sha) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs`, {
    headers: { ...headers, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to get check runs for ${sha}: ${res.status} ${txt}`);
  }
  const j = await res.json();
  return j.check_runs || [];
}

async function listPRFiles(prNumber) {
  let files = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Failed to list files for PR ${prNumber}: ${res.status} ${txt}`);
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    files.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  return files;
}

async function postComment(prNumber, body) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`Failed to post comment to PR ${prNumber}: ${res.status} ${txt}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Exception posting comment to PR ${prNumber}: ${err}`);
    return false;
  }
}

async function mergePR(prNumber) {
  const payload = { merge_method: 'merge' };
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    return { success: false, status: res.status, body: text };
  }
  try {
    return { success: true, ...(JSON.parse(text) || {}) };
  } catch {
    return { success: true, raw: text };
  }
}

function detectPIIInPatch(patch) {
  if (!patch) return [];
  const findings = [];
  // Conservative secret-like pattern
  const secretRegex = /(password|passwd|pwd|secret|token|api[_-]?key|private_key|client_secret|access_token|llm_api_key|aws_secret_access_key|aws_access_key_id|authorization|bearer)/i;
  if (secretRegex.test(patch)) findings.push('Possible secret-like token or key in diff');

  // Private key material
  const privateKeyRegex = /-----BEGIN (RSA |EC )?PRIVATE KEY-----/;
  if (privateKeyRegex.test(patch)) findings.push('Private key material detected in diff');

  // Credit-card-like numeric sequences (very conservative)
  const ccRegex = /(?<!\d)(?:\d[ -]*){13,16}(?!\d)/;
  if (ccRegex.test(patch)) findings.push('Possible credit-card-like numeric sequence in diff');

  return findings;
}

async function processPR(pr) {
  const prNumber = pr.number;
  console.log(`Processing PR #${prNumber}: ${pr.title}`);

  if (pr.draft) {
    console.log(` - Skipping draft PR #${prNumber}`);
    return;
  }

  const prLabels = (pr.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  if (EXCLUDE_LABELS.some((lbl) => prLabels.includes(lbl))) {
    console.log(` - Skipping PR #${prNumber} due to exclude label`);
    return;
  }

  // Refresh PR to ensure mergeable_state is computed
  let prDetails = await getPR(prNumber);
  let attempts = 0;
  while (prDetails.mergeable_state === null && attempts < 5) {
    // GitHub may need a moment to compute mergeability
    await sleep(1500);
    prDetails = await getPR(prNumber);
    attempts++;
  }

  console.log(` - mergeable_state=${prDetails.mergeable_state} mergeable=${prDetails.mergeable}`);
  if (prDetails.mergeable_state !== 'clean' || prDetails.mergeable === false) {
    console.log(` - PR #${prNumber} not in 'clean' mergeable_state or explicitly non-mergeable; skipping`);
    return;
  }

  const sha = pr.head?.sha;
  if (!sha) {
    console.log(` - PR #${prNumber} missing head.sha; skipping`);
    return;
  }

  // Combined commit status
  const commitStatus = await getCommitStatus(sha);
  console.log(` - Commit combined status for ${sha}: ${commitStatus.state}`);
  if (commitStatus.state !== 'success') {
    console.log(` - Not all required checks succeeded for PR #${prNumber}; skipping`);
    return;
  }

  // Extra guard: ensure there aren't unfinished/failed check runs
  const checkRuns = await getCheckRuns(sha);
  const problematic = checkRuns.find(
    (r) => r.status !== 'completed' || ['failure', 'timed_out', 'cancelled', 'action_required'].includes(r.conclusion)
  );
  if (problematic) {
    console.log(
      ` - Problematic check run for PR #${prNumber}: ${problematic.name} (status=${problematic.status}, conclusion=${problematic.conclusion}); skipping`
    );
    return;
  }

  // PII/secret scanning on changed files (first 10 files)
  const files = await listPRFiles(prNumber);
  const limitedFiles = files.slice(0, 10);
  let piiFindings = [];
  for (const f of limitedFiles) {
    const patch = f.patch ?? '';
    const findings = detectPIIInPatch(patch);
    if (findings.length) {
      piiFindings.push(...findings.map((m) => `${f.filename}: ${m}`));
    }
  }

  if (piiFindings.length) {
    const body = `Auto-merge prevented: potential PII/secrets detected in changed files.\n\nFindings:\n${piiFindings
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n')}\n\nIf this is intentional, remove sensitive data or add label(s) \`${EXCLUDE_LABELS.join(',')}\` to the PR to skip auto-merge.`;
    await postComment(prNumber, body);
    console.log(` - PII findings for PR #${prNumber}; commented and skipped merging`);
    return;
  }

  // Attempt merge
  console.log(` - Attempting to merge PR #${prNumber}`);
  const mergeRes = await mergePR(prNumber);
  if (mergeRes.success) {
    console.log(` - Successfully merged PR #${prNumber}`);
    await postComment(prNumber, 'Auto-merged by automated runner. If this was a mistake, revert the merge or contact the maintainers.');
  } else {
    console.error(` - Merge attempt failed for PR #${prNumber}:`, mergeRes);
    const msg = `Auto-merge attempt failed for PR #${prNumber}. Merge API response: ${mergeRes.status}\n\n${String(
      mergeRes.body || mergeRes.raw || ''
    )}`.slice(0, 8000);
    await postComment(prNumber, msg);
  }
}

async function main() {
  try {
    const prs = await listOpenPRs();
    console.log(`Found ${prs.length} open PR(s)`);
    for (const pr of prs) {
      try {
        await processPR(pr);
      } catch (err) {
        console.error(`Error while processing PR #${pr.number}:`, String(err));
        // continue with next PR
      }
    }
  } catch (err) {
    console.error('Unhandled error in auto-merge runner:', String(err));
    process.exit(1);
  }
}

main();