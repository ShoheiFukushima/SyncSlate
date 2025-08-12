/**
 * scripts/pr-review-utils.js
 * Utility functions for pr-review-runner
 * - scrubPatch(patch): redacts common secret patterns and truncates
 */

export function scrubPatch(patch) {
  if (!patch) return '';
  let s = String(patch);

  // Remove PEM blocks (private keys, certs)
  s = s.replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[REDACTED_PEM]');

  // OpenAI-style keys
  s = s.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]');
  // Google API keys
  s = s.replace(/\bAIza[0-9A-Za-z-_]{10,}\b/g, '[REDACTED]');
  // OAuth2 short-lived tokens (Google-like)
  s = s.replace(/\bya29\.[0-9A-Za-z\-_]+\b/g, '[REDACTED]');
  // GitHub tokens (common prefixes)
  s = s.replace(/\bgh[opsr]_[A-Za-z0-9_]{36,}\b/g, '[REDACTED]');
  // Generic bearer tokens in headers
  s = s.replace(/(Authorization:\s*Bearer\s*)(\S+)/gi, (m, p1) => p1 + '[REDACTED]');

  // Key=value or JSON key patterns: KEY: value or KEY = "value"
  s = s.replace(/\b(LLM_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY|OPENAI_KEY|API_KEY|APIKEY|ACCESS_TOKEN|ACCESSTOKEN|CLIENT_SECRET|TOKEN|SECRET|PASSWORD|PRIVATE_KEY|AWS_SECRET_ACCESS_KEY|AWS_SECRET)\b\s*[:=]\s*["']?([^\s"';,]+)/gi, (m, p1) => `${p1}: [REDACTED]`);
  s = s.replace(/(["'](?:token|password|secret|llm_api_key|api_key|access_token)["']\s*:\s*["'])([^"']+)(["'])/gi, (_, a, b, c) => `${a}[REDACTED]${c}`);

  // Hex-like secrets
  s = s.replace(/\b[A-Fa-f0-9]{32,}\b/g, '[REDACTED]');
  // Base64-ish sequences longer than 40 chars
  s = s.replace(/\b[A-Za-z0-9+\/]{40,}={0,2}\b/g, '[REDACTED]');

  // If lines contain very long uninterrupted strings (>200 chars), redact them
  s = s.replace(/\S{200,}/g, '[REDACTED]');

  // Normalize excessive whitespace introduced by replacements
  s = s.replace(/\s{2,}/g, ' ');

  // Truncate overall patch to avoid huge prompts
  if (s.length > 4000) s = s.slice(0, 4000) + '\n... (truncated)';
  return s;
}

export function isLikelySecretLine(line) {
  return /\b(api[_-]?key|api[_-]?secret|token|password|llm[_-]?api[_-]?key|openai|gemini|secret)\b/i.test(line);
}