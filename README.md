# tahamanaquib.com

A backend engineer's portfolio that shows no projects, because **the site is the project**. There
is nothing to look at but the thing you are looking at: how fast it loads, how it is built, and
what it does when you start poking at it.

Live: _not deployed yet — going up on Vercel first, then `tahamanaquib.com`._

Two audiences, deliberately. A recruiter should understand who I am and how to reach me in about
a minute without touching anything interactive. An engineer who keeps clicking finds a permission
engine, a working terminal and a JSON view of the page they can edit.

---

## The stack, and why

| Concern   | Choice                    | Why                                                                                                                                                                                   |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | **Astro** (static output) | Ships zero client JS by default. The default path is HTML and CSS with nothing to hydrate, and its islands model means interactive code physically cannot leak into the initial load. |
| Language  | **TypeScript**, strict    | The engines below are the part worth reading. Types are how they stay readable.                                                                                                       |
| Islands   | **Preact**, code-split    | 4.4 KB gzipped for the core, 8.8 KB with signals and hooks — and only fetched when someone opens something. React and ReactDOM are roughly an order of magnitude larger.              |
| Styling   | **Tailwind v4**           | CSS-first config: the palette, type scale and density are theme tokens, so the design system is enforced by the config rather than by discipline.                                     |
| Icons     | **`lucide-static`**       | Plain SVG files inlined at build time. `lucide-react` would pull React into a Preact project to draw three shapes.                                                                    |
| Backend   | **None**                  | See below.                                                                                                                                                                            |
| Hosting   | Static CDN (Vercel)       | It is a directory of files. No adapter, no server, no runtime.                                                                                                                        |

### Why there is no backend

Nothing on this site calls a server. No database, no API routes, no analytics, no remote
persistence. Visitor state — the achievements you have found, the terminal's scrollback and dock
preference — is `localStorage`, read as untrusted and shape-validated, and never leaves the
browser.

That is a decision, not a shortcut. It makes the site free to host, impossible to take down with
traffic, and impossible to leak anything from. The backend credibility is supposed to come from
the code being worth reading, not from a server sitting idle behind a portfolio.

The one place it costs something is honesty: the terminal's `auth` command verifies a real HMAC
signature, and the signing key ships in the bundle. The site says so out loud every time you use
it. Client-side verification is theatre, and pretending otherwise on an auth engineer's site would
be the worst possible thing to get wrong.

---

## Performance

The hard constraint was that the default path stays near-zero JS. Measured on a local production
build (`npm run build && npm run preview`), Lighthouse 12.8.2:

| preset  | perf | a11y | best practices | SEO | FCP   | LCP   | TBT  | CLS |
| ------- | ---- | ---- | -------------- | --- | ----- | ----- | ---- | --- |
| desktop | 100  | 100  | 100            | 100 | 0.4 s | 0.4 s | 0 ms | 0   |
| mobile  | 100  | 100  | 100            | 100 | 1.4 s | 1.7 s | 0 ms | 0   |

Those are local numbers, not CDN numbers. Gzipped, the homepage is **7.7 KB of HTML, 9.3 KB of CSS
and 1.54 KB of JavaScript**.

**On "zero JS", honestly.** That 1.54 KB is four loaders and nothing else — one per interactive
feature, each doing nothing until you click. The accurate claim is not "zero JS"; it is that
**the recruiter path ships no JavaScript until the visitor asks for it**, and the loaders are the
price of the asking. Everything real is behind them:

| chunk              | gzipped | fetched when                  |
| ------------------ | ------- | ----------------------------- |
| terminal           | 9.0 KB  | you open the terminal         |
| Preact runtime     | 8.8 KB  | first island of any kind      |
| permission sandbox | 4.1 KB  | you interact with the sandbox |
| source-view editor | 3.6 KB  | you open the machine view     |
| achievements panel | 1.5 KB  | you find the door             |

Verified structurally rather than assumed: the built HTML contains exactly four `<script>` tags
and **no `modulepreload`**, so nothing above is even prefetched. One font file is preloaded (Inter);
six faces are declared and the other five belong to alternate identities, so a visitor who never
picks one never downloads one.

Accessibility is a hard AA floor, not a polish pass — and it was the audit, not the design, that
caught the failures. Real text was using a token documented as decorative-only (2.77:1 on the light
identities), eight unlabelled radios sat in the tab order, and the achievements list could not be
scrolled by keyboard at all. All fixed; axe-core reports zero violations across the default page,
the terminal, the achievements panel and the source view on both dark and light grounds.

