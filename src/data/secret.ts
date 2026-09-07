/**
 * The terminal's unlock puzzle.
 *
 * A visitor finds the token in the page source, decodes it with `jwt`, and
 * hands it to `auth` — which really does verify the HMAC signature before
 * granting the scope. See CLAUDE.md, "Secrets worth finding".
 *
 * **Nothing here is secret, and nothing here protects anything.** The signing
 * key sits in the same bundle as the verifier, which means anyone who reads it
 * can mint their own token. That is deliberate and it is said out loud in the
 * terminal: a signing key on the client is not a secret, it is theatre. On a
 * site whose subject is authorization, demonstrating that honestly is worth
 * more than a puzzle that pretends to be secure.
 */
/**
 * Not a credential. Named so that anyone who greps the bundle for it finds the
 * joke rather than thinking they have found something.
 */
export const PUBLIC_SIGNING_KEY = 'this-key-ships-to-the-browser-so-it-is-not-a-secret';

/** The scope the token grants. One capability, deliberately. */
export const SUDO_SCOPE = 'sudo';

/**
 * Deliberately no `exp`.
 *
 * An expiry would quietly break the puzzle at some point in the future, with no
 * error and nobody watching — the token would simply stop working and the site
 * would look broken to whoever found it next. `jwt` prints "no expiry claim"
 * for this cleanly, so there is no cost to leaving it out.
 */
export const TOKEN_PAYLOAD = {
  iss: 'taha.dev',
  sub: 'visitor',
  scope: SUDO_SCOPE,
  note: 'decoded, not verified — hand this to auth',
} as const;

// No imports here on purpose. This file is the puzzle's *data*; the signing
// lives with the code that mints the token (Base.astro, at build time) and the
// code that checks it (the terminal). `src/data/` reaching into `src/islands/`
// would invert the layering — and it also broke `node --experimental-strip-types`,
// which will not resolve an extensionless relative import the bundler is happy
// with. Keeping this file dependency-free means the tests can compose it with
// `tools.ts` themselves.
