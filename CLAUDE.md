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
anchors rather than page loads. **The 404 is now the only other route** — `/achievements` was a
second one and was folded into a panel; see the Achievements section for why and what it cost.

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
| Icons               | **`lucide-static`**, inlined at build time by `src/components/Icon.astro`.            |

**There is no test suite in the repo, and that is deliberate.** Suites were written for the
DOM-free engines — `policy.ts`, `tools.ts`, `themes.ts`, `flags.ts`, `dock.ts` — and used during
development, but **Taha's decision is that they are not committed**. Do not add a `tests/`
directory, a `test` script, or a framework without an explicit instruction.

What this means in practice, and it matters:

- **The engines stay DOM-free anyway.** That separation is a design rule in its own right — it is
  what lets an engine be reasoned about at all — not merely a testing convenience. Keep
  `policy.ts` and its neighbours free of `document` even though nothing now checks them
  automatically.
- **Verification is manual, and must be done by measuring rather than assuming.** Nearly every
  real bug in this project was found that way and would not have been found by reading: the
  terminal's height cap silently overridden by a stricter CSS backstop, `--color-fg-subtle` used
  for real text at 2.77:1 on the light identities, `scrollbar-width` not being an inherited
  property, a bottom-docked terminal covering its own open button.
- **Values duplicated between JS and CSS are now unguarded.** `TOP_RESERVE_PX` in `Terminal.tsx`
  against `max-height` on `.term` in `global.css` is the known pair; check both by hand whenever
  either moves.
- **Contrast is the one to be most careful with.** The derived tokens are `color-mix` on the
  seeds, so a value that passes on the dark ground can fail on the six light identities —
  `--color-fg-muted` is 6.05:1 dark but only 4.87:1 light, and `--color-fg-subtle` is below AA
  everywhere and below even 3:1 on light. Never put real text on subtle.

**Typecheck with `npm run check`, never `astro check` alone.****Typecheck with `npm run check`, never `astro check` alone.** `astro check` does not traverse the
island `.ts` files — they are reached only through a dynamic `import()` inside an inline `<script>`
— so it reported a clean bill of health on a module containing an undefined variable that threw on
load and disabled the whole feature. `npm run check` runs `astro check && tsc --noEmit`; the second
half is the one that covers `src/islands/**`.

**Six typefaces are declared, four of them lazy.** Inter and JetBrains Mono are the site's;
Newsreader, Archivo, Nunito and Space Grotesk belong to individual identities (3.6h). A
`@font-face` whose family no rendered text matches is never downloaded, so those four cost the
default path nothing — measured, not assumed: the default page fetches exactly two font files, and
a third arrives only when the identity using it is selected. **Nothing on the default path may
reference an identity face**, or it is fetched for everybody; a test asserts it.

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

On the icon dependency: it is `lucide-static` — a directory of plain SVG files — and **not**
`lucide-react` or `lucide-preact`, which ship a component and therefore client JavaScript.
`Icon.astro` reads one file with `readFileSync` at build time and inlines the markup, so an
icon costs **zero client JS**; that is the only basis on which one belongs on the recruiter
path. Two things it must keep doing: resolve from `process.cwd()`, because during a build the
component is bundled into `dist/.prerender/chunks/` and a path relative to `import.meta.url`
points nowhere; and throw on an unknown name, because the alternative is an icon that silently
renders nothing. **Styling an inlined icon from a parent component needs `:global()`** — the
SVG arrives through `set:html`, so it never carries the parent's `data-astro-cid` and a scoped
selector matches nothing at all.

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
- If a "hidden API endpoint" easter egg is ever built, it is a **prerendered static route**
  returning JSON-shaped content — it looks like an endpoint; it is a build artifact. One was
  built at `/api/whoami.json` and **removed at Taha's request**; do not rebuild it.

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
- Primary nav: TAHA / STACK / ACCESS / CONTACT. **Its links are rooted fragments (`/#stack`, not
  `#stack`)** because the nav renders on every route: from the 404 a bare
  fragment points at a section that is not on the page and the link does nothing. On the homepage
  the behaviour is unchanged — same-document navigation, no reload. Still no ABOUT and no WORK item. ACCESS was added
  after the permission sandbox replaced the API Simulation — that section deliberately had no nav
  item because it was mysterious by design, whereas this one is legible at a glance, and naming
  it in the nav states the specialism it is evidence for.

### Interactive layer (discovered, not advertised)

