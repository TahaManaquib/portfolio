/**
 * A brief, one-time line saying what was just found.
 *
 * **Why a notice and not the icon's state.** CLAUDE.md offers either, but the
 * icon cannot change: reading stored flags to render it would put content
 * JavaScript on the recruiter path, which is the one thing removing Phase 4
 * protected. So it is the notice, which the same section explicitly allows.
 *
 * **And why that does not break "no achievement mention on the homepage".**
 * That rule forbids *persistent* chrome — a counter, a badge, a permanent hint.
 * A line that appears once, for a few seconds, only for someone already inside
 * an island, is the thing the sentence beside it permits. There is no counter,
 * nothing stays behind, and a visitor who never opens anything never sees it.
 *
 * It costs the recruiter path nothing, because only the islands call it and the
 * markup is created here on demand rather than shipped in the page.
 *
 * It deliberately does **not** link to `/achievements`. It sits just above the
 * door instead, so it gestures at where the door is without handing it over —
 * finding it stays the achievement it is.
 */

/**
 * Long enough to read three short lines and look up, without becoming furniture.
 */
const HOLD_MS = 5000;
const LEAVE_MS = 240;

/**
 * Inlined rather than imported: this module is created at runtime by whichever
 * island awarded the achievement, so there is no Astro component to render into
 * it. Lucide's `shapes`, matching the door.
 */
const SHAPES_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
  'aria-hidden="true" focusable="false">' +
  '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/>' +
  '<rect x="3" y="14" width="7" height="7" rx="1"/>' +
  '<circle cx="17.5" cy="17.5" r="3.5"/>' +
  '</svg>';

let host: HTMLElement | null = null;

function ensureHost(): HTMLElement {
  if (host?.isConnected) return host;
  host = document.createElement('div');
  host.className = 'ac-notices';
  // Announced politely, not assertively: this must never interrupt whatever a
  // screen reader is in the middle of saying about the thing you actually did.
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  document.body.appendChild(host);
  return host;
}

/**
 * Shows one line. Called only when an achievement was newly earned, so it is
 * one-time by construction rather than by tracking anything here.
 *
 * **The entrance is a CSS animation with no JavaScript trigger**, deliberately.
 * The first version set a `data-shown` attribute inside `requestAnimationFrame`
 * to start a transition — and rAF is paused in a backgrounded tab, so an
 * achievement earned while the tab was not focused produced a notice that
 * stayed at `opacity: 0` for its whole life and was then removed. Nobody would
 * ever have seen it. An animation on insert plays whenever the tab is painted.
 *
 * Several can arrive together — `auth` with a forged token earns two — so they
 * stack rather than replacing each other. Nothing loops (CLAUDE.md).
 */
export function announce(label: string, moment: string): void {
  const card = document.createElement('div');
  card.className = 'ac-notice';

  const mark = document.createElement('span');
  mark.className = 'ac-notice-mark';
  mark.setAttribute('aria-hidden', 'true');
  // The same shape as the door, so the notice and the place it points at are
  // visibly the same thing.
  mark.innerHTML = SHAPES_SVG;

  const text = document.createElement('div');
  text.className = 'ac-notice-text';

  const kicker = document.createElement('p');
  kicker.className = 'ac-notice-kicker';
  kicker.textContent = 'Unlocked';

  const title = document.createElement('p');
  title.className = 'ac-notice-title';
  title.textContent = label;

  const sub = document.createElement('p');
  sub.className = 'ac-notice-moment';
  sub.textContent = moment;

  text.append(kicker, title, sub);
  card.append(mark, text);
  ensureHost().prepend(card);

  // A timer, not rAF: this one only has to happen eventually, and a clamped
  // timer in a background tab means the notice waits for the visitor rather
  // than expiring while they are not looking.
  window.setTimeout(() => {
    card.dataset.leaving = '';
    window.setTimeout(() => card.remove(), LEAVE_MS);
  }, HOLD_MS);
}
