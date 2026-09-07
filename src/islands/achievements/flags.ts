/**
 * What this visitor has found.
 *
 * A dumb store, deliberately: it records ids and does not know what any of them
 * mean. Every derivation — "have they solved all nine briefs?" — belongs to the
 * island that owns the question, because that is the only place the answer's
 * denominator is known. A store that hardcoded `=== 9` would be wrong the day a
 * scenario is added.
 *
 * **Write-once flags, never counters.** No streaks, no daily anything, and no
 * date arithmetic at all — not even a first-seen timestamp, since nothing needs
 * one now that the return experience is the list itself (CLAUDE.md). That is
 * what stops a "you haven't visited in 3 days" mechanic appearing later.
 *
 * Read as untrusted, like every stored value in this project: it can be
 * hand-edited, corrupted, or left over from an older version of the code.
 * Editing localStorage to award yourself an achievement is, of course,
 * possible — and entirely in keeping with a site whose signing key is public.
 * None of this guards anything.
 *
 * Nothing here leaves the browser. There is no backend, no sync and no
 * analytics (CLAUDE.md).
 */

const EARNED_KEY = 'taha:earned';
const SOLVED_KEY = 'taha:solved';

/**
 * Keys left in returning visitors' browsers by features that no longer exist:
 * the removed API Simulation, and the push/overlay comparison that push won.
 * Both are inert — nothing reads them — so this is tidiness rather than a fix.
 *
 * It runs from whichever island loads first, which means a visitor who never
 * opens one keeps their orphans. That is the correct trade: sweeping them on the
 * homepage would put JavaScript on the recruiter path to delete two dead
 * strings, and the whole point of the island-only rule is that nothing does.
 */
const RETIRED_KEYS = ['taha:api-progress', 'taha:terminal-mode'];

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return []; // absent, blocked, or corrupt — all mean "found nothing yet"
  }
}

function writeList(key: string, values: readonly string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    /* private mode or quota — not worth failing an interaction over */
  }
}

/* -------------------------------------------------------------------------- */
/* achievements                                                                */
/* -------------------------------------------------------------------------- */

export function earnedIds(): readonly string[] {
  return readList(EARNED_KEY);
}

export function hasEarned(id: string): boolean {
  return earnedIds().includes(id);
}

/**
 * Records an achievement. Returns true only the first time, so a caller can
 * show one-time feedback without tracking that itself — and so re-running the
 * same command does not re-announce anything.
 */
export function earn(id: string): boolean {
  const current = earnedIds();
  if (current.includes(id)) return false;
  writeList(EARNED_KEY, [...current, id]);
  return true;
}

/* -------------------------------------------------------------------------- */
/* solved briefs                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Which briefs have been solved, as a set of ids rather than a count.
 *
 * A count would be a counter, and counters are how streaks start. A set is also
 * simply correct: solving the same brief twice must not move you closer to
 * having solved them all.
 */
export function solvedBriefs(): readonly string[] {
  return readList(SOLVED_KEY);
}

export function markSolved(id: string): void {
  const current = solvedBriefs();
  if (current.includes(id)) return;
  writeList(SOLVED_KEY, [...current, id]);
}

/* -------------------------------------------------------------------------- */
/* housekeeping                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Forgets the achievements, and nothing else.
 *
 * **Exactly one key, at Taha's instruction.** An earlier version also cleared
 * `taha:solved` on the reasoning that it is what "clear the board" counts —
 * but that conflates two different things. `taha:solved` is the sandbox's own
 * progress, not an achievement record, and a control labelled "reset
 * achievements" has no business reaching into another feature's state.
 *
 * The consequence, stated so it is not mistaken for a bug: a visitor who had
 * solved every brief and then resets will earn "clear the board" again as soon
 * as they solve their next one, because the sandbox still knows the other
 * eight. That is the correct reading — the achievement is the record, and the
 * record is what was reset.
 *
 * Also untouched, for the same reason: the terminal's earned `sudo` scope,
 * which is a capability rather than a record, and its UI preferences, which
 * were never progress.
 */
export function resetAchievements(): void {
  try {
    localStorage.removeItem(EARNED_KEY);
  } catch {
    /* private mode — nothing was stored to begin with */
  }
}

export function sweepRetiredKeys(): void {
  for (const key of RETIRED_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** Exposed for the tests, and so the list above has one home. */
export const retiredKeys: readonly string[] = RETIRED_KEYS;