- **Terminal** — a real editor-style terminal, not a command palette. That distinction carries
  most of the character, so it is part of the spec:
  - **A dockable panel — bottom, left or right**, like an editor's. Never a centred modal.
    **Bottom is the default**, and the only dock offered below 40rem, where a side dock would
    leave no usable page. **Added at Taha's request (3.6g);** the panel was bottom-only before.
  - **The chosen dock and each axis's size persist** to localStorage, like the panel size always
    has — they are UI preferences, not content. Read as untrusted, like every stored value here.
  - **The page gives way to the panel**, as an editor's does — it is not an overlay. An overlay
    mode was built alongside push so the two could be compared, and **removed once push won**;
    the toggle went with it. Do not reintroduce either without an explicit instruction.
    - The side dock decided it: overlay guillotines the hero, push keeps it readable. At the
      bottom the two were nearly indistinguishable, because the page already scrolls behind the
      panel there and pushing only adds trailing room.
    - **Push has two consequences that are easy to miss.** The shared `.gutter` measures `15vw`,
      which stops being the available width the moment the page is pushed over — it has to
      subtract the dock, or a narrowed column still gets billed full-viewport padding. And the two
      `position: fixed` corner controls do not move with body padding, so they need offsetting.
  - **Size is drag-adjustable** from a handle on the panel's inner edge — the top edge at the
    bottom, the inner vertical edge when side-docked. Bottom defaults to **50dvh**; a side dock
    defaults to a **fixed ~420px**, because half the _width_ is a split screen rather than a
    terminal. **Each axis remembers its own size** — one shared number hands you a full-width
    side panel the first time you switch. Bounded: min ~120px so it stays usable, max
    `100dvh - 40px` so the site is never entirely swallowed. **Raised from ~90dvh at Taha's
    request.** The 40px is not decoration: at a true 100dvh the resize handle sits exactly on the
    viewport edge, where it cannot reliably be grabbed, so the panel would open to full height
    and refuse to come back down. The strip also keeps the nav visible, which is the only
    remaining sign the site is still behind the panel.
    **The bound lives in two places and must be kept in step** — `TOP_RESERVE_PX` in
    `Terminal.tsx` (the real clamp) and `max-height` on `.term` in `global.css` (the pre-hydration
    backstop). A stricter value in the CSS silently overrides the island, which is exactly what
    happened when the knob was raised and the stylesheet still said `90dvh`.
  - **Text size is adjustable**, 10–15px from 13px, with `A−` / `A+` in the title bar and
    Ctrl/Cmd `+` / `-` while focus is inside the panel. Persisted, like the other panel
    preferences. Notes:
    - **Only the scrollback and input scale.** The title bar is fixed at 11px — it is chrome, and
      a font control that resizes its own buttons is a toy rather than a tool.
    - **The bounds are Taha's**, narrowed from an initial 11–20. The floor is deliberately
      below the machine view's 11px, on the reasoning that a terminal is somewhere you want more
      lines on screen rather than comfortable prose.
    - **`FONT_MAX` must stay strictly above `FONT_DEFAULT`.** It was briefly set equal to it,
      which disabled `A+` the instant the panel opened and left a control that could only shrink
      text. There is a test on the inequality rather than on the numbers.
    - **The keyboard shortcut deliberately takes those keys from browser zoom**, which is only
      defensible because it is scoped — the handler lives on the panel, so it fires only while
      focus is inside it, and clicking the page gives zoom straight back. Verified: `Ctrl+=` on
      the hero is not swallowed.
    - **This is not the control that was removed.** A font-size control for the _source view_ was
      built and removed at Taha's request — 11px is the size that view is designed at. A terminal
      is different in kind: it is a tool you work in, and text size is a standard terminal
      affordance, like the resize handle it already has. Do not read this as licence to
      reintroduce the JSON one.
  - **Panel height persists to localStorage** — and this is a deliberate exception to the
    ephemeral rule that governs edits and palette. Those change _content_, where a
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
  - **Entry: a visible button on every device**, bottom-right, paired with the source-view
    toggle; ⌘K / Ctrl+K still works and is named in the button's tooltip.
    - **It is a toggle, and it is lit while the panel is open** — like the source-view control
      beside it and the achievements door opposite. It used to only ever open, so the one visible
      way in had no way out: ⌘K toggled, the button did not. The highlight is keyed on
      `:root[data-term-open]`, not on the click, so it is right however the panel was opened —
      button, shortcut, or a command that closed it. `aria-expanded` is kept in step in
      `markOpen()`, the single place that knows the truth.
    - **Every fixed corner control must step aside for the dock.** Only the _right_ dock had such
      rules, which meant a bottom-docked terminal — the default — drew itself over its own open
      button and the source-view toggle: openable by clicking, then not closable the same way,
      because the button was underneath the panel. All four controls now offset for bottom and for
      the side that would cover them, and there is a test per control per dock. It used to be
      touch-only and visually hidden on desktop, on the reasoning that ⌘K covered desktop and the
      source view's JSON was the signpost. That put the discoverability of a headline pillar behind
      "open the machine view and read it", which is too much to ask. The button is the entry point
      now, and the JSON no longer carries a command list.
  - Commands: `about`, `stack`, `contact`, `help`, `cls`, the four tools below, plus the hidden
    `sudo hire taha` (playful "permission denied"). Content commands render from the content
    module.
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
  - The clear command is **`cls`**, not `clear`. Its name used to live in
    `site.interfaces.terminal.commands` so the source view could advertise it and the two could
    not drift. The source view no longer advertises commands, so there is nothing to drift from:
    the registry now lives in `commands.ts`, where each command's **usage, one-line description
    and implementation sit in the same object**. `help` is generated from it, so a command
    cannot be added without also being documented.
  - **The filter for new commands:** the terminal only earns a command that does something you
    cannot do by pointing. Without that rule it accumulates commands the way the source view
    accumulated features. It is a _control surface_, not a second way to read the page.
    - **Built and then removed at Taha's request: `perf` and `curl`.** They satisfied the
      filter above and worked, but he did not want them. Do not rebuild either without an
      explicit instruction. `perf` read real Navigation/Resource Timing numbers; `curl /taha`
      printed the machine view as an HTTP response.
  - **What the terminal is actually for, decided after review.** Shown to a friend, his first
    question was "what can be done through this terminal?" — and the only honest answer was "you
    can read the same data in another format". That is a failed feature. The fix is not more
    commands; it is commands that **do** rather than **print**. `perf` and `curl` both printed,
    which is exactly why they were boring. Three things are being built, **in this order**:
    1. **Real tools — built.** `jwt <token>` decodes a JWT locally — header, claims, expiry —
       plus `hash`, `uuid`, `base64`. Nothing is sent anywhere; these are real algorithms running
       in the browser. An engineer who decodes a token here has _used the site to get work done_,
       which is the difference between a portfolio you look at and one you bookmark. Perfectly
       on-brand for an engineer whose subject is auth. Rules that came out of building it:
       - **The algorithms live in `tools.ts`, DOM-free and tested in Node**, exactly like
         `policy.ts`. This is the part an engineer reading the repo actually opens, so it is not
         allowed to be tangled up in the component.
       - **`jwt` decodes; it must never look like it verifies.** It says so in the output, every
         time. Verifying needs the signing key, which a static site does not have and would never
         be given — and on an auth engineer's site this is the one place the copy must not
         overstate itself. It also states that nothing was sent anywhere, which is true and
         checkable in the repo.
       - **Only the verb is normalised.** The argument is passed through untouched: tokens,
         base64 and hash inputs are all case- and whitespace-sensitive, and the old
         `input.toLowerCase()` over the whole line would have silently corrupted every one of
         them.
       - **`base64` never guesses the direction** — valid base64 is also valid text, so
         `encode`/`decode` is required. And it goes through `TextEncoder`, because `btoa` throws
         on anything outside Latin-1; "café" breaking would be a poor advertisement.
       - **`hash` has no md5, and says why** rather than erroring blankly: WebCrypto omits it
         deliberately. A real constraint, explained, beats a bare failure.
       - **A command may return a Promise**, because `crypto.subtle` is async. The input echoes
         immediately and the output appends when it resolves, so the line never looks ignored.
       - `uuid` is capped at 10 so it cannot push out the 400-line scrollback.
    2. **Secrets worth finding — built.** The chain is four steps: `help` says "not everything is
       listed"; `auth` reports the session as unauthenticated and shows its usage; a real HS256
       JWT sits in an HTML comment in the page source; `auth <token>` verifies it and grants the
       `sudo` scope, after which `sudo hire taha` **succeeds** instead of denying and `help`
       reveals it. An auth-flavoured challenge on an auth engineer's site is the point, not a
       coincidence. Rules:
       - **The signature is really verified** — HMAC-SHA256 in `tools.ts`, minted at build time
         in `Base.astro` so the token in the comment carries a genuine signature rather than a
         pasted string. Node and the browser share one `crypto.subtle` implementation.
       - **And the key ships in the bundle, which is said out loud.** Every successful `auth`
         prints that the key is not a secret. That is the joke and the lesson: client-side
         verification is theatre. Anyone who reads the key can mint their own token — that is the
         deeper easter egg, not a hole, because nothing here protects anything.
       - **Claims are only read after the signature holds.** Trusting an unverified payload is
         precisely the mistake the section is about, so the code must not make it.
       - **The token carries no `exp`.** An expiry would break the puzzle silently at some future
         date with nobody watching. Asserted in the tests, because it is the kind of thing that
         bites long after anyone remembers why.
       - **The joke survives for everyone.** `sudo hire taha` still gives the playful denial when
         locked; it gains a second ending rather than losing the first.
       - **The unlock persists** to localStorage, unlike the sandbox's drafts — a draft is an
         unfinished attempt, this is earned progress, and taking it away would mean solving the
         same puzzle twice. It is the Phase 5 achievement flag for the terminal — the "access"
         residue, which Phase 4 was going to remember before it was removed. Read as untrusted, like every stored value here.
       - **`src/data/secret.ts` stays dependency-free** — data, not behaviour. It must not import
         from `src/islands/`; that inverts the layering and breaks Node's type-stripping loader,
         which will not resolve the extensionless relative import the bundler accepts.
    3. **The control surface — built.** `theme <name>`, `set <path> <value>`, `reset`,
       `open <section>` — one line doing what several clicks do, driving the _same state_ as the
       source view rather than duplicating it. Plumbing rather than excitement; built because it
       links the pillars together, not because it is the draw. Rules:
       - **"Same state" is literal, not aspirational.** `theme` checks the very radio the palette
         buttons check, so `html:has(#theme-x:checked)` recolours with no JS in the path at all.
         `set` and `reset` go through the source view's own editor closure — the same `write()`
         the contenteditable cells call, the same function the reset button calls. Proven both
         ways: a `set` from the terminal is undone by the source view's reset button, and a value
         typed into the JSON is undone by `reset`.
       - **The editor is therefore mounted on demand and must be idempotent.** Two front doors now
         ask for it — the source-view toggle and `set` — and a second `mountEditor` would attach a
         duplicate reset listener. `ensureEditor()` guards it.
       - **Only the path is a token; the rest of the line is the value.** Quotes optional, so
         `set role Backend Engineer` keeps all three words. Splitting on whitespace would have
         silently truncated every multi-word value.
       - **`open` must not pass `behavior: 'smooth'`.** The JS option overrides CSS
         `scroll-behavior`, and global.css flips that to `auto` under `prefers-reduced-motion` —
         hardcoding smooth would force the animation on exactly the people who opted out. Omit the
         option and the CSS guard applies.
       - **`open` closes the panel first.** At full height the terminal covers the page, so
         scrolling behind it would look like the command did nothing.
       - **`theme` stays a separate verb from `set`.** Colours are viewer settings, not payload;
         one verb for both would blur the boundary that keeps `theme.accent` out of `GET /taha`.
       - Ephemeral like everything else in the discovery layer. The scrollback persists though, so
         a reload shows the command with its effect gone — consistent, mildly odd, left alone.
    - **`whoami` was planned and then cut at Taha's request.** Do not build it. The
      returning-visitor work it belonged to was removed with Phase 4.
  - Not building: autocomplete, a fake filesystem, tabs, split panes. It is a personality feature
    wearing a terminal's clothes, not an emulator.

