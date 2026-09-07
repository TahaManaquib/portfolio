/**
 * Palette presets for the source view.
 *
 * Each preset sets only the three seeds — background, foreground, accent. The
 * other nine tokens are `color-mix()` derivations in global.css and follow on
 * their own, which is the entire reason that derivation exists. A preset is
 * therefore three colours, never ten.
 *
 * **The presets are generated from a single hue** (3.6e). A palette was already
 * "one hue plus a rule", so the rule is written down here and applied to a list
 * of hues instead of three hex values being picked by eye per palette. That is
 * what makes a dozen options safe where a free colour picker was not: the
 * visitor chooses a hue, the system chooses everything else.
 *
 * All presets are **dark**. This is not a light/dark toggle (CLAUDE.md is
 * explicit that there is no such thing here) — it is a recolouring toy in the
 * discovery layer. Dark is the base, it is what ships, and it is what every
 * first visit sees.
 *
 * Ephemeral by construction: the mechanism is a radio group, so a reload
 * restores the real palette with nothing to clear.
 *
 * This module has no imports on purpose. It runs at build time only, and
 * staying dependency-free is what lets Node's type-stripping loader import it
 * directly in the tests (see `src/data/secret.ts` for the same constraint).
 */

export type Polarity = 'dark' | 'light';

export interface Theme {
  readonly id: string;
  readonly label: string;
  readonly polarity: Polarity;
  readonly bg: string;
  readonly fg: string;
  readonly accent: string;
}

/* -------------------------------------------------------------------------- */
/* colour maths — OKLab/OKLCH <-> sRGB                                         */
/* -------------------------------------------------------------------------- */

/**
 * Why OKLCH and not HSL: OKLab's lightness is perceptually uniform, so one
 * recipe applied at every hue produces palettes of genuinely equal lightness.
 * In HSL, yellow at 70% lightness is far brighter than blue at 70%, so a single
 * recipe would swing wildly across the wheel and some hues would land below the
 * contrast floor while others washed out. Perceptual uniformity is precisely
 * what stops generated palettes looking arbitrary.
 *
 * Matrices are Björn Ottosson's published OKLab conversion.
 */

