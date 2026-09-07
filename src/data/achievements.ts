/**
 * The fourteen achievements, in the order they are listed.
 *
 * Approved by Taha after an audit of ~40 reachable moments; see PHASES.md
 * Phase 5 step 1 for what was cut and why. Ordered easy → hard, and the order
 * is the list's only structure — a single flat list, no categories (CLAUDE.md).
 *
 * **Every trigger lives inside one of the three on-demand islands** — the
 * terminal, the source view's editor, or the permission sandbox. That is a hard
 * constraint rather than a coincidence: a trigger on the homepage itself would
 * need JavaScript on the recruiter path, which is exactly what removing Phase 4
 * protected. It is why "found the 404", "clicked View source" and "downloaded
 * the résumé" are not here, and must not be added.
 *
 * This module has no imports on purpose, so Node's type-stripping loader can
 * read it directly in the tests — the same constraint `secret.ts` works under.
 */

export interface Achievement {
  /** Stored flag id. Never change one: it would un-earn it for every visitor. */
  readonly id: string;
  /**
   * Always shown. Greyed until earned, never hidden — changed from `???`.
   *
   * **Present tense, at Taha's request**, like `moment` below. The list is read
   * far more often as a checklist of what is left than as a trophy case, and
   * past tense told an unearned row it had already happened. Three entries are
   * noun phrases with no tense to change — `Daylight`, `Clean slate`,
   * `Same state, two doors`, `Nothing left to find` — and they stay as they are.
   */
  readonly label: string;
  /**
   * What it takes, shown alongside the label whether earned or not, and
   * therefore phrased as the thing to do rather than the thing that happened.
   */
  readonly moment: string;
  /**
   * Which island writes the flag. Documentation, and asserted in the tests.
   *
   * `achievements` is the panel itself. It used to be a separate route; it is
   * now the third on-demand island, fetched on the first click of the door, so
   * the constraint above still holds — nothing about achievements is in the
   * initial page but the button.
   */
  readonly island: 'terminal' | 'source' | 'sandbox' | 'achievements';
}

export const ACHIEVEMENTS = [
  // Ordered easy → hard, and the ordering is the only signal: there are no
  // difficulty labels on the page, deliberately. A visitor should feel the list
  // getting harder rather than be told which tier they are in.
  //
  // Roughly: the first four are one click or one command once you are inside;
  // the middle four need you to notice something nobody pointed at; the last
  // five need either real persistence or an actual insight.

  // — a click or a command away
  {
    id: 'terminal-opened',
    label: 'Open a channel',
    moment: 'open the terminal',
    island: 'terminal',
  },
  {
    id: 'edited-value',
    label: 'Rewrite the page',
    moment: 'edit a value in the payload',
    island: 'source',
  },
  {
    id: 'used-a-tool',
    label: "Use it, don't just read it",
    moment: 'run one of the terminal’s real tools',
    island: 'terminal',
  },
  {
    id: 'solved-a-brief',
    label: 'Give them what they need',
    moment: 'satisfy a brief',
    island: 'sandbox',
  },

  // — you had to notice something
  {
    id: 'found-door',
    label: 'Find the door',
    moment: 'find the way to this list',
    island: 'achievements',
  },
  {
    id: 'grew-payload',
    label: 'Grow the payload',
    moment: 'add an object to an array',
    island: 'source',
  },
  {
    id: 'found-daylight',
    label: 'Daylight',
    moment: 'find one of the six light identities',
    island: 'terminal',
  },
  {
    id: 'found-leak',
    label: 'Find the leak',
    moment: 'run a command that only the payload names',
    island: 'terminal',
  },

  // — persistence, or a leap
  {
    id: 'authorised',
    label: 'Get authorised',
    moment: 'present a token that verifies',
    island: 'terminal',
  },
  {
    id: 'clean-slate',
    label: 'Clean slate',
    moment: 'empty the payload completely',
    island: 'source',
  },
  {
    id: 'two-doors',
    label: 'Same state, two doors',
    moment: 'change the page from one surface and undo it from the other',
    island: 'source',
  },
  {
    id: 'cleared-board',
    label: 'Clear the board',
    moment: 'solve every brief',
    island: 'sandbox',
  },
  {
    id: 'minted-own',
    label: 'Mint your own',
    moment: 'sign a token yourself',
    island: 'terminal',
  },
  /**
   * The capstone, added at Taha's request. It is last because it cannot be
   * anything else: it is the only entry whose requirement is every other entry.
   *
   * It is deliberately **not** counted toward itself — see `COMPLETION` and
   * `sealIfComplete()` in `award.ts`. Requiring all fourteen to earn the
   * fourteenth is a set that can never close.
   *
   * `island: 'achievements'` because that is where the check lives, not because
   * the panel is what earns it: the last of the other thirteen can be earned
   * inside any island, and the seal follows immediately wherever that happens.
   */
  {
    id: 'all-found',
    label: 'Nothing left to find',
    moment: 'earn everything else on this list',
    island: 'achievements',
  },
] as const satisfies readonly Achievement[];

export const TOTAL = ACHIEVEMENTS.length;

/**
 * The capstone's id, and the one entry that must be excluded when asking
 * whether everything has been found.
 */
export const COMPLETION = 'all-found';

/** Ids are the storage contract, so a duplicate would silently merge two. */
const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
if (ids.size !== ACHIEVEMENTS.length) {
  throw new Error('Duplicate achievement id — ids are the stored flag names.');
}