- **The Permission Sandbox** — the interaction that demonstrates engineering depth, and the
  replacement for the API Simulation (removed; see below). Entirely client-side, no backend.

  **Why this and not the thing it replaces.** The API Simulation was a _curriculum_: five stages
  in a fixed order where the right move was always "press the one button that just appeared". The
  visitor stopped being the person doing things after stage 1, and its subject — load and failure
  — is inherently invisible, so it had to be narrated in six counters and still did not land.
  Taha could not follow it himself. The sandbox is the opposite shape on every axis: **one screen,
  one idea you can see, no progression, and you are always the one moving.**

  **The shape:** a small organisation — a handful of roles, a handful of resources. The visitor
  picks who they are, then tries to do things. Every answer is immediate and every _denial names
  the rule that produced it_. Permissions can be flipped, and the consequences ripple: grant one
  thing and watch what else becomes possible.

  Rules for it:
  - **It is his actual subject.** `RBAC across 840+ endpoints` is already a proof chip. This is
    the one part of the site where the interactive layer and the résumé are the same claim.
  - **Legible without a backend background.** "Can this person do this? No, and here is why" needs
    no explaining. The plain-words rule from the old section still applies in full: plain language
    carries the meaning, the real term rides along as a dim tag.
  - **No stages, no win state.** It is a sandbox. Nothing unlocks in sequence, so nothing can be
    ground through or get boring in a fixed order. The good moments are _discoveries_ — that a
    deny always beats an allow, or that a particular combination quietly grants more than it looks
    like it does.
  - **A real policy engine**, DOM-free and testable in Node without a browser, the same way the
    old engine was. That is where the engineering credibility lives, and it is what an engineer
    reading the repo will actually look at.
  - **Nothing here persists.** A draft is an attempt at a puzzle, not a preference: finding
    yesterday's half-finished answer already filled in is worse than starting clean, and it robs
    the visitor of the blank page the scenario is meant to hand them. A reload resets it.
    **This is a change from the original plan**, which had the policy persisting as the residue
    Phase 4 would remember. It does not — and Phase 4 has since been removed, so Phase 5 takes
    something else from this pillar —
    _which scenarios were solved_ is the obvious candidate, and it is a different thing from the
    draft. Decide it there, not here.
  - **A fictional workspace, not this site.** Projects, an invoice, an API key, a member list.
    Making the resources _this site_ — "who can edit the hero?" — is cuter but risks implying the
    permissions are real, and tangles this pillar into the customization one. Decided: fictional.
  - **Smaller than the thing it replaces.** Roughly half the vertical space the API Simulation
    took. It is legible rather than mysterious, so it does not need room to unfold.
  - **No "say nothing up front" here.** That rule cost the API Simulation dearly. A recruiter
    should understand this within about five seconds: a heading, a role selector, and a list of
    plain sentences. The depth is available, not hidden.

  **The API Simulation is removed.** Rate limiting, caching, queue-with-backpressure and the
  circuit breaker were built in full and every defence provably defeated the attack it answered —
  but the whole was harder to follow than any part of it. Its engine is deleted rather than left
  unreachable: dead code is clutter in a repo that _is_ the portfolio. Do not rebuild it, and do
  not reintroduce a staged progression anywhere else.

