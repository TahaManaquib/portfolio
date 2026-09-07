/**
 * Where the terminal sits.
 *
 * The panel docks to one of three edges and the page gives way to it, the way
 * an editor's does. An overlay mode was built alongside this so the two could
 * be compared and **removed once push won** — on a side dock overlay simply
 * covered the hero, and at the bottom the two were nearly indistinguishable
 * because the page already scrolls behind the panel. Do not reintroduce it
 * without an explicit instruction.
 *
 * The dock and the per-axis sizes persist: they are UI preferences, the same
 * category as the panel size (CLAUDE.md).
 *
 * The sizing functions take the viewport explicitly rather than reading
 * `window`, so every clamp and default is callable from Node and tested
 * without a browser. Only `apply()` at the bottom touches the DOM.
 */

export type Dock = 'left' | 'bottom' | 'right';

export const DOCKS: readonly Dock[] = ['left', 'bottom', 'right'];

/** Bottom, and the only dock offered below SIDE_MIN_VIEWPORT. */
export const DEFAULT_DOCK: Dock = 'bottom';

export const isSide = (dock: Dock): boolean => dock !== 'bottom';

/* -------------------------------------------------------------------------- */
/* limits                                                                      */
/* -------------------------------------------------------------------------- */

/** Below this a bottom panel has no usable scrollback. */
export const MIN_HEIGHT = 120;

/**
 * Below this a side panel cannot hold a line of output worth reading. 80
 * columns of 13px mono is roughly 620px, so even a comfortable side dock wraps
 * constantly — 280 is the floor at which it is still a terminal rather than a
 * gutter.
 */
export const MIN_WIDTH = 280;

/**
 * What is left of the page at full size. For the bottom dock this is the strip
 * that keeps the resize handle grabbable and the nav visible; for a side dock
 * it is the same idea on the other axis. Neither may be zero, or the panel
 * becomes something you can open to full size and then not drag back.
 */
export const BOTTOM_RESERVE = 40;
export const SIDE_RESERVE = 120;

/**
 * A side dock below this viewport width leaves no usable page, so the dock is
 * forced back to the bottom. 40rem at the default root size.
 */
export const SIDE_MIN_VIEWPORT = 640;

export function minFor(dock: Dock): number {
  return isSide(dock) ? MIN_WIDTH : MIN_HEIGHT;
}

export function maxFor(dock: Dock, vw: number, vh: number): number {
  return isSide(dock)
    ? Math.max(MIN_WIDTH, vw - SIDE_RESERVE)
    : Math.max(MIN_HEIGHT, vh - BOTTOM_RESERVE);
}

/**
 * How big the panel is the first time it takes a given edge.
 *
 * Half the viewport is right for the bottom — that is the editor convention and
 * what the spec asks for — but half the *width* is not a terminal, it is a
 * split screen. Side panels in editors sit around 300-400px, so a side dock
 * opens at a fixed comfortable width instead, capped at half the window so a
 * narrow one does not open almost fully covered.
 */
export const SIDE_DEFAULT = 420;

export function defaultFor(dock: Dock, vw: number, vh: number): number {
  const wanted = isSide(dock) ? Math.min(SIDE_DEFAULT, Math.round(vw * 0.5)) : Math.round(vh * 0.5);
  return clampSize(dock, wanted, vw, vh);
}

export function clampSize(dock: Dock, px: number, vw: number, vh: number): number {
  return Math.min(Math.max(px, minFor(dock)), maxFor(dock, vw, vh));
}

/**
 * A side dock is not offered on a narrow viewport. Returned rather than
 * enforced at the call site so every consumer agrees, and so the command can
 * explain itself instead of silently ignoring the visitor.
 */
export function effectiveDock(dock: Dock, vw: number): Dock {
  return isSide(dock) && vw < SIDE_MIN_VIEWPORT ? 'bottom' : dock;
}

/* -------------------------------------------------------------------------- */
/* storage — untrusted on read, like everything else here                      */
/* -------------------------------------------------------------------------- */

const DOCK_KEY = 'taha:terminal-dock';
/**
 * Height and width are stored separately and deliberately. A 50dvh height is a
 * nonsense width, so one shared number would hand you a full-width side panel
 * or a 300px-tall bottom one the first time you switched.
 *
 * The height key predates the side docks and keeps its name, so a returning
 * visitor's stored height still applies.
 */
const HEIGHT_KEY = 'taha:terminal-height';
const WIDTH_KEY = 'taha:terminal-width';

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or quota — not worth failing the terminal over */
  }
}

export function loadDock(): Dock {
  const raw = readString(DOCK_KEY);
  return DOCKS.includes(raw as Dock) ? (raw as Dock) : DEFAULT_DOCK;
}

export function loadSize(dock: Dock): number | null {
  const raw = readString(isSide(dock) ? WIDTH_KEY : HEIGHT_KEY);
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export const saveDock = (dock: Dock): void => writeString(DOCK_KEY, dock);
export const saveSize = (dock: Dock, px: number): void =>
  writeString(isSide(dock) ? WIDTH_KEY : HEIGHT_KEY, String(px));

/* -------------------------------------------------------------------------- */
/* the DOM side                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Publishes the dock to the document root, where CSS does the rest.
 *
 * The layout consequences — the page giving way, the shared gutter measuring
 * the space it actually has, the corner controls stepping aside — are all
 * stylesheet rules keyed off this attribute and these two lengths. Nothing here
 * measures or positions anything itself, which is what kept the whole feature
 * a matter of attributes rather than a second layout engine.
 */
export function apply(dock: Dock, size: number): void {
  const root = document.documentElement;
  root.dataset.dock = dock;
  root.style.setProperty('--dock-w', isSide(dock) ? `${size}px` : '0px');
  root.style.setProperty('--dock-h', isSide(dock) ? '0px' : `${size}px`);
}
