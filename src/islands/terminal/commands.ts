/**
 * Terminal commands. Content commands render from `site` — nothing is retyped
 * here, so editing src/data/site.ts updates the page, the source view and the
 * terminal together.
 */
import { site } from '../../data/site';
import { machineView } from '../../data/machine';

export type Line = { kind: 'in' | 'out' | 'err' | 'dim'; text: string };

const out = (text: string): Line => ({ kind: 'out', text });
const dim = (text: string): Line => ({ kind: 'dim', text });
const err = (text: string): Line => ({ kind: 'err', text });

/**
 * Both lists come from `site.interfaces.terminal`, which is also what the source
 * view advertises. Deriving them here rather than repeating them means the JSON
 * signpost and the actual terminal cannot drift apart — renaming a command in
 * one place renames it everywhere.
 */
export const LISTED_COMMANDS = site.interfaces.terminal.commands;

/** Recognised but not printed by `help` — findable in the source view instead. */
export const HIDDEN_COMMAND = site.interfaces.terminal.hidden[0]!;

function about(): Line[] {
  return [
    out(`${site.name} — ${site.role}`),
    out(`${site.pitch.lead} — ${site.pitch.highlights.join(', ')}.`),
    dim(''),
    ...site.proof.map((p) => dim(`· ${p}`)),
    dim(''),
    out(site.availability.label),
  ];
}

function stack(): Line[] {
  const width = Math.max(...site.stack.primary.map((g) => g.label.length));
  return [
    ...site.stack.primary.map((g) => out(`${g.label.padEnd(width)}  ${g.items.join(' · ')}`)),
    dim(''),
    dim(`${'also'.padEnd(width)}  ${site.stack.also.join(' · ')}`),
  ];
}

