#!/usr/bin/env node
import fs from 'fs/promises';
import process from 'process';
import { execSync } from 'child_process';
import { scrubPatch, isLikelySecretLine } from './pr-review-utils.js';

/**
 * scripts/pr-review-runner.js
 *
 * Minimal automated PR reviewer (comment-only).
 * - Reads PR event from GITHUB_EVENT_PATH
 * - Collects up to 10 changed files and small patches
 * - If LLM_API_KEY is provided, calls OpenAI Chat Completions (gpt-3.5-turbo) to generate a review
 * - Otherwise falls back to a heuristic check and posts a comment on the PR
 *
 * Note:
 * - This script must NOT run arbitrary code from the PR. It only reads diffs and posts comments.
 * - Expects environment variables:
 *   - GITHUB_EVENT_PATH (set by GitHub Actions)
 *   - GITHUB_REPOSITORY (owner/repo)
 *   - GITHUB_TOKEN (permission to comment on PR)
 *   - LLM_API_KEY (optional) for OpenAI-compatible API
 *
 * Local mode:
 *  - Pass `--local` to avoid calling GitHub API. In local mode the script will compute diffs using `git` (HEAD vs base branch) using the event JSON (GITHUB_EVENT_PATH) or the --event <path> option.
 *  - By default local mode will not post comments to GitHub; pass `--post` to allow posting.
 */

const args = process.argv.slice(2);
const isLocal = args.includes('--local');
const postInLocal = args.includes('--post');
const eventArgIndex = args.findIndex(a => a === '--event');
const eventPathArg = eventArgIndex >= 0 ? args[eventArgIndex + 1] : undefined;

async function main() {
  const eventPath = eventPathArg ?? process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error('GITHUB_EVENT_PATH is not set (or --event not provided)');
    process.exit(1);
  }

  const eventRaw = await fs.readFile(eventPath, 'utf8');
  let event;
  try {
    event = JSON.parse(eventRaw);
  } catch (e) {
    console.error('Failed to parse event JSON:', String(e));
    process.exit(1);
  }

  const prNumber = event.pull_request?.number ?? event.issue?.number;
  if (!prNumber) {
    console.error('PR number not found in event payload');
    process.exit(1);
  }

  const repoFull = process.env.GITHUB_REPOSITORY;
  if (!repoFull) {
    console.error('GITHUB_REPOSITORY not set');
    process.exit(1);
  }
  const [owner, repo] = repoFull.split('/');
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const LLM_API_KEY = process.env.LLM_API_KEY;

  if (!GITHUB_TOKEN && !isLocal) {
    console.error('GITHUB_TOKEN not set (required unless --local)');
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN ?? ''}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'auto-pr-reviewer'
  };

  // Collect changed files (up to 100 per page). Supports local mode (--local).
  let files = [];
  if (isLocal) {
    // Local mode: compute diffs using git. Requires event JSON path.
    const localEvent = event;
    const baseRef = localEvent.pull_request?.base?.ref ?? 'main';
    let baseCandidate = `origin/${baseRef}`;
    try {
      execSync(`git rev-parse --verify ${baseCandidate}`, { stdio: 'ignore' });
    } catch {
      baseCandidate = baseRef;
    }

    let changedRaw = '';
    try {
      changedRaw = execSync(`git diff --name-only ${baseCandidate}...HEAD`).toString('utf8');
    } catch (e) {
      try {
        changedRaw = execSync(`git diff --name-only ${baseCandidate}`).toString('utf8');
      } catch (e2) {
        console.error('Failed to get changed files via git diff:', String(e2));
        process.exit(1);
      }
    }
    const changedFiles = changedRaw.split(/\r?\n/).filter(Boolean).slice(0, 100);
    files = await Promise.all(changedFiles.slice(0, 10).map(async (filename) => {
      let patch = '';
      try {
        patch = execSync(`git diff ${baseCandidate}...HEAD -- ${filename}`).toString('utf8');
      } catch {
        try {
          patch = execSync(`git show HEAD:${filename}`).toString('utf8');
        } catch {
          patch = '';
        }
      }
      return { filename, patch };
    }));
  } else {
    // Remote - GitHub API
    let page = 1;
    while (true) {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?page=${page}&per_page=100`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.error('Failed to list PR files:', res.status, await res.text());
        process.exit(1);
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      files = files.concat(data);
      if (data.length < 100) break;
      page++;
    }
  }

  // Build compact diffs summary (limit size to avoid huge prompts)
  // Use scrubPatch implemented in scripts/pr-review-utils.js (imported at top).
  // This centralizes redaction logic and makes it testable.

  const fileSummaries = files.slice(0, 10).map(f => {
    const patch = f.patch ?? '';
    const limited = scrubPatch(patch);
    return `=== ${f.filename} ===\n${limited}`;
  });

  const promptHeader = `You are an automated code reviewer. Given the following file diffs for PR #${prNumber} in ${owner}/${repo}, produce:
1) A very short (1-2 line) summary
2) Up to 3 high-priority issues (security / PII / performance / correctness) with file references
3) For each issue, a minimal suggestion (code snippet or short instruction)