interface Lab {
  readonly L: number;
  readonly a: number;
  readonly b: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** sRGB transfer function, linear -> encoded. */
function encodeGamma(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/** sRGB transfer function, encoded -> linear. */
function decodeGamma(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function labToLinearRgb({ L, a, b }: Lab): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearRgbToLab(r: number, g: number, b: number): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** True when an OKLab colour survives the trip to sRGB without clipping. */
function inGamut(lab: Lab): boolean {
  const eps = 1e-4;
  return labToLinearRgb(lab).every((v) => v >= -eps && v <= 1 + eps);
}

function labToHex(lab: Lab): string {
  return (
    '#' +
    labToLinearRgb(lab)
      .map((v) => {
        const byte = Math.round(clamp01(encodeGamma(clamp01(v))) * 255);
        return byte.toString(16).padStart(2, '0');
      })
      .join('')
  );
}

export function hexToLab(hex: string): Lab {
  const [r, g, b] = [0, 2, 4].map((i) =>
    decodeGamma(parseInt(hex.slice(1 + i, 3 + i), 16) / 255),
  ) as [number, number, number];
  return linearRgbToLab(r, g, b);
}

/**
 * OKLCH -> hex, reducing chroma until the colour fits in sRGB.
 *
 * Without this, a saturated hue at a fixed chroma silently clips per channel,
 * which shifts its hue as well as its saturation — the generated blue would not
 * be the blue the recipe asked for. Binary search keeps as much chroma as the
 * gamut allows and gives up the rest.
 */
export function oklch(L: number, C: number, hueDeg: number): string {
  const rad = (hueDeg * Math.PI) / 180;
  const at = (c: number): Lab => ({ L, a: c * Math.cos(rad), b: c * Math.sin(rad) });

  if (inGamut(at(C))) return labToHex(at(C));

  let lo = 0;
  let hi = C;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(at(mid))) lo = mid;
    else hi = mid;
  }
  return labToHex(at(lo));
}

/**
 * The same interpolation `color-mix(in oklab, a P%, b)` performs, so the
 * validator below can check a token that only exists at runtime.
 */
export function mixOklab(a: string, b: string, weightA: number): string {
  const A = hexToLab(a);
  const B = hexToLab(b);
  const w = weightA;
  return labToHex({
    L: A.L * w + B.L * (1 - w),
    a: A.a * w + B.a * (1 - w),
    b: A.b * w + B.b * (1 - w),
  });
}

/* -------------------------------------------------------------------------- */
/* the recipe                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One hue in, three seeds out.
 *
 * The lightnesses come from the default palette, which was picked by eye and is
 * the thing every generated sibling has to sit beside without looking out of
 * place. The backgrounds and foregrounds carry a trace of the hue rather than
 * being neutral — that tint is what makes amber feel warm and azure cool, and
 * it is the difference between "a palette" and "the same grey site with a
 * different button colour".
 */
const RECIPES = {
  /**
   * L and C here are measured, not chosen by taste.
   *
   * sRGB is not equally wide at every hue, so a chroma one hue can hold will be
   * clipped at another — and a set where indigo keeps 0.089 while amber keeps
   * 0.145 does not read as one family. The fix is to pick the lightness at
   * which the *narrowest* hue can hold the most, and give every hue exactly
   * that: below 0.74 teal is the limiting hue, above it indigo is, and the two
   * curves cross right here. Every accent is then identical in lightness and
   * chroma and differs only in hue, which is what makes them siblings.
   *
   * 0.74/0.125 leaves every dark accent at about 8:1 on its background —
   * comfortably AAA, with the floor asserted below rather than assumed.
   */
  dark: {
    accent: { L: 0.74, C: 0.125 },
    /** Barely tinted. Above ~0.02 chroma the ground starts to read as coloured. */
    bg: { L: 0.16, C: 0.012 },
    fg: { L: 0.925, C: 0.008 },
  },

  /**
   * The light ground is the harder of the two, and the numbers say why.
   *
   * Contrasting against near-white needs a *dark* accent, and dark colours hold
   * less chroma in sRGB. Running the same sweep as above: the most chroma every
   * hue can share is 0.091 at L=0.53, but that lands on 4.6:1 — AA with no
   * headroom at all, where a single rounding difference matters. L=0.45 trades
   * some of that colour for room: C=0.077 at 6.6:1, with the derived text
   * accent at 5.9:1.
   *
   * So light palettes are measurably less vivid than their dark counterparts.
   * That is the colour space, not a compromise in the recipe, and it is better
   * stated than discovered.
   */
  light: {
    accent: { L: 0.45, C: 0.077 },
    bg: { L: 0.97, C: 0.006 },
    fg: { L: 0.28, C: 0.012 },
  },
} as const;

/**
 * The hues offered, in wheel order, each with the ground it is built on.
 * ~158 is left out: `default` sits there.
 *
 * Six dark and six light, counting `default`. **The site still ships dark, and
 * every first visit is dark** — the four the source view labels are all dark,
 * and every light identity is reachable only from the terminal. That is the
 * line that keeps this a set of themes rather than the light/dark toggle
 * CLAUDE.md rules out: there is no brightness control anywhere a recruiter
 * goes.
 */
const HUES: readonly (readonly [string, number, Polarity])[] = [
  // Ordered in pairs — each shape's dark identity followed by its light one —
  // so the twelve read as six looks everywhere they are listed, not only in
  // the terminal where the grouping is explicit. `default` is the dark half of
  // `clean` and is declared above.
  ['fern', 140, 'light'], //     clean
  ['amber', 75, 'dark'], //      terminal
  ['ember', 45, 'light'],
  ['azure', 235, 'dark'], //     editorial
  ['moss', 110, 'light'],
  ['violet', 295, 'dark'], //    brutal
  ['orchid', 320, 'light'],
  ['teal', 195, 'dark'], //      blueprint
  ['indigo', 268, 'light'],
  ['crimson', 15, 'dark'], //    soft
  ['rose', 350, 'light'],
];

function generate(label: string, hue: number, polarity: Polarity): Theme {
  const recipe = RECIPES[polarity];
  return {
    id: label,
    label,
    polarity,
    bg: oklch(recipe.bg.L, recipe.bg.C, hue),
    fg: oklch(recipe.fg.L, recipe.fg.C, hue),
    accent: oklch(recipe.accent.L, recipe.accent.C, hue),
  };
}

/**
 * `default` is not generated. It is the palette the site actually ships, the
 * one every first visit sees, and the CSS below deliberately emits nothing for
 * it — selecting it is the absence of an override rather than an override back
 * to the original. Regenerating it would mean the shipped colours drifted every
 * time the recipe was tuned.
 */
export const THEMES = [
  {
    id: 'default',
    label: 'default',
    polarity: 'dark',
    bg: '#0b0c0e',
    fg: '#e6e7e9',
    accent: '#6ee7a8',
  },
  ...HUES.map(([label, hue, polarity]) => generate(label, hue, polarity)),
] as const satisfies readonly Theme[];

export const DEFAULT_THEME = THEMES[0];

/**
 * The palettes the source view puts on screen.
 *
 * All twelve exist and all twelve work; only these four are *advertised*. A row
 * of a dozen names crowds a strip meant to be quiet, and the four here are the
 * ones that read as distinct identities rather than neighbouring hues — the
 * warm one, the cool one, the purple one, and what ships.
 *
 * **The rest are not removed, they are unlisted**, and the terminal's `theme`
 * command reaches every one of them. That works because the radios and their
 * labels are already separate in the markup: the source view renders all twelve
 * radios (they are `sr-only`) and only these four labels, so a palette with no
 * label on screen is still selectable — by the terminal, or by anyone reading
 * the source. It is the same shape as the terminal's own hidden command.
 */
export const FEATURED: readonly string[] = ['default', 'amber', 'azure', 'violet'];

/* -------------------------------------------------------------------------- */
/* vibes                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A vibe is a whole character, not three colours (CLAUDE.md 3.6f).
 *
 * The featured four keep their colour names, at Taha's request — the names were
 * the thing he liked about the control, and "amber" naming a warm mono identity
 * reads fine. Each carries typography, density and border treatment on top of
 * its palette, so selecting one changes the site's feel rather than its hue.
 *
 * `default` has no entry: it is the absence of an override, exactly as it is for
 * the palette. Every value below is a token the page already reads, so nothing
 * in any component needs to know that vibes exist.
 */
export interface Vibe {
  /** What body copy is set in. Headings follow unless `display` overrides. */
  readonly body?: string;
  readonly display?: string;
  /** Tailwind v4's base spacing unit. Every p-*, gap-* and m-* derives from it. */
  readonly spacing?: string;
  readonly radius?: string;
  readonly radiusLg?: string;
  readonly borderW?: string;
  readonly borderStyle?: string;
  readonly displaySize?: string;
  readonly displayTracking?: string;
  readonly displayCase?: string;
  readonly displayWeight?: string;
  /** Layout. An identity may move where the page sits, not only how it looks. */
  readonly align?: string;
  readonly justify?: string;
  readonly measureMx?: string;
  readonly labelCols?: string;
  /** The page ground. Built from color-mix on the seeds, so it follows polarity. */
  readonly ground?: string;
  readonly groundSize?: string;
  readonly groundRepeat?: string;
}

/**
 * The six shapes, defined once each.
 *
 * A shape is worn by two themes — one dark, one light — so this is keyed by
 * shape rather than by theme. Twelve separate definitions would be twelve
 * chances for a pair to drift apart, and the pairing is the point: the same
 * design, seen on two different grounds.
 *
 * `clean` has no entry. It is the absence of every override, which is what
 * makes the shipped site the thing all of this departs from.
 */
export const SHAPES: Readonly<Record<string, Vibe>> = {
  /**
   * Amber phosphor / a receipt printer. Mono everywhere, square, tight, with
   * scanlines and a glow pooling out of the top of the page. The display size
   * is pulled *down* because a monospace face at the default clamp is far wider
   * than Inter and the hero would overflow a phone.
   */
  terminal: {
    body: 'var(--font-mono)',
    spacing: '0.22rem',
    radius: '0',
    radiusLg: '0',
    displaySize: 'clamp(1.6rem, 1.05rem + 2.9vw, 2.75rem)',
    displayTracking: '0.02em',
    displayWeight: '700',
    ground: [
      'radial-gradient(90% 45% at 50% 0%, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 70%)',
      'repeating-linear-gradient(180deg, color-mix(in oklab, var(--color-fg) 5%, transparent) 0 1px, transparent 1px 3px)',
    ].join(','),
    groundSize: '100% 700px, auto',
    groundRepeat: 'no-repeat, repeat',
  },

  /**
   * A magazine. The one identity built around the headline rather than the
   * layout: a serif at up to 6rem, thin, centred, with the labels stacked above
   * their content instead of sitting in a column beside it — which is the
   * change that stops it reading as the same page in a different font.
   */
  editorial: {
    display: "'Newsreader Variable', Georgia, serif",
    spacing: '0.32rem',
    radius: '0',
    radiusLg: '0',
    borderW: '1px',
    displaySize: 'clamp(2.8rem, 1.4rem + 7vw, 6rem)',
    displayTracking: '-0.03em',
    displayWeight: '300',
    align: 'center',
    justify: 'center',
    measureMx: 'auto',
    labelCols: '1fr',
    ground:
      'radial-gradient(120% 60% at 50% 100%, color-mix(in oklab, var(--color-accent) 8%, transparent), transparent 60%)',
    groundSize: '100% 100%',
    groundRepeat: 'no-repeat',
  },

  /**
   * A poster. Archivo at its heaviest, headings in caps at nearly 5rem, every
   * rule tripled, and hard diagonal bands across the ground — no soft edges
   * anywhere, which is the whole point of it.
   */
  brutal: {
    body: "'Archivo Variable', Helvetica, sans-serif",
    spacing: '0.24rem',
    radius: '0',
    radiusLg: '0',
    borderW: '3px',
    displaySize: 'clamp(2.2rem, 1rem + 6vw, 4.75rem)',
    displayTracking: '-0.05em',
    displayCase: 'uppercase',
    displayWeight: '900',
    ground:
      'repeating-linear-gradient(135deg, color-mix(in oklab, var(--color-accent) 7%, transparent) 0 2px, transparent 2px 14px)',
  },

  /**
   * A drawing rather than a page. A technical grotesk on a drafting grid, every
   * border dashed, with a heavier major gridline every fifth square so the
   * sheet has structure instead of being uniform graph paper.
   */
  blueprint: {
    body: "'Space Grotesk Variable', ui-sans-serif, sans-serif",
    radius: '0',
    radiusLg: '0',
    borderStyle: 'dashed',
    displayTracking: '-0.02em',
    displayWeight: '600',
    ground: [
      'linear-gradient(color-mix(in oklab, var(--color-fg) 9%, transparent) 1px, transparent 1px)',
      'linear-gradient(90deg, color-mix(in oklab, var(--color-fg) 9%, transparent) 1px, transparent 1px)',
      'linear-gradient(color-mix(in oklab, var(--color-fg) 4%, transparent) 1px, transparent 1px)',
      'linear-gradient(90deg, color-mix(in oklab, var(--color-fg) 4%, transparent) 1px, transparent 1px)',
    ].join(','),
    groundSize: '160px 160px, 160px 160px, 32px 32px, 32px 32px',
  },

  /**
   * The one Taha liked most, pushed further. A rounded face, everything centred
   * and generously spaced, corners at 20px, and a three-stop wash that fades
   * accent into foreground across the top of the page rather than a single
   * flat tint.
   */
  soft: {
    body: "'Nunito Variable', ui-rounded, sans-serif",
    spacing: '0.3rem',
    radius: '20px',
    radiusLg: '24px',
    displayTracking: '-0.025em',
    displayWeight: '800',
    align: 'center',
    justify: 'center',
    measureMx: 'auto',
    ground: [
      'radial-gradient(90% 55% at 15% 0%, color-mix(in oklab, var(--color-accent) 26%, transparent), transparent 65%)',
      'radial-gradient(80% 50% at 85% 8%, color-mix(in oklab, var(--color-fg) 12%, transparent), transparent 60%)',
      'radial-gradient(120% 70% at 50% 0%, color-mix(in oklab, var(--color-accent) 12%, transparent), transparent 75%)',
    ].join(','),
    groundSize: '100% 1100px',
    groundRepeat: 'no-repeat',
  },
};

/**
 * Which theme wears which shape. Every shape appears exactly twice — once on a
 * dark ground and once on a light one — which is what makes twelve identities
 * out of six designs rather than twelve half-ideas.
 *
 * The pairings are not arbitrary: blueprint is indigo on white because that is
 * what a whiteprint is, editorial is a serif on warm paper, and terminal is
 * amber phosphor on dark and a receipt on light.
 */
export const SHAPE_OF: Readonly<Record<string, string>> = {
  // dark            light
  amber: 'terminal',
  ember: 'terminal',
  azure: 'editorial',
  moss: 'editorial',
  violet: 'brutal',
  orchid: 'brutal',
  teal: 'blueprint',
  indigo: 'blueprint',
  crimson: 'soft',
  rose: 'soft',
  // `default` and `fern` wear `clean`, which is no entry at all.
};

/** Theme id -> its shape's tokens. Derived, so a pair cannot drift. */
export const VIBES: Readonly<Record<string, Vibe>> = Object.fromEntries(
  Object.entries(SHAPE_OF).map(([theme, shape]) => [theme, SHAPES[shape] as Vibe]),
);

/**
 * A vibe must name a theme that exists.
 *
 * This guard used to require a *featured* theme, on the reasoning that only a
 * labelled palette could be selected. That stopped being true once the terminal
 * grew `theme <name>`: an unlisted identity is reachable, just not advertised.
 * What is still worth catching is a typo, which would otherwise be a vibe that
 * silently applies to nothing.
 */
for (const [theme, shape] of Object.entries(SHAPE_OF)) {
  if (!THEMES.some((t) => t.id === theme)) {
    throw new Error(`"${theme}" wears a shape but is not a theme — check the id.`);
  }
  if (!SHAPES[shape]) {
    throw new Error(`"${theme}" wears the shape "${shape}", which is not defined.`);
  }
}

/**
 * What a light ground needs beyond its three seeds.
 *
 * `color-scheme` is the important one and it is not cosmetic: without it the
 * browser keeps painting scrollbars, form controls and the canvas underlay for
 * a dark page, and a light theme looks broken around its edges rather than
 * merely unusual. It has to be the CSS property rather than the `<meta>` tag,
 * because a meta tag cannot respond to which radio is checked — the property
 * overrides it, so the meta stays as the pre-CSS default.
 *
 * The panel shadows are an 85% black glow, which reads as depth on a dark
 * ground and as a smudge on a light one.
 */
function polarityDeclarations(theme: Theme): string {
  if (theme.polarity === 'dark') return '';
  return 'color-scheme:light;--shadow-color:rgb(0 0 0 / 16%);';
}

/** The tokens a shape writes, paired with the CSS property each one sets. */
const VIBE_TOKENS: readonly (readonly [keyof Vibe, string])[] = [
  ['body', '--font-body'],
  ['display', '--font-display'],
  ['spacing', '--spacing'],
  ['radius', '--radius'],
  ['radiusLg', '--radius-lg'],
  ['borderW', '--border-w'],
  ['borderStyle', '--border-style'],
  // Tailwind keeps its own copy for the border utilities; both or neither.
  ['borderStyle', '--tw-border-style'],
  ['displaySize', '--text-display'],
  ['displayTracking', '--text-display--letter-spacing'],
  ['displayCase', '--display-case'],
  ['displayWeight', '--display-weight'],
  ['align', '--layout-align'],
  ['justify', '--layout-justify'],
  ['measureMx', '--layout-mx'],
  ['labelCols', '--label-cols'],
  ['ground', '--vibe-bg'],
  ['groundSize', '--vibe-bg-size'],
  ['groundRepeat', '--vibe-bg-repeat'],
];

function vibeDeclarations(id: string): string {
  const vibe = VIBES[id];
  if (!vibe) return '';
  return VIBE_TOKENS.map(([key, prop]) => (vibe[key] ? `${prop}:${vibe[key]};` : '')).join('');
}

/* -------------------------------------------------------------------------- */
/* contrast                                                                    */
/* -------------------------------------------------------------------------- */

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const weights = [0.2126, 0.7152, 0.0722];
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    sum += (weights[i] as number) * decodeGamma(v);
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
 * The derived token that carries real text, reconstructed here so it can be
 * checked. global.css defines:
 *
 *   --color-fg-muted:    color-mix(in oklab, fg 64%, bg)
 *   --color-accent-soft: color-mix(in oklab, accent 65%, fg-muted)
 *
 * `accent-soft` exists for small text that must not be plain foreground, which
 * makes it the one derived value that can quietly drop below AA. With four
 * hand-picked palettes it was measured by hand; with a dozen generated ones it
 * has to be computed, or the floor is being asserted on faith.
 */
export function accentSoft(theme: Theme): string {
  return mixOklab(theme.accent, mixOklab(theme.fg, theme.bg, 0.64), 0.65);
}

/**
 * Fails the build rather than shipping an unreadable palette.
 *
 * The site has a hard AA floor, and a palette feature is the one place a
 * careless change could break it everywhere at once. Both seeds and the derived
 * text accent are checked; `--color-accent-dim` is deliberately not, because it
 * is decorative only and documented as never carrying text.
 */
const AA = 4.5;

for (const theme of THEMES) {
  const checks: readonly (readonly [string, string])[] = [
    ['foreground', theme.fg],
    ['accent', theme.accent],
    ['derived accent-soft', accentSoft(theme)],
  ];
  for (const [name, value] of checks) {
    const ratio = contrast(value, theme.bg);
    if (ratio < AA) {
      throw new Error(
        `Palette "${theme.id}" ${name} ${value} is ${ratio.toFixed(2)}:1 on ${theme.bg} — below the ${AA}:1 AA floor.`,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* the generated stylesheet                                                    */
/* -------------------------------------------------------------------------- */

const OVERRIDES = THEMES.filter((t) => t.id !== DEFAULT_THEME.id);

/**
 * Every per-palette rule, generated so no hex and no selector is written twice.
 *
 * `html:has(#theme-x:checked)` reaches `:root` from a radio anywhere in the
 * document, which is what makes presets need no JavaScript at all. It is
 * emitted unlayered so it beats Tailwind's `@layer theme`, and it sets only the
 * seeds — the derived tokens are runtime `color-mix()` of these, so they move
 * on their own.
 *
 * The three sibling-combinator blocks used to be hand-written in
 * SourceView.astro, four lines each. A sibling combinator cannot be
 * parameterised in CSS, so at a dozen palettes that became three dozen lines
 * kept in step by hand — exactly the drift this file exists to prevent.
 */
export const themeCss = [
  // Seeds, plus the vibe tokens for the featured four. One selector carries the
  // whole identity — colour, type, density and borders together — which is what
  // makes a vibe a single thing rather than four settings that happen to agree.
  // The default is the absence of an override, so it is not emitted.
  ...OVERRIDES.map(
    (t) =>
      `html:has(#theme-${t.id}:checked){--color-bg:${t.bg};--color-fg:${t.fg};--color-accent:${t.accent};${polarityDeclarations(t)}${vibeDeclarations(t.id)}}`,
  ),

  // The selected palette's own label. Note this uses the accent tokens, which
  // the rule above has just repointed — so the active label is drawn in the
  // colour it selects, without needing to know the hex. Only the featured
  // palettes have a label to draw.
  `${FEATURED.map((id) => `#theme-${id}:checked~.head label[for="theme-${id}"]`).join(',')}{color:var(--color-accent);border-color:var(--color-accent-dim)}`,

  // Keyboard focus.
  `${FEATURED.map((id) => `#theme-${id}:focus-visible~.head label[for="theme-${id}"]`).join(',')}{outline:2px solid var(--color-accent);outline-offset:2px}`,

  // Only the selected palette's contrast figures are shown — and every palette
  // needs a rule, not just the featured ones: the terminal can select an
  // unlisted palette and the readout is not optional (CLAUDE.md).
  `${THEMES.map((t) => `#theme-${t.id}:checked~.head .ct-${t.id}`).join(',')}{display:inline}`,
].join('');
