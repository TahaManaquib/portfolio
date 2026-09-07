/**
 * The achievements panel — the third corner control, and what replaced the
 * `/achievements` route.
 *
 * **Why a panel and not a page.** The site is an SPA; a whole route for a
 * thirteen-row list was the one thing that was not. Three corner controls that
 * behave the same way read as one set, and folding the list into the homepage
 * removes the defect the route quietly carried: `/achievements` shipped the
 * entire `GET /taha` payload and a working source-view toggle, so pressing
 * `{ }` there swapped a page about achievements for JSON about Taha.
 *
 * **What that cost, stated plainly.** The route rendered all thirteen rows as
 * HTML and read correctly with JavaScript off; a panel built at runtime cannot.
 * Taha's call, and the loss is small: the list is *entirely* about per-visitor
 * state that only exists in localStorage, so JavaScript-off gave you a
 * catalogue and no progress anyway.
 *
 * Written in plain DOM rather than Preact. The list is thirteen static rows
 * whose only state is a boolean per row, decided once at open — a renderer
 * would be a dependency in this chunk earning nothing.
 *
 * It is **non-modal**, like the terminal: no focus trap, `Esc` closes and gives
 * focus back. The terminal and the source-view control stay live beside it, at
 * Taha's instruction — the best moment this feature has is watching a row tick
 * over while you work in the terminal, and hiding the button forecloses it.
 */
import { ACHIEVEMENTS, TOTAL } from '../../data/achievements';
import { earn, earnedIds, resetAchievements, sweepRetiredKeys } from './flags';
import { sealIfComplete } from './award';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * Lucide `check` and `circle-dashed`, inlined.
 *
 * `Icon.astro` cannot help here — it runs at build time and this markup is
 * created in the browser. Two paths rather than an icon font or a sprite sheet,
 * because two paths is all that is needed.
 */
const MARKS: Record<'done' | 'todo', string> = {
  done: '<path d="M20 6 9 17l-5-5"/>',
  todo:
    '<path d="M10.1 2.18a9.93 9.93 0 0 1 3.8 0"/><path d="M17.6 3.71a9.95 9.95 0 0 1 2.69 2.7"/>' +
    '<path d="M21.82 10.1a9.93 9.93 0 0 1 0 3.8"/><path d="M20.29 17.6a9.95 9.95 0 0 1-2.7 2.69"/>' +
    '<path d="M13.9 21.82a9.94 9.94 0 0 1-3.8 0"/><path d="M6.4 20.29a9.95 9.95 0 0 1-2.69-2.7"/>' +
    '<path d="M2.18 13.9a9.93 9.93 0 0 1 0-3.8"/><path d="M3.71 6.4a9.95 9.95 0 0 1 2.7-2.69"/>',
};

function icon(kind: 'done' | 'todo'): SVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = MARKS[kind];
  return svg;
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  // Always textContent, never innerHTML: labels are ours, but the habit is the
  // one that keeps an edited value from ever becoming markup (CLAUDE.md).
  if (text !== undefined) node.textContent = text;
  return node;
};

let panel: HTMLElement | null = null;
let opener: HTMLElement | null = null;
let open = false;

/**
 * "Reset" that asks once before doing it.
 *
 * Two steps rather than one, because the thing being destroyed took real effort
 * to build and an accidental click on a 60px button would take all of it. Two
 * rather than a `confirm()`, because a browser modal blocks the page, is styled
 * by the OS in a site with twelve identities, and is exactly the kind of dialog
 * this project avoids everywhere else.
 *
 * The armed state times out. A visitor who armed it and moved on should not
 * find a live destructive button waiting the next time they glance over.
 */
function resetControl(): HTMLElement {
  const button = el('button', 'ac-reset', 'Reset');
  button.type = 'button';

  let armed = 0;
  const disarm = () => {
    window.clearTimeout(armed);
    armed = 0;
    delete button.dataset.armed;
    button.textContent = 'Reset';
  };

  button.addEventListener('click', () => {
    if (!armed) {
      button.dataset.armed = '';
      button.textContent = 'Reset everything?';
      armed = window.setTimeout(disarm, 4000);
      return;
    }
    disarm();
    resetAchievements();
    // Repaint rather than rebuild: the rows are static, only their state moved.
    if (panel) paint(panel);
  });

  // Closing the panel disarms it too, so it never reopens mid-confirmation.
  button.addEventListener('blur', () => {
    if (armed) disarm();
  });

  return button;
}

/**
 * Builds the panel once. Rebuilt state — which rows are ticked — is applied on
 * every open instead, since an achievement can be earned while it is closed.
 */