- **Source view** — the site's second representation. Every piece of core content also exists as
  a machine-readable **HTTP/JSON API response** (`GET /taha` → `200 OK` → a JSON body), and a
  small control in the bottom-right corner swaps the page between the human view and the machine
  view. It makes "the portfolio _is_ the project" something a visitor can flip a switch and see,
  rather than a claim in a paragraph.

  **The site has two headline interactions, decided deliberately.** This replaces the earlier
  "single centerpiece" rule, which the source view had already outgrown by accumulation:

  1. **The Permission Sandbox** — demonstrates engineering depth in Taha's actual specialty.
  2. **The source view** — demonstrates the "the portfolio _is_ the project" idea, and invites a
     visiting developer to make the site their own.
  3. **The terminal** — the power-user surface: a real tool, and the place with secrets in it.

  These are the site's **three pillars**, and they are deliberately three different _kinds_ of
  thing. None may absorb another. Each leaves a different residue — a configuration you built,
  a version you made yours, a history of what you found — which is what the Phase 5 achievement
  list is derived from. (Phase 4 was going to remember these too; it was removed, and the list is
  the return mechanic instead.) The sandbox is still the one a
  recruiter should be able to understand without reading code.

  Even with two, the source view has a boundary. Still out: multiple formats to choose from,
  syntax-highlighting _themes_ (one restrained token scheme is fine), export, and raw-text JSON
  editing. Anything beyond the list below needs an explicit decision.

  What the source view is allowed to contain:
  - Collapsible nodes (`<details>`/`<summary>`) with key/element counts, like a real JSON viewer.
  - One restrained token colour scheme drawn from the existing palette — keys, string values,
    numbers/booleans, punctuation. Legibility, not decoration. Punctuation carries structural
    meaning in JSON, so it must clear AA; `--color-fg-subtle` is not eligible.
  - ~~A font-size control scoped to the JSON only.~~ **Built and removed at Taha's request** —
    11px is the size the view is designed at. Do not reintroduce one.
  - **Editable values — built.** Values only: strings edited in place, live-bound to the human
    view as text, as a link's destination, or as page metadata (editing `meta.title` moves the
    browser tab). **Array add/remove is built too**, for arrays of strings and of objects — a new
    object keeps the shape of its siblings, same keys in the same order, with only the values
    blank and editable. Still no new keys, no type changes and no raw-text JSON editing, which is
    what keeps an invalid state unreachable. Edits render as **text, never HTML**; they are
    **ephemeral** — a reload restores the real content, nothing is persisted; and there is a
    reset control. Only values the page actually renders are editable, derived from the DOM
    rather than from a second list.
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
    - Presets need **zero JS** (`html:has(#theme-x:checked)` reaches `:root`). **Built**: four
      dark presets, each setting only the three seeds. A custom colour picker was built alongside
      them and **removed at Taha's request** — arbitrary colours are how a coherent design system
      turns wonky, and it needed a script. **Do not rebuild the picker.**
    - **Four presets is not enough, and the answer is more axes and more generated options — not
      a colour wheel.** Two things are being built, **in this order**:
      1. **Generated palettes — built.** A palette is already _one hue plus a rule_, since nine
         tokens derive from three seeds by `color-mix()`. So the rule is written down and applied
         to a list of hues: **twelve swatches**, one hand-picked `default` plus eleven generated,
         all contrast-validated at build time. Many more options with none of the wonkiness the
         picker caused, because the visitor chooses a _hue_ and the system chooses the rest.
         Rules that came out of building it:
         - **Generated in OKLCH, shipped as hex.** OKLCH because its lightness is perceptually
           uniform — in HSL one recipe would make yellow far brighter than blue and the contrast
           would swing across the wheel. Converted at build time rather than emitting `oklch()`,
           so the value that is contrast-checked is byte-for-byte the value the browser paints.
         - **The recipe's lightness is measured, not chosen.** sRGB is not equally wide at every
           hue, so a fixed chroma gets clipped at some hues and not others — at L=0.82 indigo kept
           0.089 while amber kept 0.145, and a set that uneven does not read as one family. L=0.74
           is where the narrowest hue can hold the most: teal limits below it, indigo above, and
           the curves cross there. Every generated accent is now L=0.740, C=0.125, nothing
           clipped, all AAA.
         - **A clipped channel is a bug, not a rounding detail.** Per-channel clipping shifts hue
           as well as chroma, so the generated blue stops being the blue the recipe asked for.
           Chroma is reduced by binary search until the colour fits, and the tests assert no
           accent sits on the sRGB boundary.
         - **The derived text token is validated too.** `--color-accent-soft` is a runtime
           `color-mix()` that carries small text, which makes it the one derived value that can
           quietly fall under AA. The oklab mix is reproduced at build time and checked. With four
           hand-picked palettes it was measured by hand; with twelve it cannot be.
         - **`default` is never generated.** It is what ships and what every first visit sees, and
           the CSS deliberately emits nothing for it — selecting it is the absence of an override.
         - **The control stays named labels, and shows only four.** A swatch row was built and
           **reverted at Taha's request** — the names are the point, since "amber" and "azure"
           say what they are where a dozen anonymous squares make you click each to find out.
           Do not rebuild the swatches.
         - **Four featured, eight unlisted — and the unlisted ones are not removed.** The source
           view labels `default`, `amber`, `azure` and `violet`; the terminal's `theme` command
           reaches all twelve. This works because the radios and their labels are already
           separate in the markup: all twelve radios render (they are `sr-only`), only four get
           a label, and an unlabelled radio is still checkable. Same shape as the terminal's
           hidden command — depth without clutter.
           - **Every palette keeps its seed rule and its contrast readout**, featured or not.
             Dropping either would make a terminal-selected palette silently do nothing, or show
             the wrong figures — and the readout is not optional.
         - **Every per-palette rule is generated**, including the three sibling-combinator blocks
           that used to be hand-written in `SourceView.astro`. A sibling combinator cannot be
           parameterised, so a dozen palettes meant three dozen hand-maintained lines.
      2. **Twelve identities, six dark and six light (3.6h) — built.** Every theme is a full
         identity, not a recolour: typeface, ground, borders, corners, density and palette. Six
         _shapes_ — clean, terminal, editorial, brutal, blueprint, soft — each worn twice, once on
         a dark ground and once on a light one. Rules:
         - **A shape is defined once and worn twice.** `SHAPES` is keyed by design, `SHAPE_OF`
           maps themes onto it, so a dark/light pair shares one object and cannot drift. Twelve
           separate definitions would defeat the point.
         - **Grounds must be `color-mix` on the seeds, never fixed colours.** That is the only
           reason a grid, a scanline and a wash all invert correctly on a light ground with no
           light-specific values. A hardcoded colour would need doubling per polarity.
         - **`clean` is the absence of every override, on both grounds.** The shipped site is what
           the other five depart from.
         - **Identity typefaces are lazy and must stay that way.** See the stack section: nothing
           on the default path may reference one.
         - **Layout is one of the axes, not just colour and type.** `--layout-align`,
           `--layout-justify`, `--layout-mx` and `--label-cols` let a look centre the hero and
           stack the section labels. That is the difference between a repaint and a different
           site, and the tests assert it: every look must move type **and** either the layout or
           the ground.
         - **The grounds are the part Taha liked most**, so they are multi-layer and deliberate —
           a phosphor glow, a two-scale drafting grid, diagonal bands, a three-stop wash. Still
           `color-mix` on the seeds, still off by default.
         - **The theme listing groups by look**, and `HUES` is ordered in pairs, so twelve names
           read as six designs on two grounds.
         - Measure the hero at 360 and 390 **per identity** when touching any of this. Six
           typefaces, display sizes from 28px to 96px; the clamp floors matter more than the
           ceilings.

      3. **Vibes, not palettes — built.** A preset changes the site's whole character, not three
         colours: palette **plus** typography **plus** density **plus** border treatment. Still
         zero JS — the same radio group setting more tokens. Rules:
         - **The four keep their colour names**, at Taha's request: `default`, `amber`, `azure`,
           `violet`. The name is a colour and the identity is a whole design; "amber" naming a
           warm mono identity reads fine. Do not rename them to identity words.
         - **Each vibe is one selector.** Colour, type, density and borders are emitted together
           in the same `html:has(#theme-x:checked)` rule, which is what makes a vibe a single
           thing rather than four settings that happen to agree.
         - **Density is `--spacing`**, Tailwind v4's own base unit — every `p-*`, `gap-*` and
           `m-*` derives from it, so one override rescales the page. `--spacing-section` is now
           `calc(var(--spacing) * 24)` for the same reason: without that the largest spacing on
           the page ignored the density axis entirely.
         - **Typography goes through `--font-body` and `--font-display`**, not by redefining
           `--font-sans`/`--font-mono`. The two stacks stay what they are; a vibe repoints what
           the page _uses_, so "everything mono" is one override.
         - **A mono vibe must shrink the display size.** A monospace face at the same clamp is far
           wider than Inter, and the hero overflows a phone. Measured per vibe at 360 and 390,
           not once.
         - **Radius and border weight are tokens now** (`--radius`, `--radius-lg`, `--border-w`).
           Tailwind inlines `1px` into `.border-b`/`.border-t` rather than referencing a var, so
           those two are re-pointed by an unlayered rule — otherwise the weight axis cannot reach
           the nav, the section rules or the footer.
         - **A vibe on an unlisted palette throws at build.** Only the featured four have a label,
           so only they can carry one; anything else is dead weight that looks like a feature.
    - **Reordering and hiding sections** — letting a visitor rearrange the page rather than just
      recolour it — is a real third axis and the deepest form of "make it yours". Parked, not
      cut; revisit after the two above are in.
    - **A share link is not being built for content.** The state would fit in a URL fragment with
      no backend, but a link that makes Taha's portfolio say anything, shareable, is a defacement
      vector aimed at him personally. A palette-only share link is harmless; content is not.
    - Controls live in the source view's header strip, **not in the JSON body** — the body is
      content; colours are viewer settings. Putting `theme.accent` in the payload would quietly
      turn `GET /taha` from a profile response into a config document.
    - **Ephemeral**, like every other edit: reload restores the real palette. Covered by reset.
  - ~~**Visitor comments (`//`).**~~ **Cut at Taha's request, never built.** Do not build it
    without an explicit instruction. The unresolved half was never the JSON but how a comment
    would show on the **human** view: every treatment adds a permanently visible marker to a page
    whose whole design is low-noise, and it would have been the only part of the discovery layer
    leaving a mark on the recruiter path. If revived: comments are an annotation layer and never
    part of the payload (JSON has no comment syntax, so putting them in the body would invalidate
    a response still labelled `application/json`), and they are never persisted and never shared
    between visitors — shared comments are a guestbook, which is on the not-building list.

  Rules:
  - **One source of truth.** Both views are generated at build time from a single typed content
    module. The content is never written twice. If a change to the human view does not
    automatically change the machine view, the implementation is wrong.
  - **Zero JS for everything except editing.** The toggle is a visually-hidden checkbox plus
    `:checked ~` sibling selectors — natively keyboard-operable and screen-reader-labelled, no
    island — and the palette presets are a radio group `html:has(#theme-x:checked)` carries up to
    `:root`. Editing is the one thing here that genuinely cannot be done in CSS, so it is the one
    thing that loads a script, and only once the view is actually opened. Do not let anything else
    reach for JavaScript without that same argument. State does not need to survive a reload;
    this is a single-page site.
  - **Honest content.** The machine view reflects what is actually true of the site. No invented
    fields, no fake status codes, no pretending a request happened. It _may_ describe real
    capabilities the human view does not surface — it must never describe things that are false.
  - **It leaks exactly one thing: the secret.** The payload used to carry an `interfaces` block
    naming the terminal, its shortcut and every command, because the terminal had no visible
    entry point and would otherwise have been undiscoverable. It has a button now, so the
    signpost is redundant, and a command list was never really profile data — it made
    `GET /taha` part config document. **Removed at Taha's request.**
    What stays is a single top-level `undocumented: ["sudo hire taha"]`, which was always the
    better half: a secret leaking through an API response beats a secret nobody finds. It is
    honest, because the command genuinely works, and for a visitor who has not solved the unlock
    chain it is the **only** place the command is written down — `help` says "not everything is
    listed" and nothing more, until the `sudo` scope is earned and it reveals the command itself.

