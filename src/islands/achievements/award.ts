/**
 * Record an achievement and say so, in one call.
 *
 * The islands use this rather than `earn()` directly, so recording and
 * feedback cannot come apart — there is no way to add an achievement that
 * silently earns nothing visible, which is the failure mode a separate
 * `earn` + `announce` pair invites.
 *
 * `flags.ts` stays DOM-free and Node-tested; this is the thin layer that knows
 * about the page. The split is why the store can be tested without a browser.
 *
 * The achievements page itself uses `earn()` instead: announcing "Found the
 * door" to someone already reading the list is telling them what they can see.
 */
import { ACHIEVEMENTS, COMPLETION } from '../../data/achievements';
import { earn, earnedIds } from './flags';
import { announce } from './notice';

export function award(id: string): void {
  // `earn` returns true only the first time, so the notice is one-time without
  // this module tracking anything.
  if (!earn(id)) return;

  const achievement = ACHIEVEMENTS.find((a) => a.id === id);
  // A missing label means the id is not on the list, which the tests catch at
  // build time. Recording still happened; staying silent beats guessing a name.
  if (achievement) announce(achievement.label, achievement.moment);

  sealIfComplete();
}

/**
 * Awards the capstone once every *other* achievement is in.
 *
 * It lives here, at the single point every island records through, so the
 * fourteenth cannot be missed depending on which island happened to earn the
 * thirteenth. The one caller outside this module is the panel, which uses
 * `earn('found-door')` directly and would otherwise be the one path that could
 * complete the set without noticing.
 *
 * `COMPLETION` is excluded from its own requirement, which is not a detail: a
 * capstone that counted itself would be a set that never closes.
 *
 * It announces, unlike `found-door`. Finishing is worth saying out loud even to
 * someone looking straight at the list.
 */
export function sealIfComplete(): void {
  const done = new Set(earnedIds());
  const remaining = ACHIEVEMENTS.filter((a) => a.id !== COMPLETION && !done.has(a.id));
  if (remaining.length > 0) return;

  if (!earn(COMPLETION)) return;
  const capstone = ACHIEVEMENTS.find((a) => a.id === COMPLETION);
  if (capstone) announce(capstone.label, capstone.moment);
}
