# Taha's Portfolio — Project Context for Claude Code

## What this is

A minimal backend-developer portfolio for Taha. It is professional first, interactive second.
Recruiters must be able to understand who Taha is, how he thinks, and how to reach him in
60–90 seconds without ever touching an interactive element. A curious visitor can then spend
5–10+ minutes discovering a small, self-consistent "backend layer" hidden underneath.

**The site does not showcase other projects.** There is no Selected Work section, no project
list, and no case study pages. The portfolio itself _is_ the project on display — the proof of
skill is the site: its speed, its constraints, its hidden backend layer, and its public repo.

Core philosophy: **a minimal backend portfolio that rewards curiosity.**

Experience loop every interactive element should serve:
Discover → Interact → Learn → Unlock → Wonder → Return

## Architecture — this is a single-page app

The site is **mostly an SPA**. With projects and case studies gone, essentially all core content
lives on one page as stacked sections (hero/about → stack → contact), navigated by in-page
anchors rather than page loads. The only things that may live off the main page are small extra
routes like `/achievements` and the 404 page.

This does not loosen the performance constraint below — it tightens it, because everything ships
on one route:

- SPA means "one page, client-side navigation," NOT "client-rendered blank shell." The core
  content must still be statically prerendered/SSG'd and present in the initial HTML. Never make
  a recruiter wait on JS to hydrate before they can read the hero.
- Nav links are in-page anchors with smooth-but-short scrolling; they must still work with JS
  disabled and must update focus correctly for keyboard/screen-reader users.
- Because there is no route-level code splitting to hide behind, interactive-layer code splitting
  (terminal, API Simulation, achievements) matters more, not less. Nothing interactive is in the
  initial bundle.

## Tech stack (locked)

| Concern             | Choice                                                                                |
| ------------------- | ------------------------------------------------------------------------------------- |
| Framework           | **Astro** (static output)                                                             |
| Language            | **TypeScript**, strict                                                                |
| Interactive islands | **Preact**, code-split, loaded on user action only                                    |
| Styling             | **Tailwind CSS**                                                                      |
| Hosting             | **Cloudflare Pages** (pure static; Netlify/Vercel-static are drop-in equivalents)     |
| Backend             | **None.** See below.                                                                  |
| Tooling             | Prettier. No test framework, no CI, no component library until something demands one. |

Why Astro: it ships **zero client JS by default**, so the recruiter path is HTML + CSS with
nothing to hydrate. Its islands model maps 1:1 onto the code-splitting rule below — interactive
features physically cannot leak into the initial page load. Do not swap the framework without an
explicit instruction.

**On "zero JS", honestly:** through Phase 1 the site ships literally zero `<script>` tags, and
that is worth protecting. From Phase 2 it necessarily becomes _near_-zero: the terminal opens on
⌘K, which needs a key listener, and every island needs a small loader to fetch it on demand. The
claim to make in the README is therefore "the recruiter path ships no JS until the visitor asks
for it", with the loader measured — not "zero JS" once that stops being true. Do not quietly keep
claiming zero.

Tailwind notes for this project: keep the palette/type/spacing as theme tokens rather than
scattering arbitrary values, so the design system stays enforceable. Markup readability still
matters here — "view source" is a load-bearing part of the pitch — so extract a component
instead of letting a class list sprawl.

## No backend — everything is client-side

**There is no server, no database, no API routes, no persistence layer.** The site is a static
build served from a CDN.

- The API Simulation is entirely simulated in the browser — it always was, and now nothing else
  talks to a server either.
- Visitor state, unlock flags, and returning-visitor detection are **localStorage only**. No
  sync, no remote store, no anonymous-ID service.
- "System status" indicators are cosmetic. There is no real health check to run, because there
  is nothing to check.
- The "hidden API endpoint" easter egg is a **prerendered static route** that returns
  JSON-shaped content (e.g. `/api/whoami.json`). It looks like an endpoint; it is a build
  artifact.

This may change later, but only on an explicit instruction. Until then, treat any proposal that
needs a server as out of scope and say so instead of building it.

## Build workflow — one section at a time, approval required

**Do not build the whole site (or a whole phase) in one go.** Taha reviews and approves each
section before the next one starts. This is a hard process rule, not a preference.

For every section:

1. Briefly propose what you're about to build — the structure, content slots, and any decisions
   worth flagging. Suggest options where a genuine choice exists rather than silently picking.
2. Build **only that one section**, then stop.
3. Wait for explicit approval. Do not start the next section, and do not scaffold ahead "while
   we're here."