### Achievements — DEFERRED, do not design the list yet

**The list is decided — fourteen, approved after an audit; see PHASES.md Phase 5 step 1 for the
list, the cuts and the reasons.** (Thirteen, plus a completion capstone added later.) What follows is the original deferral note, kept because its
rules still bind.

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

- A single flat list, **ordered by increasing difficulty, with no difficulty labels on the page**
  — no Obvious/Curious/Secret categories, and no "easy/medium/hard" either. Taha's call on both:
  the list should feel like it is getting harder without announcing tiers. The ordering is the
  only signal, so it has to be right; the groupings are asserted in the tests.
- ~~Locked achievements show as "???" until unlocked.~~ **Changed at Taha's request: every entry
  shows its title and what it takes, earned or not, greyed out until it is.** The list reads as a
  checklist of what is left rather than a wall of mystery — which is what makes it the return
  mechanic that replaced Phase 4. Two consequences worth keeping:
  - ~~**The labels belong in the HTML**, so the page is complete with JavaScript off.~~
    **Withdrawn with the route.** A panel built at runtime cannot render without its script, and
    that was accepted knowingly: the list is _entirely_ per-visitor state that only exists in
    localStorage, so JavaScript-off gave you a catalogue and no progress anyway. What replaced it
    are two properties the page never had, both asserted in the tests — **the panel is imported
    dynamically**, so no label reaches the initial bundle, and **the loader never reads stored
    flags**, which is the rule that actually keeps content JavaScript off the recruiter path.
  - **Earned state must differ in shape, not only colour** — a dot becomes a tick. The first
    version coloured the same `·` two ways, which reads as identical to anyone who cannot separate
    the colours (WCAG 1.4.1).