Do NOT execute code. Do NOT reveal secrets. Keep the response concise in markdown.`;

  const contentToLLM = `${promptHeader}\n\n${fileSummaries.join('\n\n')}`;

  let reviewText = null;

  if (LLM_API_KEY) {
    try {
      const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLM_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a concise code reviewer who focuses on security, PII, performance, and correctness.' },
            { role: 'user', content: contentToLLM }
          ],
          max_tokens: 800,
        }),
      });

      if (!llmRes.ok) {
        const respText = await llmRes.text();
        console.warn('LLM API returned non-OK:', llmRes.status, respText);
        const invalidKeyDetected =
          llmRes.status === 401 ||
          /invalid_api_key|incorrect api key|invalid api key/i.test(respText) ||
          /Incorrect API key/i.test(respText);
        if (invalidKeyDetected) {
          const adminComment = `Automated LLM Review (bot) — ERROR: LLM API call failed with status ${llmRes.status}.

Possible cause: the repository secret \`LLM_API_KEY\` is invalid or intended for a different provider (for example, a Google API key that starts with "AIza" was uploaded instead of an OpenAI key starting with "sk-...").

Recommended action for repository administrators:
1. Remove the existing secret from the repository: Settings → Secrets and variables → Actions → Delete \`LLM_API_KEY\`.
   (CLI: \`gh secret remove LLM_API_KEY --repo ${owner}/${repo}\`)
2. Create a new OpenAI API key (if using OpenAI): https://platform.openai.com/account/api-keys
3. Add the new key as a repository secret: Settings → Secrets and variables → Actions → New repository secret
   Name: \`LLM_API_KEY\`
   (CLI: \`gh secret set LLM_API_KEY --body "<NEW_KEY>" --repo ${owner}/${repo}\`)
4. Re-run the workflow or re-open the PR to trigger the automated reviewer again.

LLM error details (truncated):
\`\`\`
${respText.length > 2000 ? respText.slice(0, 2000) + '\n... (truncated)' : respText}
\`\`\`

This automated note was posted to help maintainers restore the LLM reviewer safely.`;
          try {
            if (isLocal && !postInLocal) {
              console.log('Local mode - admin error comment (not posted):\n' + adminComment);
            } else {
              const adminRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ body: adminComment }),
              });
              if (!adminRes.ok) {
                console.error('Failed to post admin error comment:', adminRes.status, await adminRes.text());
              } else {
                console.log('Posted admin error comment to PR #' + prNumber);
              }
            }
          } catch (e) {
            console.error('Exception while posting admin error comment:', String(e));
          }
        }
      } else {
        const j = await llmRes.json();
        reviewText = j?.choices?.[0]?.message?.content ?? null;
      }
    } catch (err) {
      console.warn('LLM call failed:', String(err));
    }
  }

  if (!reviewText) {
    // Fallback heuristic reviewer
    const issues = [];
    for (const f of files.slice(0, 10)) {
      const p = f.patch ?? '';
      if (p.includes('console.log(')) {
        issues.push(`File \`${f.filename}\`: contains \`console.log\` — prefer structured logging (use logger) or remove debug logs in production.`);
      }
      if (/(password|token|secret|authorization|access_token)/i.test(p)) {
        issues.push(`File \`${f.filename}\`: potential secret keys or tokens appear in diff — ensure redaction before logging/storing.`);
      }
      if (p.includes('fs.writeFileSync') || p.includes('fs.appendFileSync')) {
        issues.push(`File \`${f.filename}\`: synchronous file I/O detected — prefer async APIs or queueing for high-throughput paths.`);
      }
      if (p.includes('eval(') || p.includes('new Function(')) {
        issues.push(`File \`${f.filename}\`: dynamic code execution (eval/new Function) detected — avoid if possible.`);
      }
    }
    reviewText = issues.length ? `Automated heuristic review:\n\n${issues.slice(0, 10).map((s, i) => `${i+1}. ${s}`).join('\n')}` : 'Automated heuristic review: No obvious issues found by heuristics.';
  }

  const commentBody = `Automated LLM Review (bot):

${reviewText}

*This comment was generated automatically by an automated reviewer. Treat suggestions as guidance and perform human review.*`;

  if (isLocal && !postInLocal) {
    // In local mode without --post, just print the comment to stdout for inspection
    console.log('Local mode - automated review (comment body):\n\n' + commentBody);
  } else {
    const commentRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: commentBody }),
    });

    if (!commentRes.ok) {
      console.error('Failed to post comment:', commentRes.status, await commentRes.text());
      process.exit(1);
    }

    console.log('Posted automated review comment to PR #' + prNumber);
  }
}

main().catch(err => {
  console.error('Unhandled error in pr-review-runner:', String(err));
  process.exit(1);
});