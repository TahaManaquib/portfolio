/**
 * Terminal commands.
 *
 * Content commands render from `site` — nothing is retyped here, so editing
 * src/data/site.ts updates the page, the source view and the terminal together.
 *
 * The tool commands are the other half, and they are the reason the terminal
 * exists: `jwt`, `hash`, `base64` and `uuid` all *do* something rather than
 * print something you could have read by scrolling. Their algorithms live in
 * `tools.ts`, which has no DOM in it and is tested in Node.
 */
import { site } from '../../data/site';
import {
  HASHES,
  MAX_UUIDS,
  decodeJwt,
  digest,
  fromBase64,
  isHashName,
  toBase64,
  uuids,
} from './tools';

export type Line = { kind: 'in' | 'out' | 'err' | 'dim'; text: string };

const out = (text: string): Line => ({ kind: 'out', text });
const dim = (text: string): Line => ({ kind: 'dim', text });
const err = (text: string): Line => ({ kind: 'err', text });

/** A command's output, or `cls` to signal a screen wipe. */
type Output = Line[] | 'cls';

interface Command {
  /** What `help` prints on the left. Includes the argument shape. */
  readonly usage: string;
  /** What `help` prints on the right. One line, lowercase, no full stop. */
  readonly blurb: string;
  readonly run: (arg: string) => Output | Promise<Output>;
}

/**
 * Recognised but not printed by `help` — findable in the source view instead,
 * which is the only place it is written down.
 */
export const HIDDEN_COMMAND = site.undocumented[0]!;

/* -------------------------------------------------------------------------- */
/* content                                                                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* tools                                                                       */
/* -------------------------------------------------------------------------- */

/** Two columns, aligned on the widest key. Used by `jwt` for its claim lists. */
function table(rows: readonly (readonly [string, string])[], indent = '  '): Line[] {
  if (rows.length === 0) return [];
  const width = Math.max(...rows.map(([k]) => k.length));
  return rows.map(([k, v]) => out(`${indent}${k.padEnd(width)}  ${v}`));
}

function jwt(arg: string): Line[] {
  if (!arg) return usageError('jwt <token>', 'paste a token to decode it');

  let token;
  try {
    token = decodeJwt(arg);
  } catch (cause) {
    return [
      err(`not a JWT: ${cause instanceof Error ? cause.message : String(cause)}`),
      dim('a JWT looks like xxxxx.yyyyy.zzzzz'),
    ];
  }

  // One width for the whole block. Padding each claim against itself would
  // align every row to nothing, which is what a naive per-row helper does.
  const claims: Line[] = [];
  const width = Math.max(...token.claims.map((c) => c.key.length));
  for (const claim of token.claims) {
    claims.push(out(`  ${claim.key.padEnd(width)}  ${claim.value}`));
    // The note sits under its value, indented past the key column.
    if (claim.note) claims.push(dim(`  ${' '.repeat(width)}  ${claim.note}`));
  }

  const status =
    token.expired === null
      ? dim('no expiry claim')
      : token.expired
        ? err('this token has expired')
        : out('not expired');

  return [
    out('header'),
    ...table(Object.entries(token.header).map(([k, v]) => [k, JSON.stringify(v)] as const)),
    dim(''),
    out('claims'),
    ...claims,
    dim(''),
    status,
    dim(''),
    // The whole point of being careful here: an auth engineer's site must not
    // imply that reading a token is the same as trusting it.
    dim('the signature was not checked — decoding is not verifying.'),
    dim('nothing was sent anywhere; this ran in your browser.'),
  ];
}

async function hash(arg: string): Promise<Line[]> {
  const [maybeAlgo, ...rest] = arg.split(' ');
  const named = (maybeAlgo ?? '').toLowerCase();

  // `hash sha256 foo` and `hash foo` both work; the algorithm is optional and
  // only treated as one when it actually names a hash.
  const algo = isHashName(named) ? named : 'sha256';
  const text = isHashName(named) ? rest.join(' ') : arg;

  if (named === 'md5') {
    return [
      err('md5 is not available'),
      dim('WebCrypto deliberately omits it — md5 is broken for anything'),
      dim('security-related, so browsers do not ship it. use sha256.'),
    ];
  }
  if (!text) return usageError(`hash [${HASHES.join('|')}] <text>`, 'defaults to sha256');

  try {
    return [out(`${algo}  ${await digest(algo, text)}`)];
  } catch (cause) {
    return [err(cause instanceof Error ? cause.message : String(cause))];
  }
}