- Entry point: a small, unobtrusive icon in the bottom-left corner — a bordered box holding
  Lucide's `shapes` mark, `opacity: 0.22` at rest and full on hover or focus, and lit while the
  panel it controls is open. NO idle pulse animation.
  - **It is a toggle, not a link, and there is no `/achievements` route.** Changed at Taha's
    request: the site is an SPA, and a whole route for a thirteen-row list was the one thing that
    was not. Three corner controls that behave the same way read as one set.
  - **Removing the route fixed a defect it was carrying.** `/achievements` (and the 404) shipped
    the entire `GET /taha` payload and a working source-view toggle, so pressing `{ }` there
    swapped a page about achievements for JSON about Taha. **The source view now renders only on
    the homepage** — it is the machine rendering of _this page's_ content, and only one page has
    one. The checkbox, the panel and the label are one feature and render as one.
  - **The terminal and the source-view control stay visible while the panel is open**, at Taha's
    instruction. Hiding them was considered and rejected: the best moment this feature has is
    watching a row tick over while you work in the terminal, and it is the modality the terminal's
    own spec rejects. The one exception is the source view, which swaps the whole page rather than
    docking — opening it closes the panel, and that listener lives in the panel's chunk.
  - **The three corner controls all step aside for a docked terminal.** Only the right dock had
    such a rule; a left dock slid straight underneath the door, the notices and the panel, and a
    bottom dock covered the corner outright. Both are handled now.
  - **A box, not a bare glyph, at Taha's request.** The terminal and source-view controls in the
    opposite corner are boxes; matching them makes the door read as a control rather than as a
    smudge on the page, and it does that without making it loud.
  - **Deliberately hard to spot, at Taha's request** — but never `opacity: 0`. Invisible is not
    the same as unobtrusive, and an icon nobody can find is a feature that does not exist.
    (Raised from `0.09`, which the box treatment made unnecessary.)
  - **It must never read stored flags.** This is the rule that matters, and it survived the
    change to a toggle: no script in the initial page asks what has been earned, so there is no
    content JavaScript on the recruiter path — the one thing removing Phase 4 protected. The door
    was a plain `<a>` costing zero bytes; as a toggle it costs a loader, the same trade the
    terminal and the source view already make. **Measured: 1,267 → 1,587 B gzipped.** That is the
    number to check if it is ever touched.
  - Keyboard-focusable with a real accessible name, and a 44×44 hit area even though the mark
    inside is small — a hidden game that excludes screen-reader and keyboard visitors is just
    broken.
