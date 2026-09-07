/**
 * What this visitor has unlocked.
 *
 * Persisted, unlike the permission sandbox's drafts. The distinction is that a
 * draft is an unfinished attempt at a puzzle — finding yesterday's half-filled
 * answer is worse than a blank page — whereas this is *earned progress*, and
 * taking it away on reload would mean solving the same puzzle twice. It is also
 * the "access" residue Phase 4 is meant to remember a returning visitor by, and
 * the unlock flag Phase 5 will derive an achievement from. No UI here: the
 * achievement list is deferred (CLAUDE.md) and this only records the fact.
 */

const KEY = 'taha:unlocked';

/**
 * Read as untrusted, like every other stored value in this project: it can be
 * hand-edited, corrupted, or left over from an older version. Anything that is
 * not an array of strings is discarded rather than trusted into the UI.
 *
 * Editing localStorage to grant yourself the scope is, of course, possible —
 * and entirely in keeping with a puzzle whose signing key is public. It is not
 * a boundary and is not pretending to be one.
 */
export function scopes(): readonly string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    return [];
  }
}

export function has(scope: string): boolean {
  return scopes().includes(scope);
}

/** Adds a scope. Returns false when it was already held, so callers can say so. */
export function grant(scope: string): boolean {
  const current = scopes();
  if (current.includes(scope)) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify([...current, scope]));
  } catch {
    /* Storage can be full or blocked; the grant just will not survive a reload. */
  }
  return true;
}

export function revokeAll(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
