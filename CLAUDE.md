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
- No theme toggle. Pick one theme (dark, in the spirit of both reference sites) and ship it.
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

- **Terminal** — entry via ⌘K or a small icon. Commands: `about`, `stack`, `contact`, `clear`,
  plus at least one hidden command (`sudo hire taha` → playful "permission denied").

- **The API Simulation** — the site's single centerpiece interactive system. It replaces what
  would otherwise be three separate features (an API playground, a system-status panel, and a
  standalone mini-game) with one unified, narrative mechanic. Entirely client-side/simulated —
  no real backend calls, no real crash, no real risk — which keeps it fast and simple to build.

  **Core loop:** a minimal fetch button plus a small, understated load indicator (the load
  gauge doubles as the "system status" visualization — no separate status panel needed).
  Clicking fetches; a visible load number climbs. Spam it past a threshold and the simulated
  "server" crashes (a short, purposeful state change — not a looping animation).

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

### Explicitly not building

- No Selected Work / projects section, no project cards, no case study pages, no portfolio
  gallery — do not add these back unless explicitly instructed.
- No dedicated About page/section, no dedicated Resume page/section, no achievement categories,
  no idle icon animation, no sound effects, no theme toggle, no World State system, no separate
  puzzle systems beyond the one mini-game, no guestbook (undecided — do not implement until
  explicitly instructed), no heavy animation library, no long loading sequences, no 3D/parallax/
  cyberpunk/pixel-art/RPG-XP-bar styling.
- No backend of any kind: no server, no database, no API routes, no auth, no analytics service,
  no remote persistence. Do not add one unless explicitly instructed.
- Page transition polish: undecided — do not build unless explicitly instructed.

## Visual direction

- One clean sans-serif for content, one monospace used selectively for technical/system
  elements — not the whole site.
- Mostly neutral palette: one background/neutral, one text system, one subtle accent.
- Lots of whitespace, thin subtle borders, strong hierarchy, minimal visual noise.
- Single fixed theme (dark), no toggle.
- Encode the above as Tailwind theme tokens (colors, font families, spacing/type scale) so the
  palette and rhythm are enforced by the config rather than by discipline.

## Working conventions

- Build one section at a time and wait for approval — see "Build workflow" above.
- Single-page app: core content is stacked sections on one route, anchor-navigated.
- Astro static output — core content must be in the initial HTML, not client-rendered.
- Code-split every interactive-layer feature: a Preact island dynamically imported on user
  action, never on page load. Verify with a build output check, not by assumption.
- No backend. Visitor/unlock state is localStorage only.
- Every new interactive feature should map to something in the locked feature list above. If a
  request would add a new major interactive system not listed here, flag it before building —
  don't quietly expand scope.