- Unlock feedback is graceful, not an animation loop. **Built as a one-time card** — the `shapes`
  mark, an `Unlocked` kicker, the title and the moment, with an accent left border, held ~5s —
  not the icon's state: updating the icon would mean reading stored flags on the homepage, which is
  content JavaScript on the recruiter path and the one thing removing Phase 4 protected.
  - **This does not contradict "no achievement mention on the homepage" below.** That rule forbids
    _persistent_ chrome — a counter, a badge, a standing hint. A line that appears once, for a few
    seconds, only for someone already inside an island, is what this sentence permits. Nothing
    stays behind, and a visitor who never opens anything never sees one.
  - **It deliberately does not link to `/achievements`.** It stacks just above the door instead,
    so it gestures at where the door is without handing it over — finding it stays an achievement.
    It carries the door's own mark, so the notice and the place it points at are visibly the same
    thing.
  - **It is a card because a line was missable.** The first build was one thin mono line, and
    Taha's instruction was that an unlock must be plainly seen. Legibility is the constraint
    here, not restraint — but it still shows once, still leaves nothing behind, and still never
    loops.
  - **The entrance is a CSS animation with no JavaScript trigger.** A `requestAnimationFrame`
    trigger was tried and is wrong: rAF is paused in a backgrounded tab, so the notice would sit
    at `opacity: 0` for its whole life and be removed unseen. An animation on insert plays
    whenever the tab is painted.
- No counter or achievement mention anywhere on the homepage — the icon is the only hint.
- **The API Simulation was going to be the spine of the list; it no longer exists.** What replaced
  it is richer anyway: the permission sandbox's nine scenarios across three levels, the terminal's
  six real tools and its four-step auth chain, twelve identities including six light ones, the
  dockable panel, the source view's editing, and the 404. Derive the list from those.
- **The wording is present tense**, labels and descriptions both, at Taha's request. The panel
  is read as a checklist of what is left far more often than as a trophy case, and past tense
  told an unearned row it had already happened. Noun-phrase entries have no tense to change.
- **One capstone, and it must never count itself.** `all-found` ("Nothing left to find") is
  earned when every _other_ entry is in — added at Taha's request. Requiring all fourteen to earn
  the fourteenth is a set that can never close, so `COMPLETION` is excluded from its own
  requirement and there is a test on that. It is awarded from `sealIfComplete()` in `award.ts`,
  the single point every island records through, so it cannot be missed depending on which island
  happened to earn the last one — with one explicit call from the panel, which uses `earn()`
  directly and is otherwise the one path that could complete the set silently.
- **The list can be reset**, from the panel's footer — also at Taha's request. It clears
  **`taha:earned` and nothing else**. A first version also cleared the solved briefs, on the
  reasoning that they are what "clear the board" counts; Taha's instruction was that it reset the
  achievements only, and he is right that the two are different things — `taha:solved` is the
  sandbox's own progress, and a control labelled "reset achievements" has no business reaching
  into another feature's state. The consequence, so it is not later mistaken for a bug: someone
  who had solved every brief re-earns "clear the board" on their next solve, because the sandbox
  still remembers the other eight. Also untouched, for the same reason: the terminal's earned
  `sudo` scope, which is a capability rather than a record, and its UI preferences, which were
  never progress. Two-step ("Reset" → "Reset everything?", disarming after 4s) rather than a
  `confirm()`: a browser modal blocks the page and is drawn by the OS on a site with twelve
  identities.