4. If Taha asks for changes, iterate on that section until approved, then move on.

Suggestions are welcome and expected along the way — content ideas, layout alternatives,
technical tradeoffs — but they are proposals to approve, never things to implement unasked.
Exceptions to the one-section rule: shared foundation work that genuinely can't be scoped to a
section (project scaffold, base styles/tokens, layout shell). Call those out as foundation work,
keep them minimal, and get approval on those too.

## Non-negotiable performance constraint

**The site must be incredibly fast.** This is a hard constraint, not a nice-to-have, and it
overrides "cool idea" every time the two conflict. Concretely:

- The recruiter path (home, about-in-hero, stack, contact, resume) ships as static/SSG
  content with near-zero client JS. It must never wait on a database call.
- Anything in the "interactive layer" (terminal, API playground, mini-game, achievements page)
  must be code-split and only loaded when the visitor actually opens it — never bundled into
  the initial homepage load.
- "System status" indicators are cosmetic — static/simulated data only. There is no real health
  check to run (see "No backend" above), so never imply the site is polling anything live.
- Visitor/achievement state is localStorage only. Read it after first paint; never block first
  paint or first interaction on it, and never gate content behind it.
- No animation libraries for simple UI transitions — CSS transitions/transforms only.
  Animations are 100–300ms, short and purposeful. Nothing animates by default/idly.
- No light/dark theme toggle. Dark, always — see "Background" and the palette-editor note under
  Visual direction for the one deliberate exception.
- Mobile-first and accessible from the start of each phase — not deferred to a "polish" phase.

When in doubt: default to static, defer to on-demand, and cut anything whose engineering cost
doesn't clearly buy either recruiter clarity or a specific, intentional discovery moment.

## What we are building (locked feature list)

### Core content (always visible, no interaction required)

- Homepage: hero (name, role, one-line pitch, CTA) with About folded briefly into it — no
  separate About section/page.
- No Selected Work section and no case study pages — projects are not displayed at all.
- Stack/tech list.
- Contact section (email, GitHub, LinkedIn).
- Resume: downloadable, but NOT its own dedicated section — just placed somewhere accessible
  (e.g. nav or footer).
- Primary nav stays minimal: TAHA / STACK / CONTACT (no ABOUT and no WORK nav item).

### Interactive layer (discovered, not advertised)