function build(): HTMLElement {
  const root = el('div', 'ac-panel');
  root.id = 'achievements-panel';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Achievements');
  // Non-modal, and it says so: assistive tech should not treat the rest of the
  // page as inert, because it is not.
  root.setAttribute('aria-modal', 'false');

  const head = el('div', 'ac-panel-head');
  const heading = el('p', 'ac-panel-title', 'Achievements');
  const close = el('button', 'ac-panel-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close achievements');
  close.textContent = '×';
  close.addEventListener('click', () => hide());
  head.append(heading, close);

  const intro = el(
    'p',
    'ac-panel-intro',
    'Fourteen things this site will let you do. Most of them are not advertised anywhere else.',
  );

  const progress = el('div', 'ac-progress');
  const pips = el('ol', 'ac-pips');
  pips.setAttribute('aria-hidden', 'true');
  for (const achievement of ACHIEVEMENTS) {
    const pip = el('li', 'ac-pip');
    pip.dataset.pip = achievement.id;
    pips.append(pip);
  }
  const count = el('p', 'ac-count');
  count.dataset.count = '';
  progress.append(pips, count);

  const list = el('ol', 'ac-list');
  // A scroll container whose contents are not focusable cannot be scrolled by
  // keyboard at all — the rows are plain text, so without this a keyboard
  // visitor could open the panel and never reach past the second entry. Made
  // focusable with a name, which is what axe's scrollable-region-focusable
  // asks for and what actually fixes it.
  //
  // No `role` override here: an <ol> carries list semantics, and setting
  // `role="group"` on it orphaned all fourteen <li> children (axe: listitem).
  // A focusable, named list is still a list.
  list.tabIndex = 0;
  list.setAttribute('aria-label', 'Achievements');
  for (const achievement of ACHIEVEMENTS) {
    const row = el('li', 'ac-row');
    row.dataset.achievement = achievement.id;

    const mark = el('span', 'ac-mark');
    mark.setAttribute('aria-hidden', 'true');
    mark.append(icon('todo'), icon('done'));

    const body = el('span', 'ac-body');
    body.append(
      el('span', 'ac-label', achievement.label),
      el('span', 'ac-moment', achievement.moment),
    );

    row.append(mark, body);
    list.append(row);
  }

  const foot = el('div', 'ac-panel-foot');
  foot.append(
    el('p', 'ac-panel-note', 'Kept in this browser only. Nothing here is sent anywhere.'),
    resetControl(),
  );

  root.append(head, intro, progress, list, foot);
  document.body.append(root);

  // The source view swaps the whole page rather than docking, so a panel
  // floating over it would be nonsense. Closing on its toggle is the one bit of
  // coordination between the three controls — and it lives here, in a chunk
  // that only exists once the panel has been opened, rather than in the loader
  // on the recruiter path.
  document.getElementById('source-view')?.addEventListener('change', (event) => {
    if ((event.target as HTMLInputElement).checked) hide();
  });

  return root;
}

/** Marks the rows that are done. Read on every open, not cached. */
function paint(root: HTMLElement): void {
  const earned = new Set(earnedIds());

  for (const achievement of ACHIEVEMENTS) {
    const done = earned.has(achievement.id);
    const row = root.querySelector<HTMLElement>(`[data-achievement="${achievement.id}"]`);
    if (row) row.toggleAttribute('data-earned', done);
    const pip = root.querySelector<HTMLElement>(`[data-pip="${achievement.id}"]`);
    if (pip) pip.toggleAttribute('data-found', done);
  }

  const count = root.querySelector<HTMLElement>('[data-count]');
  const found = ACHIEVEMENTS.filter((a) => earned.has(a.id)).length;
  if (count) count.textContent = `${found} of ${TOTAL} found`;
}

function show(): void {
  panel ??= build();
  // Opening is the achievement — the control is unobtrusive enough that finding
  // it is the whole of it. `earn`, not `award`: a notice saying "Found the
  // door" on top of the panel that is showing that very row is telling someone
  // what is in front of them.
  earn('found-door');
  // Opening the panel can be the thirteenth thing, and this is the one path
  // that records without going through `award()` — so the seal is checked here
  // explicitly rather than left to the next island that happens to fire.
  sealIfComplete();
  sweepRetiredKeys();
  paint(panel);

  panel.dataset.open = '';
  open = true;
  opener?.setAttribute('aria-expanded', 'true');
  // Focus moves in, as it does for the terminal. Non-modal, so nothing is
  // trapped — Tab leaves the panel and that is correct.
  panel.querySelector<HTMLElement>('.ac-panel-close')?.focus();
}

function hide(): void {
  if (!panel) return;
  delete panel.dataset.open;
  open = false;
  opener?.setAttribute('aria-expanded', 'false');
  // Only take focus back if it is still inside the panel; a visitor who clicked
  // into the page has already moved on and should not be yanked back.
  if (panel.contains(document.activeElement)) opener?.focus();
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && open) hide();
});

/**
 * The loader's entry point, shaped like the terminal's so the two read the
 * same. Called once; the returned handle is cached by the loader.
 */
export function achievements(button: HTMLElement): {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
} {
  opener = button;
  return { open: show, close: hide, isOpen: () => open };
}
