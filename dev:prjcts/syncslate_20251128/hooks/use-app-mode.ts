// --- APP MODE HOOK ---
// OWNER REQUIREMENT: CLIENT mode must be completely free and require NO login

export type AppMode = 'HOST' | 'CLIENT';

/**
 * Determines the application mode based on URL parameters
 * CRITICAL: This determines whether authentication is required
 *
 * CLIENT MODE CONDITIONS (No Auth Required):
 * 1. URL has ?role=client
 * 2. URL has ?session=xxx (shared link)
 *
 * HOST MODE (Auth Required):
 * - Default mode when no parameters match
 */
export function useAppMode(): AppMode {
  const urlParams = new URLSearchParams(window.location.search);

  // Explicit role parameter
  const roleParam = urlParams.get('role');
  if (roleParam === 'client') return 'CLIENT';
  if (roleParam === 'host') return 'HOST';

  // Session ID means it's a shared link -> CLIENT mode
  const sessionId = urlParams.get('session');
  if (sessionId) return 'CLIENT';

  // Default to HOST mode
  return 'HOST';
}