- **Terminal** — a real editor-style terminal, not a command palette. That distinction carries
  most of the character, so it is part of the spec:
  - **A panel that slides up from the bottom**, full width, overlaying the page (the page stays
    scrollable behind it, like an editor). Never a centred modal.
  - **Height is drag-adjustable** from a handle on the top edge. Defaults to **50dvh** on first
    open, then whatever the visitor set. Bounded: min ~120px so it stays usable, max ~90dvh so
    the site is never entirely swallowed.
  - **Panel height persists to localStorage** — and this is a deliberate exception to the
    ephemeral rule that governs edits, comments and palette. Those change _content_, where a
    returning visitor finding the site altered would be confusing. Height is a _UI preference_,
    the category CLAUDE.md already keeps in localStorage, and a visitor who resized their
    terminal would expect it remembered.
  - **The wheel stays inside the panel.** `overscroll-behavior: contain` on the scrollback stops
    it chaining to the page at the top and bottom of the buffer, but that only governs chaining
    out of a _scroll container_ — the title bar and the resize handle are not scrollable, so a
    wheel over them was never contained and scrolled the site behind. A non-passive `wheel`
    listener on the panel covers those. Note `overflow: hidden` on the panel does NOT fix this
    and clips the resize handle; it was tried and reverted.
  - **Non-modal.** No focus trap. Focus moves to the input on open; `Esc` closes and returns
    focus where it came from.
  - **The resize handle must be keyboard-operable** — `role="separator"`, `aria-orientation`,
    `aria-valuenow`, arrow keys to nudge. If it can be resized with a mouse it must be resizable
    without one.
  - **Entry:** ⌘K / Ctrl+K on desktop. On touch there is no keyboard, so a small visible button
    appears there instead (`@media (hover: none)`). On desktop that same button stays in the
    accessibility tree but is visually hidden — otherwise the feature would be undiscoverable to
    a desktop screen-reader user.
  - Commands: `about`, `stack`, `contact`, `cls`, `help`, plus the hidden `sudo hire taha`
    (playful "permission denied"). Content commands render from the content module.
  - **Command history** on ArrowUp/ArrowDown, with the half-typed line preserved and consecutive
    duplicates skipped (as shells do with HISTCONTROL=ignoredups).
  - **The session persists.** Scrollback and history are written to localStorage, so closing the
    panel or refreshing the page does not wipe it. `cls` is the only thing that clears it, and it
    clears the screen only — never the panel height. Capped at 400 lines and 50 history entries
    so a bored visitor cannot fill the storage quota.
    Stored data is treated as **untrusted on read**: every entry is shape-validated, because it
    can be hand-edited, corrupted, or left over from an older version of the component.
    A scrollback emptied by `cls` reads as "no session" on the next load, so the banner returns
    rather than the panel opening blank with no hint in it.
  - The clear command is **`cls`**, not `clear`. Its name lives in
    `site.interfaces.terminal.commands`, which is also what the source view advertises — the
    terminal derives its command list from there, so the two cannot drift.
  - **The filter for new commands:** the terminal only earns a command that does something you
    cannot do by pointing. Without that rule it accumulates commands the way the source view
    accumulated features. It is a _control surface_, not a second way to read the page.
    - **`perf`** — real transfer sizes and timings from the visitor's own page load, via the
      Navigation and Resource Timing APIs. Nothing hard-coded: the site's speed claim becomes
      verifiable in the reader's browser instead of asserted in a README. Three things it must
      keep doing: count only same-origin resources (extensions and the dev toolbar inject into
      the same timeline), say so loudly when running against the dev server (those numbers are
      nothing like the built site's), and omit first paint when it postdates load — Chrome defers
      paint in background tabs, and printing `first paint 3232ms` next to `load 69ms` reads as
      broken rather than slow.
    - **`curl /taha`** — prints the machine view as an HTTP response. Small, but it makes the
      terminal, the source view and the `/api/whoami.json` easter egg one idea seen three ways.
      Unknown paths return a real-looking 404.
    - **`get` / `set` / `theme` / `reset` — Phase 3.5.** The payoff. Once the JSON viewer is
      editable, these drive the _same state_, so editing a value in the viewer shows up in `get`,
      and `theme #ff6b6b` recolours the site and the viewer together. That is what stops the
      terminal being a third way to read the page.
    - **`whoami` — Phase 4.** Visitor id, first vs returning, what has been discovered.
  - Not building: autocomplete, a fake filesystem, tabs, split panes, a second mini-game (the API
    Simulation is the game). It is a personality feature wearing a terminal's clothes, not an
    emulator.

- **The API Simulation** — the first of the site's two headline interactions, and the one that
  demonstrates engineering depth. It replaces what
  would otherwise be three separate features (an API playground, a system-status panel, and a
  standalone mini-game) with one unified, narrative mechanic. Entirely client-side/simulated —
  no real backend calls, no real crash, no real risk — which keeps it fast and simple to build.

  **Core loop:** a minimal fetch button plus a small, understated load indicator (the load
  gauge doubles as the "system status" visualization — no separate status panel needed).
  Clicking fetches; a visible load number climbs. Spam it past a threshold and the simulated
  "server" crashes (a short, purposeful state change — not a looping animation).

  **Say nothing up front.** The section is a heading, a button and some numbers. No copy naming
  rate limiting, caching, queueing or circuit breaking — that is the whole game, and printing it
  above the button hands it over before the visitor has pressed anything. They should wonder what
  it is, press it, and find out. Explanations arrive only after a crash, and stay terse.

  **The crash must be reachable by hand.** Tune it by measuring time-to-crash across sustained
  click rates, not by feel: casual clicking (up to ~3/second) survives indefinitely, deliberate
  mashing (4+/second) falls over in a second or two. An early build survived 15 clicks/second,
  which meant only a script could ever trigger it — the centerpiece was unreachable.

  **Presses made before the island loads still count.** The section is static HTML until the
  first click, and the whole interaction is mashing, so the loader records every press while the
  chunk downloads and replays them with their real spacing. Losing them makes the first burst
  feel broken.

  **Stage progression (each stage breaks a different way — not just "click faster"):**
  1. **No protection.** Spam past the threshold → crash. This is the moment that reveals the
     hidden bug icon (see below). Fix offered: rate limiting.
  2. **Naive rate limiting.** Fixed requests per window. Broken by an attack that bursts right
     as the window resets, or spoofs multiple identities. Fix offered: caching.
  3. **Caching added.** Repeat requests get served from cache. Broken by a flood of unique
     (cache-missing) requests. Fix offered: a request queue with backpressure.
  4. **Queue added.** Enqueuing faster than the queue drains overflows it. Fix offered: a
     circuit breaker / graceful degradation.
  5. **Graceful degradation reached.** Under extreme load the "API" now returns fast
     cached/fallback responses or a polite 429 instead of dying. This is the capstone state —
     framed as "you built a production-grade API," not "it's now unbreakable."

  **The hidden bug mechanic:** after the first crash (stage 1), a small bug icon appears —
  tucked at the edge of the fetch button or an adjacent input, low-opacity, easy to miss on a
  glance, similar treatment to the achievements icon (see below), but only appears post-crash.
  Clicking it "arms" the visitor with an attack toolkit: a small panel listing specific attacks
  (burst-after-cooldown / multi-identity flood, cache-busting flood, queue flood, etc.), each
  mapped to the stage progression above. As defenses are added, older attacks in the panel show
  as visibly "patched" (grayed out, e.g. "no longer works — cache added") rather than
  disappearing — this turns the panel into a lightweight changelog of the API's hardening and
  gives the whole thing a sense of progress even before you reach the end state.

  This system fully absorbs the old API Playground, System Status panel, and "Fix the Server"
  mini-game concepts. Do not build those as separate features alongside this.

- **Source view** — the site's second representation. Every piece of core content also exists as
  a machine-readable **HTTP/JSON API response** (`GET /taha` → `200 OK` → a JSON body), and a
  small control in the bottom-right corner swaps the page between the human view and the machine
  view. It makes "the portfolio _is_ the project" something a visitor can flip a switch and see,
  rather than a claim in a paragraph.

  **The site has two headline interactions, decided deliberately.** This replaces the earlier
  "single centerpiece" rule, which the source view had already outgrown by accumulation:

  1. **The API Simulation** — demonstrates engineering depth: rate limiting, caching, queueing,
     circuit breaking. This is the evidence that Taha can build backends.
  2. **The source view** — demonstrates the "the portfolio _is_ the project" idea, and invites a
     visiting developer to make the site their own.

  They are different kinds of thing, which is why two works here. Neither may absorb the other,
  and the API Simulation is still the one a recruiter should be able to understand without
  reading code.

  Even with two, the source view has a boundary. Still out: multiple formats to choose from,
  syntax-highlighting _themes_ (one restrained token scheme is fine), export, and raw-text JSON
  editing. Anything beyond the list below needs an explicit decision.

  What the source view is allowed to contain:
  - Collapsible nodes (`<details>`/`<summary>`) with key/element counts, like a real JSON viewer.
  - One restrained token colour scheme drawn from the existing palette — keys, string values,
    numbers/booleans, punctuation. Legibility, not decoration. Punctuation carries structural
    meaning in JSON, so it must clear AA; `--color-fg-subtle` is not eligible.
  - A font-size control **scoped to the JSON only** — never a site-wide type control.
  - **Editable values (Tier 1), deferred to Phase 3.5.** Values only: strings, numbers, booleans
    edited in place, live-bound to the human view. No structural editing — no new keys, no
    changing types, no raw-text JSON editing. Editing values in place means there is no invalid
    state to handle, which is what keeps this small.
    Rules for it when built: edits render as **text, never HTML** (a visitor typing a tag must
    see the characters); edits are **ephemeral** — a reload restores the real content, nothing
    is persisted to localStorage; and a reset control is provided.
  - **Palette editing (Phase 3.5a).** Preset themes plus a custom colour picker, so a visiting
    developer can recolour the site and see it become theirs. This is the reason the source view
    counts as a headline interaction rather than a flourish.
    - **Three seeds only:** background, foreground, accent. Every other token is _derived_ from
      them with `color-mix()` — surface, borders, muted/subtle text, accent-dim/faint. Exposing
      all ten tokens would guarantee incoherent results; deriving them means any three colours
      produce a coherent system. This derivation is worth doing to the token definitions
      regardless of the feature, because those relationships currently live in comments rather
      than in code.
    - **A live contrast readout is mandatory, not optional.** Each seed shows its ratio against
      its pairing and whether it passes AA/AAA, updating as the visitor picks. Without it a
      visitor can make the site unreadable in two clicks, on a site whose spec has a hard AA
      floor. With it, the weakest part of the feature becomes a visible demonstration that
      accessibility was thought about.
    - Presets need **zero JS** (`html:has(#theme-x:checked)` reaches `:root`). Only the custom
      picker needs an island, since CSS cannot read an `<input type="color">` value.
    - Controls live in the source view's header strip, **not in the JSON body** — the body is
      content; colours are viewer settings. Putting `theme.accent` in the payload would quietly
      turn `GET /taha` from a profile response into a config document.
    - **Ephemeral**, like every other edit: reload restores the real palette. Covered by reset.
  - **Visitor comments (`//`), also Phase 3.5.** An annotation layer, never part of the payload:
    JSON has no comment syntax, so putting them in the body would invalidate a response still
    labelled `application/json`. Rendered JSONC-style beside the data and surfaced on the human
    view. Same rules as above — text not HTML, ephemeral, reset-able — plus one more: comments are
    **never persisted and never shared between visitors**. Shared comments are a guestbook, which
    is on the not-building list and needs a backend and moderation.

  Rules:
  - **One source of truth.** Both views are generated at build time from a single typed content
    module. The content is never written twice. If a change to the human view does not
    automatically change the machine view, the implementation is wrong.
  - **Zero JS.** The toggle is a visually-hidden checkbox plus `:checked ~` sibling selectors —
    natively keyboard-operable and screen-reader-labelled, no island. State does not need to
    survive a reload; this is a single-page site.
  - **Honest content.** The machine view reflects what is actually true of the site. No invented
    fields, no fake status codes, no pretending a request happened. It _may_ describe real
    capabilities the human view does not surface — it must never describe things that are false.
  - **It is the terminal's signpost.** The response includes an `interfaces` block naming the
    terminal, its shortcut, and its commands — including the hidden one. Two reasons this is
    deliberate rather than a spoiler: the terminal is otherwise undiscoverable (⌘K is advertised
    nowhere), and a secret command leaking through an API response is a better joke than a
    secret command nobody finds. It stays honest because those commands genuinely exist.
  - It shares its shape with the `/api/whoami.json` easter egg, so the two reinforce each other
    instead of being two unrelated jokes.

### Achievements — DEFERRED, do not design the list yet

**The specific achievement list is not decided and is deliberately not being worked on now.**
Build the site first. Once the site is complete, we will go through what actually exists and
derive the achievements from it — real moments the finished site offers, not a list invented
up front. Do not propose, write, or implement a concrete achievement list until then, and do
not treat the old draft chain (Hello World / Explorer / Terminal User / etc.) as spec — it is
withdrawn.

Achievements get their **own dedicated phase (Phase 5 in `PHASES.md`)**, run after the site is
built and before the final polish pass. Until that phase starts, the only achievement-related
work allowed is recording unlock-worthy moments as plain flags/events so the list can be layered
on later without rework — no achievement UI, no `/achievements` page, no unlock copy.

The _rules_ below are locked and still apply whenever achievements do get built:

- A single flat list, ordered by increasing difficulty — no Obvious/Curious/Secret categories.
- Locked achievements show as "???" until unlocked.
- Entry point: a small, unobtrusive icon (inspired by, not copied from, Duy Le's bottom-corner
  door icon) linking to a dedicated `/achievements` page. Muted/low-opacity by default, more
  visible on hover. NO idle pulse animation.
- Unlock feedback is graceful, not an animation loop: the icon's state updates quietly (or a
  brief one-time notice) rather than looping or flashing.