---

## What it actually does

### The permission sandbox

The part that demonstrates the day job. A small fictional organisation — five roles, five
resources, fourteen actions, a twelve-rule policy — and a real engine that answers "can this person
do this?" with the rule that produced the answer.

It is a genuine policy evaluator, DOM-free and readable on its own (`src/islands/access/policy.ts`):
explicit denials beat allows regardless of order, grants can be conditional on ownership, drafts are
graded on least privilege rather than on merely working, and there is a privilege-escalation check
that answers "does this permission let someone grant themselves more?"

Nine scenarios across three levels ask you to build or repair a policy against a brief. **The
workspace is fictional and the engine guards nothing** — it is a demonstration, not a security
control.

### The terminal

⌘K, or the button in the corner. A dockable, resizable panel — not a command palette — with fifteen
commands, and the filter for adding one is that it must _do_ something you cannot do by pointing.

Four of them are real tools that run locally and send nothing anywhere: `jwt` decodes a token
(header, claims, expiry — and says plainly that it does **not** verify, because verifying needs a
key a static site cannot have), `hash` runs SHA-1/256/384/512 through WebCrypto, `base64` encodes
and decodes through `TextEncoder`, and `uuid` generates v4s. Others drive the page itself: `theme`,
`set`, `reset` and `open` change the same state the source view's controls change, not a copy of it.

There is also a four-step unlock chain involving a genuine HS256 token hidden in the page source.
Finding it is the point; the fact that you can then mint your own is the joke.

### The source view

A control in the corner swaps the page between the human view and `GET /taha` — the same content as
a JSON response. Both views are generated at build time from one typed content module, so they
cannot drift; if a change to one does not change the other, the implementation is wrong.

The JSON is editable. Values are live-bound back to the page as text (never as HTML), arrays can
grow and shrink, and twelve identities — six dark, six light — repaint the whole site, changing
typeface, ground, density and corners rather than just colour. Every palette is generated in OKLCH
and contrast-validated at build time. Nothing persists: a reload restores the real thing.

---

## Running it locally

Node 22.12+ (developed on 24.20).

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output to dist/
npm run preview  # serve the build
npm run check    # astro check && tsc --noEmit
```

Use `npm run check`, not `astro check` alone. `astro check` does not traverse the island `.ts`
files — they are reached only through a dynamic `import()` inside an inline `<script>` — so it
once reported a clean bill of health on a module containing an undefined variable that threw on
load and disabled the whole feature.

---

## Tradeoffs, and what was cut

The useful part for another engineer.

- **No test suite in the repo.** The engines are deliberately DOM-free so they can be checked
  without a browser, and suites were written and used during development. They are not committed.
  What that costs is real: the values duplicated between JS and CSS are unguarded, and the derived
  colour tokens are `color-mix` on the seeds, so a value that passes on the dark ground can fail on
  the six light ones.
- **An entire feature deleted after it worked.** A five-stage API simulation — rate limiter, cache,
  queue with backpressure, circuit breaker — was built in full, and every defence provably defeated
  the attack it answered. It was cut anyway: it was a curriculum, not a sandbox, where the right
  move was always to press the one button that had just appeared, and its subject was invisible
  enough to need six counters to narrate. The permission sandbox replaced it. The engine was
  deleted rather than left unreachable, because dead code is clutter in a repo that is the
  portfolio.
- **No dark/light toggle**, though six light identities exist. They are reachable only through the
  terminal. A brightness control on the page would make the site a themeable template; buried, it
  stays a discovery.
- **No view transitions.** They would add a client-side router to the default path for a site that
  is one route and a 404. The constraint won.
- **No background layer.** Tried as texture built from the site's own JSON, at 1.4% opacity, and
  removed — it read as noise competing with the content rather than as texture.
- **A share link for edited content was refused.** The state would fit in a URL fragment with no
  backend, but a link that makes my portfolio say anything, shareable, is a defacement vector
  aimed at me.
- **No projects section, no case studies, no guestbook, no analytics, no animation library.**

Things I would flag if reviewing this myself: `src/styles/global.css` is long and carries rules
that belong to components (they are global because they reach slotted content or runtime-created
DOM, but the file is still the biggest thing here); the source-view editor accumulated features
until it needed an explicit boundary written down; and the achievements panel is genuinely cramped
when the terminal is docked at the bottom on a laptop.