function base64(arg: string): Line[] {
  const [direction, ...rest] = arg.split(' ');
  const mode = (direction ?? '').toLowerCase();
  const text = rest.join(' ');

  // Never guessed: valid base64 is also valid text, so inferring the direction
  // would silently do the wrong thing on inputs like "decode".
  if (mode !== 'encode' && mode !== 'decode' && mode !== '-d' && mode !== '-e') {
    return usageError('base64 encode|decode <text>', 'the direction is not guessed');
  }
  if (!text) return usageError('base64 encode|decode <text>', 'nothing to work on');

  try {
    return [out(mode === 'encode' || mode === '-e' ? toBase64(text) : fromBase64(text))];
  } catch {
    return [err('that is not valid base64')];
  }
}

function uuid(arg: string): Line[] {
  const asked = arg ? Number.parseInt(arg, 10) : 1;
  if (arg && Number.isNaN(asked)) return usageError('uuid [count]', `1 to ${MAX_UUIDS}`);
  const list = uuids(asked || 1);
  return [
    ...list.map((id) => out(id)),
    ...(asked > MAX_UUIDS ? [dim(`capped at ${MAX_UUIDS}`)] : []),
  ];
}

function usageError(usage: string, hint: string): Line[] {
  return [err(`usage: ${usage}`), dim(hint)];
}

/* -------------------------------------------------------------------------- */
/* the registry                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The single source of truth for what exists. `help` is generated from it, so
 * a command cannot be added without also being documented — which is the whole
 * reason the blurb sits in the same object as the implementation.
 *
 * This used to live in `site.interfaces.terminal.commands` so the source view
 * could advertise it. The source view no longer does (the terminal has a
 * visible button now, so it needs no signpost), and a command list belongs to
 * the terminal rather than to a profile response.
 */
const COMMANDS: Record<string, Command> = {
  about: { usage: 'about', blurb: 'who he is, in short', run: about },
  stack: { usage: 'stack', blurb: 'what he builds with', run: stack },
  contact: { usage: 'contact', blurb: 'how to reach him', run: contact },

  jwt: {
    usage: 'jwt <token>',
    blurb: 'decode a JSON Web Token — claims, expiry, algorithm',
    run: jwt,
  },
  hash: {
    usage: 'hash [algo] <text>',
    blurb: `digest some text — ${HASHES.join(', ')}`,
    run: hash,
  },
  base64: {
    usage: 'base64 encode|decode <text>',
    blurb: 'text to base64 and back',
    run: base64,
  },
  uuid: { usage: 'uuid [count]', blurb: `generate v4 UUIDs, up to ${MAX_UUIDS}`, run: uuid },

  help: { usage: 'help', blurb: 'this list', run: () => help() },
  cls: { usage: 'cls', blurb: 'clear the screen', run: () => 'cls' },
};

/** The groups `help` prints, in order. Blank line between each. */
const GROUPS: readonly (readonly string[])[] = [
  ['about', 'stack', 'contact'],
  ['jwt', 'hash', 'base64', 'uuid'],
  ['help', 'cls'],
];

function help(): Line[] {
  const width = Math.max(...Object.values(COMMANDS).map((c) => c.usage.length));
  const lines: Line[] = [out('available commands'), dim('')];

  GROUPS.forEach((group, i) => {
    if (i > 0) lines.push(dim(''));
    for (const name of group) {
      const command = COMMANDS[name]!;
      lines.push(out(`  ${command.usage.padEnd(width)}   ${command.blurb}`));
    }
  });

  lines.push(dim(''));
  lines.push(dim('the tools run here in your browser — nothing is sent anywhere.'));
  // The nudge, not the answer. The answer is in the source view.
  lines.push(dim('not everything is listed.'));
  return lines;
}

/* -------------------------------------------------------------------------- */
/* dispatch                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Returns the output lines, or the string 'cls' to signal a screen wipe —
 * which the component handles, since it owns the scrollback.
 *
 * May return a Promise: `hash` goes through WebCrypto, which is async. Only the
 * verb is lowercased and only surrounding whitespace is trimmed — the argument
 * is passed through untouched, because tokens, base64 and hash inputs are all
 * case- and whitespace-sensitive and normalising them would quietly corrupt the
 * answer.
 */
export function runCommand(raw: string): Output | Promise<Output> {
  const input = raw.trim();
  if (!input) return [];

  if (input.replace(/\s+/g, ' ').toLowerCase() === HIDDEN_COMMAND) {
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

  const split = /^(\S+)\s*([\s\S]*)$/.exec(input);
  const verb = (split?.[1] ?? '').toLowerCase();
  const arg = (split?.[2] ?? '').trim();

  const command = COMMANDS[verb];
  if (!command) {
    // A recognisable shell error beats a bespoke one — and `help` is the way out.
    return [err(`${verb}: command not found`), dim("type 'help' for commands")];
  }
  return command.run(arg);
}
