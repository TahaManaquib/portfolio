/**
 * Mounts the API simulation into the static placeholder rendered by
 * ApiSim.astro. Loaded on the visitor's first click, never before — the
 * section itself is plain HTML until then.
 */
import { render } from 'preact';
import ApiSim from './ApiSim';

let mounted = false;

export function mountApiSim(host: HTMLElement, pressedAt: readonly number[] = []): void {
  if (mounted) return;
  mounted = true;
  host.replaceChildren();
  // Replays every press that happened while the chunk was downloading, with
  // the timing it actually had — so a burst that should have killed the server
  // still kills it.
  render(<ApiSim pressedAt={pressedAt} />, host);
}