- No counter or achievement mention anywhere on the homepage — the icon is the only hint.
- The API Simulation is expected to be the spine of whatever list we land on, since its stage
  progression is the site's richest source of distinct unlock moments.

### Easter eggs

- Logo click sequence, hidden terminal command, a hidden "API endpoint" (a prerendered static
  route returning JSON-shaped content — no server involved), and a backend-humor 404 page.
  Discoverable through curiosity, never impossible to find.

### Visitor state / persistence

- Anonymous visitor ID generated client-side and kept in localStorage only — it never leaves the
  browser (see "No backend" above).
- Returning-visitor message + occasional small rotating discovery. No streaks, no daily rewards,
  no pressure to return — curiosity, not addiction.
- "World state" (site-wide dynamic events) is explicitly OUT for now — parked, not part of any
  current phase.

### The portfolio as its own project

- There is no backend. Nothing here calls a server (see "No backend — everything is client-side"
  above). This is intentional: fast, free to host, zero infra risk.
- The backend credibility comes from the _code_, not from running servers — the API Simulation
  implements a real rate limiter, cache, queue with backpressure, and circuit breaker, just
  driven by simulated load instead of real traffic. That reads well to anyone who opens the repo.
- A visible link to the portfolio's own public repo ("view source") — cheap, on-brand, and the
  main way a visitor inspects real code, since no other projects are shown. Since the site is the
  only project on display, this link is load-bearing, not decorative.
