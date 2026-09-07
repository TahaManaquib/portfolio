/**
 * Mounts the terminal on first use and hands back an open/close handle.
 *
 * The loader in TerminalLoader.astro dynamic-imports this module, so Preact and
 * the panel are one chunk that never touches the initial page load.
 *
 * Closing HIDES the panel rather than unmounting it. Unmounting threw away the
 * scrollback and the command history, so reopening looked like a brand new
 * session — wrong for something modelled on an editor terminal, where the panel
 * is still there with your output in it. `hidden` also drops the subtree out of
 * the tab order and the accessibility tree while closed, so nothing focusable
 * is reachable behind the scenes.
 */
import { render } from 'preact';
import Terminal from './Terminal';
import { sweepRetiredKeys } from '../achievements/flags';
import { award } from '../achievements/award';

let host: HTMLElement | null = null;
/** Where focus was before opening, so Esc can put it back. */
let lastFocused: HTMLElement | null = null;

const isOpen = () => host !== null && !host.hasAttribute('hidden');

function ensureMounted(): HTMLElement {
  if (host) return host;
  host = document.createElement('div');
  host.className = 'term-host';
  host.setAttribute('hidden', '');
  document.body.appendChild(host);
  render(<Terminal onClose={close} />, host);
  return host;
}

function focusInput(): void {
  requestAnimationFrame(() => host?.querySelector<HTMLInputElement>('#term-input')?.focus());
}

/**
 * Every dock layout rule is gated on this attribute, so closing the panel puts
 * the page back without the component having to unwind its own CSS variables —
 * and without push mode leaving a gap where a closed terminal used to be.
 */
function markOpen(open: boolean): void {
  if (open) document.documentElement.dataset.termOpen = '';
  else delete document.documentElement.dataset.termOpen;

  // The opener's state is published here rather than in the loader, because the
  // panel can be opened and closed by things the loader never sees: ⌘K, `Esc`,
  // the panel's own close button, and `open <section>`, which closes it so the
  // page it just scrolled is not hidden behind it. Setting the attribute at the
  // one place that knows the truth is what keeps the button honest in all of
  // them. The highlight itself is CSS on `[data-term-open]` and needs none of
  // this — the attribute is for assistive tech.
  for (const el of document.querySelectorAll('[data-terminal-open]')) {
    el.setAttribute('aria-expanded', String(open));
  }
}

function open(): void {
  if (isOpen()) {
    focusInput();
    return;
  }
  lastFocused = document.activeElement as HTMLElement | null;
  ensureMounted().removeAttribute('hidden');
  markOpen(true);
  focusInput();

  // The first step into the discovery layer, and the cheapest achievement on
  // the list on purpose — a list whose easiest entry is hard has no on-ramp.
  award('terminal-opened');
  // Whichever island loads first tidies up after the removed features.
  sweepRetiredKeys();
}

function close(): void {
  if (!isOpen()) return;
  host?.setAttribute('hidden', '');
  markOpen(false);
  lastFocused?.focus();
  lastFocused = null;
}

/**
 * `open <section>` has to close the panel before it scrolls — at full height
 * the terminal covers the page, so scrolling behind it would look like the
 * command did nothing.
 *
 * An event rather than a direct call: `commands.ts` importing this module would
 * close the loop mount -> Terminal -> commands -> mount, and a circular import
 * here is not worth the convenience of one function reference.
 */
window.addEventListener('taha:close-terminal', () => close());

export function terminal(): { open: () => void; close: () => void; isOpen: () => boolean } {
  return { open, close, isOpen };
}
