/**
 * Palette presets for the source view.
 *
 * Each preset sets only the three seeds — background, foreground, accent. The
 * other nine tokens are `color-mix()` derivations in global.css and follow on
 * their own, which is the entire reason that derivation exists. Adding a preset
 * therefore means picking three colours, never ten.
 *
 * All presets are **dark**. This is not a light/dark toggle (CLAUDE.md is
 * explicit that there is no such thing here) — it is a recolouring toy in the
 * discovery layer. Dark is the base, it is what ships, and it is what every
 * first visit sees.
 *
 * Ephemeral by construction: the mechanism is a radio group, so a reload
 * restores the real palette with nothing to clear.
 */

export interface Theme {
  readonly id: string;
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
  readonly accent: string;
}

export const THEMES = [
  { id: 'default', label: 'default', bg: '#0b0c0e', fg: '#e6e7e9', accent: '#6ee7a8' },
  { id: 'amber', label: 'amber', bg: '#100e0b', fg: '#ece8e2', accent: '#f7c948' },
  { id: 'azure', label: 'azure', bg: '#0a0c10', fg: '#e4e7ec', accent: '#7aa2f7' },
  { id: 'violet', label: 'violet', bg: '#0d0b10', fg: '#e8e6ec', accent: '#c792ea' },
] as const satisfies readonly Theme[];

export const DEFAULT_THEME = THEMES[0];

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const weights = [0.2126, 0.7152, 0.0722];
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    sum += (weights[i] as number) * (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  }
  return sum;
}

/** WCAG 2.x contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type Grade = 'AAA' | 'AA' | 'below AA';

export function grade(ratio: number): Grade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'below AA';
}

/** `text 15.8:1 AAA  ·  accent 12.7:1 AAA` — one format, both readouts. */
export function readout(pairs: readonly (readonly [string, number])[]): string {
  return pairs
    .map(([label, ratio]) => `${label} ${ratio.toFixed(1)}:1 ${grade(ratio)}`)
    .join('  ·  ');
}

/**
 * Fails the build rather than shipping an unreadable preset.
 *
 * The site has a hard AA floor, and a palette feature is the one place a
 * careless change could quietly break it everywhere at once. Both seed pairings
 * are checked here; the nine derived tokens were measured across these presets
 * and clear their own floors, with `--color-accent-soft` deriving toward
 * `--color-fg-muted` precisely so it cannot fall below AA (see global.css).
 */
for (const theme of THEMES) {
  for (const [name, value] of [
    ['foreground', theme.fg],
    ['accent', theme.accent],
  ] as const) {
    const ratio = contrast(value, theme.bg);
    if (ratio < 4.5) {
      throw new Error(
        `Theme "${theme.id}" ${name} ${value} is ${ratio.toFixed(2)}:1 on ${theme.bg} — below the 4.5:1 AA floor.`,
      );
    }
  }
}

/**
 * The override rules, generated so the hex values are written exactly once.
 *
 * `html:has(#theme-x:checked)` reaches `:root` from a radio anywhere in the
 * document, which is what makes presets need no JavaScript at all. It is
 * emitted unlayered so it beats Tailwind's `@layer theme`, and it sets only the
 * seeds — the derived tokens are runtime `color-mix()` of these, so they move
 * on their own.
 *
 * The default is deliberately not emitted: it is the absence of an override.
 */
export const themeCss = THEMES.filter((t) => t.id !== DEFAULT_THEME.id)
  .map(
    (t) =>
      `html:has(#theme-${t.id}:checked){--color-bg:${t.bg};--color-fg:${t.fg};--color-accent:${t.accent}}`,
  )
  .join('');
