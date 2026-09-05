import { site } from './site';

/**
 * The machine view's framing — the same content the page renders, presented as
 * an HTTP/JSON response.
 *
 * Defined here rather than inline in SourceView.astro so there is exactly one
 * place that decides what the machine view *looks* like. The `/api/whoami.json`
 * easter egg (Phase 3) is meant to share this shape, and this is what keeps the
 * two from drifting into unrelated jokes.
 *
 * Honesty rule (CLAUDE.md): this is a *representation*, not a claim that a
 * request occurred. No invented fields, no fabricated headers, no fake timings
 * — the request line, the status, the content type, and the real body.
 *
 * Note the split of responsibilities: SourceView renders the body as an
 * interactive tree straight from `site`, not from `machineBody`. The string
 * form below exists for consumers that need flat text.
 */
export const machineRequestLine = 'GET /taha';

export const machineStatusLines = ['200 OK', 'content-type: application/json'] as const;

/** Flat-text form of the body, for consumers that can't use the tree. */
export const machineBody = JSON.stringify(site, null, 2);

/** The whole response as plain text. */
export const machineView = [machineRequestLine, '', ...machineStatusLines, '', machineBody].join(
  '\n',
);
