/**
 * Mounts the permission sandbox over the static markup in Access.astro.
 *
 * Loaded on the first interaction with the role selector, never before. The
 * radio is checked natively by that same click, so reading it here picks up the
 * role the visitor actually chose — no need to buffer the event.
 */
import { render } from 'preact';
import Access from './Access';

let mounted = false;

export function mountAccess(host: HTMLElement, checkNow = false): void {
  if (mounted) return;
  mounted = true;
  // Whatever the visitor clicked is already reflected in the static controls,
  // so the scenario is read from the DOM rather than replayed.
  const checked = host.querySelector<HTMLInputElement>('input[name="ax-scenario"]:checked');
  const scenario = checked?.value;
  // A permission ticked before this module existed is very often the click that
  // loaded it, so it has to survive the swap. This is the fourth place in the
  // project that has needed saying — assume it, do not rediscover it.
  const granted = [...host.querySelectorAll<HTMLInputElement>('.ax-toggle input:checked')].map(
    (el) => el.value,
  );
  host.replaceChildren();
  render(<Access initialScenario={scenario} initialDraft={granted} autoCheck={checkNow} />, host);
}