- **No "return visit" achievement** — Phase 4 was removed and the list _is_ the return mechanic.

### Easter eggs

Two, both built: the **hidden terminal command** (`sudo hire taha`) and a **backend-humour 404
page**. Discoverable through curiosity, never impossible to find.

**Cut, and not to be rebuilt without an explicit instruction:** the logo click sequence (never
built — the terminal and the source view already have entry points, and it could not unlock
anything while achievements are deferred) and the `/api/whoami.json` route (built, then removed).

The 404 is honest about itself: it is served as `text/html`, so its framing block says so rather
than borrowing the source view's `application/json`. It does not report the path the visitor
tried, because reading that needs a script and the page otherwise needs none.

### Visitor state / persistence

- **State is localStorage only** and never leaves the browser (see "No backend" above). Every
  stored value is read as **untrusted** — shape-validated on the way in, because it can be
  hand-edited, corrupted, or left over from an older version of the code.
- **Write-once flags, not counters.** No streaks, no daily rewards, no date arithmetic beyond a
  first-seen timestamp — curiosity, not addiction. That rule is what stops a "you haven't visited
  in 3 days" mechanic appearing later.
- **The return experience is the achievement list, and nothing else.** A returning-visitor
  message, a rotating discovery hint and an anonymous visitor ID were all specced and then
  **removed at Taha's request** — achievements persist, so a visitor who found three things
  already has a concrete reason to return, and a list naming what is still unfound says what is
  left far better than "welcome back" does. The ID had no consumer either: with no backend and
  no analytics, nothing reads it. **Do not rebuild any of the three.**
  - There is a second reason worth keeping: that message was the only planned feature that would
    have put _content_ JavaScript on the recruiter path. The initial page runs loaders and nothing
    else, and that is what makes "ships no JS until the visitor asks for it" literally true.
- **What persists today:** the earned `sudo` scope from the terminal's auth chain, and the
  terminal's own UI preferences (dock, per-axis size, scrollback, history). Achievement flags are
  Phase 5's job.
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
  scores). State the JS honestly per the "On 'zero JS'" note above — the recruiter path ships only
  the on-demand loaders, measured, not zero. Do not round it down to zero for a better line.
- The Permission Sandbox explained honestly: what it demonstrates (a real policy engine — explicit
  denials win, conditional grants, least-privilege grading, privilege-escalation analysis), and
  that the workspace it reasons about is fictional. Never imply it guards anything real.
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
  ships, and it is what every first visit sees. **Light identities exist (3.6h) and are terminal-
  only**, which is the line that keeps this from being a mode switch: six of the twelve themes are
  light, none is labelled in the source view, and there is no brightness control anywhere a
  recruiter goes. Putting a light theme on the page would make it a toggle. The palette editor in the source view (Phase
  3.5a) is a different thing: a discovery-layer toy that recolours the tokens ephemerally for
  one visitor. It never changes the default, and it is never a light-mode switch.
- Encode the above as Tailwind theme tokens (colors, font families, spacing/type scale) so the
  palette and rhythm are enforced by the config rather than by discipline.

### Scrollbars

**Custom, site-wide, theme-derived** — added at Taha's request. Two rules and no JavaScript.

- **`scrollbar-color` inherits; `scrollbar-width` does not.** This is the whole trap. Set on
  `:root` alone, the page bar went thin and every inner container — the terminal's scrollback, the
  achievements list, the source view — kept the 15px platform bar, correctly coloured and the
  wrong size, with the platform's stepper arrows on it. The width goes on `*`. Measured, not read:
  `getComputedStyle(list).scrollbarWidth` said `auto` while `:root` said `thin`.
- **The thumb is `color-mix` on the seeds**, so all twelve identities recolour for free and light
  grounds invert with no light-specific values. Never a fixed colour.
- **54%, and the number is measured.** A scrollbar is a non-text UI component, so the bar is
  WCAG 1.4.11's **3:1**, not 4.5:1. It was `--color-fg-subtle` (44%) first — 3.2:1 on the dark
  ground, and 2.77–2.79:1 on all six light identities, which the per-theme test caught. 50% lands
  on exactly 3.00; 54% is the first step with real margin, at 3.35:1 worst case. Asserted per
  theme against both the page ground and a panel's surface.
- **The track is transparent**, so it takes whichever ground it is standing on — `--color-bg` on
  the page, `--color-surface` in a panel — rather than needing a rule per container.
- The `::-webkit-scrollbar` block is a **Safari fallback only**. Chrome ignores it once
  `scrollbar-color` is set, and where it does apply, `::-webkit-scrollbar-button` must stay
  `display: none` or the arrows come back.

### Background

**There is no background layer. The page ground is a flat colour.**

This was tried and removed. The machine view's own text was rendered site-wide as texture — first
tiled in columns, then as one full-height column flush left. Even at 1.4% opacity, where the
glyph pixels differ from the ground by about 3/255, it read as noise competing with the content
rather than as texture. The source-view toggle turned out to be the better home for that idea:
the JSON is legible on demand instead of half-visible all the time.

Do not reintroduce a background on the default page — not the JSON texture, not a dot grid, not
grain, not a glow — without an explicit instruction. Prior attempts and the reasons they were
rejected are recorded here so this does not get rediscovered.

**Amended for vibes (3.6h), at Taha's request.** A `--vibe-bg` token exists and an identity may set
it. The distinction that keeps the original rule intact: what failed was _ambient texture on the
page everyone sees_, which read as noise competing with the content at any opacity. A deliberate
ground belonging to one identity, off unless that identity is chosen, is a different thing. **The
shipped site stays flat** — `--vibe-bg` defaults to `none`.

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