- **A `README.md` is a required deliverable, written at the end.** Because "view source" is part
  of the pitch, the repo's landing page is effectively a second front door — a recruiter who
  clicks through lands on the README before any code. Treat it as portfolio surface, not
  boilerplate. Written last, once the site is finished, so it describes what actually shipped.

#### What the README must cover

- What the site is, in two or three lines — including that the portfolio _is_ the project.
- Live URL, near the top.
- The stack, and **why** each piece was chosen — especially why Astro (zero client JS by default)
  and why there is no backend. The reasoning is the interesting part; a bare list is not.
- The performance constraint and the evidence it was met (real numbers: bundle sizes, Lighthouse
  scores, the fact that the recruiter path ships zero JS).
- The API Simulation explained honestly: what it demonstrates (rate limiting, caching, queue with
  backpressure, circuit breaker), and that the load is simulated client-side rather than real.
  Never imply it is a live system.
- How to run it locally (Node version, install, dev, build).
- Notable tradeoffs and what was deliberately cut. This section is the most useful signal to
  another engineer, so do not skip it.

Keep it honest and free of resume-speak. Do not oversell, do not pad, and do not describe
anything the repo does not actually contain.

### Explicitly not building

- No Selected Work / projects section, no project cards, no case study pages, no portfolio
  gallery — do not add these back unless explicitly instructed.
