/**
 * Terminal commands. Content commands render from `site` — nothing is retyped
 * here, so editing src/data/site.ts updates the page, the source view and the
 * terminal together.
 */
import { site } from '../../data/site';

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
