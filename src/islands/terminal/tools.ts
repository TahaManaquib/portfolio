/**
 * The terminal's real tools — the algorithms, with no terminal in them.
 *
 * Nothing here touches the DOM, the component or `Line`, so every function is
 * callable from Node and testable without a browser. That is the same split
 * `policy.ts` uses, and for the same reason: this is the part an engineer
 * reading the repo will actually look at.
 *
 * Nothing here sends anything anywhere. There is no network call in this file,
 * which is a claim the terminal makes to the visitor and one they can check.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* -------------------------------------------------------------------------- */
/* base64                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `btoa` takes a "binary string" — one character per byte — so text has to be
 * UTF-8 encoded first. Skipping that is the classic bug: `btoa('café')` throws
 * rather than encoding, because é is outside Latin-1.
 *
 * The bytes are walked in chunks rather than spread into `String.fromCharCode`,
 * which overflows the call stack on large inputs.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function toBase64(text: string): string {
  return bytesToBase64(encoder.encode(text));
}

/** base64 -> base64url: the two swapped characters, and no padding. */
function urlify(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function toBase64Url(text: string): string {
  return urlify(toBase64(text));
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return urlify(bytesToBase64(bytes));
}

/** Bytes back to UTF-8 text. Throws on input that is not valid base64. */
export function fromBase64(b64: string): string {
  const binary = atob(b64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return decoder.decode(bytes);
}

/**
 * base64url — the JWT dialect. `+` and `/` become `-` and `_` so the value
 * survives a URL, and the `=` padding is dropped. Decoding puts both back.
 */
export function fromBase64Url(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = padded.length % 4;
  return fromBase64(remainder === 0 ? padded : padded + '='.repeat(4 - remainder));
}

/* -------------------------------------------------------------------------- */
/* jwt                                                                         */
/* -------------------------------------------------------------------------- */

export interface JwtClaim {
  readonly key: string;
  readonly value: string;
  /** Set for the time claims, where the raw number means nothing to a reader. */
  readonly note?: string;
}

export interface Jwt {
  readonly header: Record<string, unknown>;
  readonly payload: Record<string, unknown>;
  readonly claims: readonly JwtClaim[];
  /** null when the token carries no `exp`. */
  readonly expired: boolean | null;
  readonly signature: string;
}

/** The registered claims worth spelling out. */
const CLAIM_NAMES: Record<string, string> = {
  iss: 'issuer',
  sub: 'subject',
  aud: 'audience',
  exp: 'expires',
  nbf: 'not before',
  iat: 'issued at',
  jti: 'token id',
};

/** Seconds-since-epoch to something a human can read, with the delta. */
function whenever(seconds: number, now: number): string {
  const at = new Date(seconds * 1000);
  if (Number.isNaN(at.getTime())) return 'not a valid time';

  const delta = seconds * 1000 - now;
  const abs = Math.abs(delta);
  if (abs < 5_000) return `${at.toISOString().replace('T', ' ').slice(0, 19)}Z — just now`;

  const [count, unit] =
    abs < 60_000
      ? ([Math.round(abs / 1000), 'second'] as const)
      : abs < 3_600_000
        ? ([Math.round(abs / 60_000), 'minute'] as const)
        : abs < 86_400_000
          ? ([Math.round(abs / 3_600_000), 'hour'] as const)
          : ([Math.round(abs / 86_400_000), 'day'] as const);

  const plural = count === 1 ? '' : 's';
  const rel = delta >= 0 ? `in ${count} ${unit}${plural}` : `${count} ${unit}${plural} ago`;
  return `${at.toISOString().replace('T', ' ').slice(0, 19)}Z — ${rel}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Decodes a JWT. It does **not** verify it — that needs the signing key, which
 * a static site does not have and would never be given. Every caller is
 * expected to say so out loud.
 */
export function decodeJwt(token: string, now: number = Date.now()): Jwt {
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new Error(`a JWT has three dot-separated parts; this has ${parts.length}`);
  }

  let header: unknown;
  let payload: unknown;
  try {
    header = JSON.parse(fromBase64Url(parts[0] as string));
  } catch {
    throw new Error('the header is not valid base64url-encoded JSON');
  }
  try {
    payload = JSON.parse(fromBase64Url(parts[1] as string));
  } catch {
    throw new Error('the payload is not valid base64url-encoded JSON');
  }
  if (!isObject(header) || !isObject(payload)) {
    throw new Error('the header and payload must both be JSON objects');
  }

  const claims: JwtClaim[] = Object.entries(payload).map(([key, value]) => {
    const named = CLAIM_NAMES[key];
    const isTime = key === 'exp' || key === 'iat' || key === 'nbf';
    return {
      key: named ? `${key} (${named})` : key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      ...(isTime && typeof value === 'number' ? { note: whenever(value, now) } : {}),
    };
  });

  const exp = payload.exp;
  return {
    header,
    payload,
    claims,
    expired: typeof exp === 'number' ? exp * 1000 < now : null,
    signature: parts[2] as string,
  };
}

/* -------------------------------------------------------------------------- */
/* hash                                                                        */
/* -------------------------------------------------------------------------- */

/** What SubtleCrypto actually offers. Notably not MD5, and deliberately so. */
export const HASHES = ['sha1', 'sha256', 'sha384', 'sha512'] as const;
export type HashName = (typeof HASHES)[number];

export function isHashName(value: string): value is HashName {
  return (HASHES as readonly string[]).includes(value);
}

/** `sha256` -> `SHA-256`, the identifier WebCrypto wants. */
function subtleName(name: HashName): string {
  return name === 'sha1' ? 'SHA-1' : `SHA-${name.slice(3)}`;
}

export async function digest(name: HashName, text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    // Only reachable over plain http on a non-localhost origin. Saying so beats
    // printing something that looks like a digest and is not one.
    throw new Error('WebCrypto is unavailable here — it needs a secure context');
  }
  const buffer = await subtle.digest(subtleName(name), encoder.encode(text));
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* -------------------------------------------------------------------------- */
/* HS256 — signing and verifying                                               */
/* -------------------------------------------------------------------------- */

/**
 * These exist for the terminal's unlock puzzle, and they are the real
 * algorithm: HMAC-SHA256 over `header.payload`, exactly as the JWT spec says.
 *
 * **The key they use is shipped in the bundle, so it is not a secret**, and
 * nothing here protects anything. That is the joke and it is stated wherever a
 * visitor can see it — a client-side signing key is theatre, which is worth
 * demonstrating honestly rather than pretending otherwise. Anyone who reads the
 * key can mint their own token, and they are welcome to; that is the deeper
 * easter egg, not a hole.
 */
async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto is unavailable here — it needs a secure context');
  return subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    usage,
  ]);
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await hmacKey(secret, 'sign');
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return bytesToBase64Url(new Uint8Array(signature));
}

/** Builds a signed JWT. Used at build time to mint the token the puzzle hides. */
export async function signHs256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const body = `${toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${toBase64Url(
    JSON.stringify(payload),
  )}`;
  return `${body}.${await hmac(body, secret)}`;
}

/**
 * Compares without an early return on the first differing character.
 *
 * It is not load-bearing here — the key is public and there is nothing to
 * protect — but writing the comparison the other way in a file about signature
 * verification would be the wrong thing to have in a portfolio.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when the signature genuinely matches. Malformed input is false, not a throw. */
export async function verifyHs256(token: string, secret: string): Promise<boolean> {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;
  try {
    const expected = await hmac(`${parts[0]}.${parts[1]}`, secret);
    return constantTimeEqual(expected, parts[2] as string);
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* uuid                                                                        */
/* -------------------------------------------------------------------------- */

/** Capped so a bored visitor cannot push the 400-line scrollback out in one go. */
export const MAX_UUIDS = 10;

export function uuids(count: number): string[] {
  const n = Math.min(Math.max(1, Math.trunc(count) || 1), MAX_UUIDS);
  return Array.from({ length: n }, () => globalThis.crypto.randomUUID());
}