- No **light/dark theme toggle** — dark only, always. (Distinct from the source view's palette
  editor, which is ephemeral, hidden in the discovery layer, and never changes the default.)
- No dedicated About page/section, no dedicated Resume page/section, no achievement categories,
  no idle icon animation, no sound effects, no World State system, no separate
  puzzle systems beyond the one mini-game, no guestbook (undecided — do not implement until
  explicitly instructed), no heavy animation library, no long loading sequences, no 3D/parallax/
  cyberpunk/pixel-art/RPG-XP-bar styling.
- No backend of any kind: no server, no database, no API routes, no auth, no analytics service,
  no remote persistence. Do not add one unless explicitly instructed.
- No background layer at all — no texture, no dot grid, no grain, no glow, no matrix/binary
  rain, and nothing hover-reactive or cursor-following. See "Background" under Visual direction:
  this was built and removed. The page ground is a flat colour.
- Page transition polish: undecided — do not build unless explicitly instructed.

## Visual direction

- One clean sans-serif for content, one monospace used selectively for technical/system
  elements — not the whole site.
- Mostly neutral palette: one background/neutral, one text system, one subtle accent.
- Lots of whitespace, thin subtle borders, strong hierarchy, minimal visual noise.
- Single fixed theme (**dark**), and **no light/dark toggle** — dark is the base, it is what
  ships, and it is what every first visit sees. The palette editor in the source view (Phase
  3.5a) is a different thing: a discovery-layer toy that recolours the tokens ephemerally for
  one visitor. It never changes the default, and it is never a light-mode switch.
- Encode the above as Tailwind theme tokens (colors, font families, spacing/type scale) so the
  palette and rhythm are enforced by the config rather than by discipline.

### Background

**There is no background layer. The page ground is a flat colour.**

This was tried and removed. The machine view's own text was rendered site-wide as texture — first
tiled in columns, then as one full-height column flush left. Even at 1.4% opacity, where the
glyph pixels differ from the ground by about 3/255, it read as noise competing with the content
rather than as texture. The source-view toggle turned out to be the better home for that idea:
the JSON is legible on demand instead of half-visible all the time.

Do not reintroduce a background — not the JSON texture, not a dot grid, not grain, not a glow —
without an explicit instruction. Prior attempts and the reasons they were rejected are recorded
here so this does not get rediscovered.

## Working conventions

- Build one section at a time and wait for approval — see "Build workflow" above.
- Single-page app: core content is stacked sections on one route, anchor-navigated.
- Astro static output — core content must be in the initial HTML, not client-rendered.
- Code-split every interactive-layer feature: a Preact island dynamically imported on user
  action, never on page load. Verify with a build output check, not by assumption.
- No backend. Visitor/unlock state is localStorage only.
- All core content lives in one typed content module and is rendered from there. The human view
  and the machine view (source view) are two renderings of the same data — never two copies of
  it.
- Every new interactive feature should map to something in the locked feature list above. If a
  request would add a new major interactive system not listed here, flag it before building —
  don't quietly expand scope.