function contact(): Line[] {
  const width = Math.max(...site.contact.map((c) => c.label.length));
  return site.contact.map((c) => out(`${c.label.padEnd(width)}  ${c.value}`));
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`;
const ms = (t: number) => `${Math.round(t)} ms`;
const row = (label: string, value: string, width = 14) => out(`  ${label.padEnd(width)}${value}`);

/**
 * Real numbers from this visitor's own page load, via the Navigation and
 * Resource Timing APIs. Nothing here is hard-coded — the point is that the
 * site's performance claim is verifiable in the reader's browser rather than
 * asserted in a README.
 */
function perf(): Line[] {
  const nav = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  if (!nav) return [err('performance timing is not available in this browser')];

  // Only this site's own resources. A browser extension, or the Astro dev
  // toolbar, injects requests into the same timeline — counting those would
  // report someone else's bytes as ours.
  const resources = (
    performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  ).filter((r) => r.name.startsWith(location.origin));

  const bucket = { document: nav.transferSize, css: 0, javascript: 0, fonts: 0, other: 0 };
  // transferSize is 0 for a cache hit, which would otherwise read as "free".
  let cached = nav.transferSize === 0 && nav.decodedBodySize > 0 ? 1 : 0;

  for (const r of resources) {
    if (r.transferSize === 0 && r.decodedBodySize > 0) cached += 1;
    const name = r.name;
    if (name.endsWith('.css')) bucket.css += r.transferSize;
    else if (name.endsWith('.js')) bucket.javascript += r.transferSize;
    else if (/\.(?:woff2?|ttf|otf)(?:[?#]|$)/.test(name)) bucket.fonts += r.transferSize;
    else bucket.other += r.transferSize;
  }

  const total = Object.values(bucket).reduce((a, b) => a + b, 0);
  const requests = resources.length + 1;

  const paint = performance.getEntriesByType('paint');
  const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime;

  const lines: Line[] = [
    dim('transferred over the wire'),
    row('document', kb(bucket.document)),
    row('css', kb(bucket.css)),
    row('javascript', kb(bucket.javascript)),
    row('fonts', kb(bucket.fonts)),
  ];
  if (bucket.other > 0) lines.push(row('other', kb(bucket.other)));
  lines.push(row('total', `${kb(total)}  in ${requests} requests`));

  if (cached > 0) {
    lines.push(dim(`  ${cached} of them served from cache, so counted as 0 kB`));
  }

  lines.push(
    dim('  javascript includes the chunk this terminal just loaded'),
    dim(''),
    dim('this page load'),
  );

  /**
   * Chrome defers first paint while a tab is in the background, which produces
   * a paint timestamp long after load — printing it next to a 60ms load reads
   * as broken, because it is meaningless rather than slow. Show it only when it
   * is consistent with the rest of the timeline.
   */
  const loadEnd = nav.loadEventEnd;
  const fcpIsPlausible = fcp !== undefined && (loadEnd === 0 || fcp <= loadEnd + 50);
  if (fcpIsPlausible) lines.push(row('first paint', ms(fcp)));

  lines.push(row('dom ready', ms(nav.domContentLoadedEventEnd)));
  if (loadEnd > 0) lines.push(row('load complete', ms(loadEnd)));

  if (fcp !== undefined && !fcpIsPlausible) {
    lines.push(dim('  first paint omitted — this tab was backgrounded during load'));
  }

  lines.push(dim(''), dim('measured live by the Navigation and Resource Timing APIs.'));

  // The dev server serves unbundled modules and injects a toolbar, so these
  // numbers are nothing like the built site's. Say so rather than let anyone
  // quote them.
  if (import.meta.env.DEV) {
    lines.push(
      err('running against the dev server — these numbers are not the real ones.'),
      dim('build and preview to measure the site as it actually ships.'),
    );
  } else {
    lines.push(dim('run it again on a hard reload to see uncached numbers.'));
  }
  return lines;
}

/** The machine view, fetched the way you would fetch it. */
function curl(path: string): Line[] {
  if (!path) {
    return [err('curl: try a path'), dim(`  curl ${site.interfaces.web}taha`)];
  }
  const normalised = path.replace(/^https?:\/\/[^/]+/, '');
  if (normalised === '/taha' || normalised === 'taha') {
    return machineView
      .split('\n')
      .map((text) =>
        text.startsWith('{') || text.startsWith(' ') || text.startsWith('}')
          ? out(text)
          : dim(text),
      );
  }
  return [
    err(`curl: (22) The requested URL returned error: 404`),
    dim(`  the only endpoint here is ${site.interfaces.web}taha`),
  ];
}

function help(): Line[] {
  return [
    out('available commands'),
    ...LISTED_COMMANDS.map((c) => dim(`  ${c}`)),
    dim(''),
    // The nudge, not the answer. The answer is in the source view.
    dim('not everything is listed.'),
  ];
}

/**
 * Returns the output lines, or the string 'cls' to signal a screen wipe —
 * which the component handles, since it owns the scrollback.
 */
export function runCommand(raw: string): Line[] | 'cls' {
  const input = raw.trim().replace(/\s+/g, ' ');
  const cmd = input.toLowerCase();

  if (cmd === 'cls') return 'cls';
  if (cmd === 'about') return about();
  if (cmd === 'stack') return stack();
  if (cmd === 'contact') return contact();
  if (cmd === 'help') return help();
  if (cmd === 'perf') return perf();
  if (cmd === 'curl' || cmd.startsWith('curl ')) return curl(input.slice(4).trim());

  if (cmd === HIDDEN_COMMAND) {
    return [
      err('[sudo] password for visitor:'),
      dim(''),
      err('Sorry, user visitor is not in the sudoers file.'),
      err('This incident has been reported.'),
      dim(''),
      out(`…to ${site.contact.find((c) => c.label === 'email')?.value ?? 'him'}, actually.`),
      out('He says the answer is probably yes.'),
    ];
  }

  // A recognisable shell error beats a bespoke one — and `help` is the way out.
  const first = cmd.split(' ')[0] ?? '';
  return [err(`${first}: command not found`), dim("type 'help' for commands")];
}
