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
import { PUBLIC_SIGNING_KEY, SUDO_SCOPE } from '../../data/secret';
import {
  HASHES,
  MAX_UUIDS,
  decodeJwt,
  digest,
  fromBase64,
  isHashName,
  toBase64,
  uuids,
  verifyHs256,
} from './tools';
import { grant, has, scopes } from './unlock';

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
/* auth — the unlock puzzle                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The honesty line, printed on every successful verification.
 *
 * The signature check below is real HMAC-SHA256. The key it checks against
 * ships in this bundle, which means it is not a secret and this is not a
 * security boundary — saying so is the entire point of putting it on the site
 * of someone whose subject is authorization.
 */
const THEATRE = 'verified with a key that ships in this bundle — so it is not a secret.';

async function auth(arg: string): Promise<Line[]> {
  const held = scopes();

  if (!arg) {
    return [
      out(
        `scopes  ${held.length > 0 ? held.join(', ') : 'none — this session is unauthenticated'}`,
      ),
      dim(''),
      dim('usage: auth <token>'),
      // The breadcrumb. It says where to look without saying what to look for,
      // and it happens to be true of production systems rather more often than
      // anyone would like.
      dim('this site ships its own source. that is where credentials leak in'),
      dim('real life too.'),
    ];
  }

  if (!(await verifyHs256(arg, PUBLIC_SIGNING_KEY))) {
    return [
      err('signature does not verify'),
      dim('that token was not issued here, or it has been altered.'),
      dim("decode it with 'jwt' to see what you actually have."),
    ];
  }

  // Only read the payload once the signature holds. Trusting claims from an
  // unverified token is the mistake this whole section is about.
  let scope: unknown;
  try {
    scope = decodeJwt(arg).payload.scope;
  } catch {
    return [err('the signature verifies but the payload does not parse')];
  }
  if (typeof scope !== 'string' || scope !== SUDO_SCOPE) {
    return [err(`signature is valid, but the token grants no scope this terminal knows`)];
  }

  if (!grant(scope)) {
    return [out(`already authorised — scope: ${scope}`), dim(THEATRE)];
  }
  return [
    out(`signature verified — scope: ${scope}`),
    dim(THEATRE),
    dim(''),
    out('visitor added to the sudoers file.'),
    dim('try the thing that was denied before.'),
  ];
}

/** The hidden command, which now has two endings. */
function sudo(): Line[] {
  if (has(SUDO_SCOPE)) {
    const find = (label: string) => site.contact.find((c) => c.label === label)?.value ?? '';
    return [
      err('[sudo] password for visitor:'),
      dim(''),
      out('verified. visitor is in the sudoers file.'),
      dim(''),
      out('hiring taha…'),
      dim(`  email    ${find('email')}`),
      dim(`  github   ${find('github')}`),
      dim(`  resume   ${site.resumeHref}`),
      dim(''),
      out('exit 0'),
    ];
  }

  return [
    err('[sudo] password for visitor:'),
    dim(''),
    err('Sorry, user visitor is not in the sudoers file.'),
    err('This incident has been reported.'),
    dim(''),
    out(`…to ${site.contact.find((c) => c.label === 'email')?.value ?? 'him'}, actually.`),
    out('He says the answer is probably yes.'),
    dim(''),
    // What is missing, not how to get it.
    dim('(a scope would change this.)'),
  ];
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

  auth: {
    usage: 'auth [token]',
    blurb: 'show this session’s scopes, or claim one',
    run: auth,
  },
  help: { usage: 'help', blurb: 'this list', run: () => help() },
  cls: { usage: 'cls', blurb: 'clear the screen', run: () => 'cls' },
};

/** The groups `help` prints, in order. Blank line between each. */
const GROUPS: readonly (readonly string[])[] = [
  ['about', 'stack', 'contact'],
  ['jwt', 'hash', 'base64', 'uuid'],
  ['auth', 'help', 'cls'],
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

  // Earned, so it stops being a secret. Revealing it here is the reward for
  // solving the chain — the list itself changes once you hold the scope.
  if (has(SUDO_SCOPE)) {
    lines.push(dim(''));
    lines.push(out(`  ${HIDDEN_COMMAND.padEnd(width)}   you earned this one`));
  }

  lines.push(dim(''));
  lines.push(dim('the tools run here in your browser — nothing is sent anywhere.'));
  // The nudge, not the answer. The answer is in the source view.
  if (!has(SUDO_SCOPE)) lines.push(dim('not everything is listed.'));
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

  if (input.replace(/\s+/g, ' ').toLowerCase() === HIDDEN_COMMAND) return sudo();

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
