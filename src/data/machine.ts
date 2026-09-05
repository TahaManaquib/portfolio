/**
 * The machine view's framing — the same content the page renders, presented as
 * an HTTP/JSON response.
 *
 * Defined here rather than inline in SourceView.astro so there is exactly one
 * place that decides what the machine view *looks* like.
 *
 * Honesty rule (CLAUDE.md): this is a *representation*, not a claim that a
 * request occurred. No invented fields, no fabricated headers, no fake timings
 * — the request line, the status, the content type, and the real body.
 *
 * SourceView renders the body as an interactive tree straight from `site`, so
 * only the framing lives here. There was a flat-text form too, for the
 * terminal's `curl` — that command is gone, and it went with it.
 */
export const machineRequestLine = 'GET /taha';

export const machineStatusLines = ['200 OK', 'content-type: application/json'] as const;
