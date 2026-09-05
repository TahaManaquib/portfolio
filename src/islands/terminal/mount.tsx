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

function open(): void {
  if (isOpen()) {
    focusInput();
    return;
  }
  lastFocused = document.activeElement as HTMLElement | null;
  ensureMounted().removeAttribute('hidden');
  focusInput();
}

function close(): void {
  if (!isOpen()) return;
  host?.setAttribute('hidden', '');
  lastFocused?.focus();
  lastFocused = null;
}

export function terminal(): { open: () => void; close: () => void; isOpen: () => boolean } {
  return { open, close, isOpen };
}
