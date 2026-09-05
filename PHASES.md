# Build Phases

Read alongside `CLAUDE.md`, which Claude Code loads automatically from the project root.

## How to run each phase

1. In the project folder, start or resume a session: `claude`
2. Press `Shift+Tab` to enter **Plan Mode** (status bar shows `⏸ plan mode on`).
3. Paste that phase's prompt below.
4. Read the plan. Press `Ctrl+G` to open and hand-edit it if anything's off, or reply in chat
   with changes and ask it to re-plan.
5. Approve the plan. Choose "manually approve edits" for the first couple of phases until you
   trust the output, then switch to auto-accept once you're comfortable.
6. Review the diff / run the app locally, commit, then start the next phase in a **new prompt**
   (referencing this file keeps it anchored to the right scope).

Do not let a session skip Plan Mode for anything beyond a one-line fix — the whole point of this
workflow is that nothing gets written until you've seen and approved the plan.

### A phase is not one build step

**A plan being approved does not authorize building the whole phase.** Every phase below is a
checklist of sections, and they get built **one at a time**:

- Propose the section (structure, content, decisions worth flagging, alternatives worth
  considering) → build **only** that section → stop → wait for Taha's explicit approval → next.
- Never scaffold the next section early, and never bundle two sections into one pass because
  they're "small" or "related."
- Suggestions along the way are wanted — say what you'd do differently and why — but they are
  proposals, not permission.

This mirrors the "Build workflow" section in `CLAUDE.md`, which is the authority if the two ever
disagree.

The site is **mostly an SPA**: core content is stacked sections on a single route, anchor-
navigated, still statically prerendered. "One section at a time" therefore means one _section of
the page_, not one route.

---

## Phase 1 — Foundation (clarity and content only)

**Goal:** the recruiter path fully works. No interactivity yet.

There are **no projects, no Selected Work section, and no case study pages** — the portfolio
itself is the project. Phase 1 is one prerendered page of stacked sections.

Build **in this order, one at a time, each approved before the next**:

1. **Foundation** — project scaffold, base styles/tokens (type scale, palette, spacing), layout
   shell. Minimal; no content yet.
2. **Nav** — TAHA / STACK / CONTACT, anchor-based, plus the resume link (nav or footer, not its
   own section). Keyboard-accessible, works without JS.
3. **Hero** — name, role, one-line pitch, CTA, with About folded in briefly.
4. **Content module** — extract every piece of core content into one typed source of truth and
   re-point the hero at it. Everything after this renders from it, and so does the source view
   in Phase 2 — which is why it comes before the remaining sections rather than after.
5. **Stack** — the tech list.
6. **Contact** — email, GitHub, LinkedIn.
7. **Footer** — resume + "view source" placement, whatever didn't land in the nav.
8. **Source view** — the bottom-right toggle that hides the human view and reveals the same data
   as a readable, collapsible JSON response, rendered from the Phase 1 content module. Zero JS: a
   checkbox plus sibling selectors, and native `<details>` for collapsing.
   A site-wide background (the machine view's text as faint texture) was built here and then
   removed — see CLAUDE.md "Background". Do not rebuild it.
9. **Meta pass** — OG/meta tags and a social preview image.

Throughout: static/SSG rendering, mobile-first, basic accessibility (semantic HTML, focus states).

**Prompt:**

> Plan Phase 1 from PHASES.md: the foundation. Read CLAUDE.md first for full context and
> constraints. The stack is already locked (Astro + TypeScript + Preact islands + Tailwind,
> static, no backend) — don't re-propose it. Propose the file/folder structure, then the
> section-by-section plan listed under Phase 1. There are no
> projects or case study pages — do not add them. This is a single-page app: stacked sections on
> one route, anchor-navigated, statically prerendered. No interactive-layer code yet. Build one
> section at a time and stop for my approval after each — do not build the whole phase in one
> pass.

---

## Phase 2 — Personality (the terminal)

**Goal:** the site starts to feel alive, still minimal by default. The bigger centerpiece
(API Simulation) is deliberately split into its own phase — see Phase 3.

Build, one at a time with approval between each:

1. **Terminal** (⌘K entry, core commands, one hidden command)

The **source view** was pulled forward into Phase 1 (step 8), because the background _is_ the
machine view — the two are one idea and the background cannot be judged without the toggle that
reveals it. Its editable-values tier is Phase 3.5 below.

**Prompt:**

> Plan Phase 2 from PHASES.md: the Terminal and the Source view, per CLAUDE.md's "Interactive
> layer" section. For the Terminal, confirm it's code-split so it adds no weight to the
> homepage's initial load — only fetched when the visitor actually opens it. Note the `work`
> command is gone — commands are `about`, `stack`, `contact`, `clear`, plus the hidden one. For
> the Source view, confirm it is zero-JS (hidden checkbox + `:checked ~`), that it renders from
> the Phase 1 content module rather than duplicating content, and that it stays small — the API
> Simulation is still the headline interaction that carries the engineering depth. Build in
> reviewable steps and stop for my approval
> between them.

---

## Phase 3 — The API Simulation + easter eggs

**Goal:** the discovery layer, built around the API Simulation as the spine.

**Achievements are deferred to Phase 5** — see CLAUDE.md. The list is not designed yet and will
be derived from the finished site. Build the _unlock moments_ (crash, bug icon, each stage
broken); do not build an achievement list, an `/achievements` page, or unlock copy in this
phase.

Build, in this order, one step at a time with approval between each:

1. **API Simulation, stage 1 only** — fetch button, minimal load indicator, crash past a
   threshold, purely client-side/simulated state (no real backend calls needed for this phase).
2. **Hidden bug icon** — crashing reveals the bug icon per CLAUDE.md's spec (low-opacity, tucked
   near the button/input, appears only post-crash).
3. **Attack toolkit** — clicking the bug icon reveals the attack panel.
4. **Stages 2–5** — rate limiting → caching → queue → graceful degradation, each with its
   corresponding attack and the "patched" state applied to older attacks. Treat each stage as
   its own approval step.
5. **Remaining easter eggs** — logo click sequence, hidden terminal command (if not already
   done in Phase 2), hidden API-flavored 404 page.

Instrument the unlock-worthy moments as plain events/flags so achievements can be layered on
later without rework — but no achievement UI now.

**Prompt:**

> Plan Phase 3 from PHASES.md: the API Simulation system exactly as specified in CLAUDE.md's
> "Interactive layer" section — the 5-stage progression, the hidden bug icon appearing only
> after the first crash, and the attack toolkit with attacks becoming visibly "patched" as
> defenses are added. Then plan the remaining easter eggs. Confirm this
> fully replaces the old API Playground / System Status / mini-game concepts — don't build
> those as separate features. Achievements are deferred — build the unlock moments and record
> them as flags, but no achievement list, no /achievements page, no unlock copy. Confirm
> everything here is code-split and loads only on interaction, and that the whole system stays
> purely client-side and simulated (there is no backend anywhere in this project). Build one step
> at a time and stop for my approval after each.

---

## Phase 3.5 — Making the source view interactive

Three independent features, deliberately split so any of them can be built, reordered, or cut
without touching the others. Suggested order is cheapest-and-most-striking first.

|          |                                                            | Needs JS?              |
| -------- | ---------------------------------------------------------- | ---------------------- |
| **3.5a** | Palette editing — presets, custom picker, contrast readout | presets no, picker yes |
| **3.5b** | Tier 1 editable values                                     | yes                    |
| **3.5c** | Visitor comments (`//`)                                    | yes                    |

All three share: **text never HTML**, **ephemeral** (reload restores the real thing), one
**reset** control, and an island that loads **only when the source view is opened**.

---

### 3.5a — Palette editing

**Goal:** a visiting developer recolours the site and it becomes theirs. This is what makes the
source view a headline interaction rather than a flourish.

- **Three seeds only** — background, foreground, accent. Everything else derives from them via
  `color-mix()`. Do this derivation to the tokens in `global.css` first; it is an improvement to
  the design system on its own, and it is what stops any picked colour producing a broken theme.
- **Contrast readout is mandatory.** Live ratio + AA/AAA verdict per seed as the visitor picks.
  Non-negotiable: without it this feature can make the site unreadable, on a site with a hard AA
  floor in its spec. With it, it demonstrates the opposite.
- **Presets are zero JS** — `html:has(#theme-x:checked)` reaches `:root`, so a radio group is
  enough. Only the custom picker needs the island.
- Controls live in the source view header strip, never in the JSON body (see CLAUDE.md).
- Never touches the default palette. Dark stays the base for every first visit.

---

### 3.5b — Editable values (Tier 1)

**Goal:** the source view stops being read-only. A visitor can edit **values** in the JSON and
watch the human view change when they toggle back.

Why it earns its place: the source view _claims_ the two views are the same data. Editing one and
seeing the other change is the proof. That is an architecture demonstration, not a party trick.

Why it is here and not earlier: it is the largest single feature in the plan, and the API
Simulation — the actual centerpiece — must exist first.

**Scope is Tier 1 and stays Tier 1:**

- Values only: strings, numbers, booleans, edited in place.
- **No** structural editing: no new keys, no type changes, no raw-text JSON editing. Editing
  values in place means there is no invalid-JSON state to design for, which is the whole reason
  this tier is affordable.
- Array add/remove is **Tier 2** — a possible follow-on, not part of this phase. Decide only
  after Tier 1 has been used.

### 3.5c — Visitor comments (`//`)

Visitors can annotate the data with `//` comments, JSONC-style, and those annotations surface on
the human view too.

**Comments are an annotation layer, not part of the payload.** JSON has no comment syntax; `//`
is JSONC. Putting comments inside the body would make the response invalid while the header still
claims `content-type: application/json`, which breaks the honesty rule. So the serialised body
stays valid JSON and comments live alongside it — the visitor's notes on the data, the way review
comments sit beside a diff rather than inside the file. Render them JSONC-style (`// text` above
the line they annotate) in a colour that is visibly _not_ part of the data.

- One comment per node, attached by the same path→node map Tier 1 already needs for value
  binding. That shared machinery is why comments are affordable here and would not have been on
  their own.
- **On the human view:** a small unobtrusive marker beside the bound element, revealing the
  comment on hover/focus. This is the part that needs a design pass before it is built — the site
  is deliberately low-noise, and scattered annotation markers are exactly the kind of thing that
  erodes that. Propose the treatment and get it approved before implementing.
- Same non-negotiables as the value editing below: **text, never HTML**; **ephemeral**, cleared on
  reload; covered by the reset control.
- **Never persisted and never shared between visitors.** Comments that other people can see are a
  guestbook, which CLAUDE.md lists as explicitly not-building, and would drag in moderation and a
  backend. Local to one browser session, always.

Non-negotiables:

1. Edits render as **text, never HTML**. A visitor typing `<img onerror=...>` sees characters.
   Cheap now; a real vulnerability to retrofit if anything ever persists or is shared.
2. Edits are **ephemeral** — a reload restores the real content. Do not persist to localStorage:
   a returning visitor finding the site renamed is confusing, not delightful.
3. A visible **reset** control.
4. The **background stays static text**. Only the revealed source view becomes editable, which
   also keeps focusable controls out of the `aria-hidden` layer.
5. The island loads **only when the source view is opened** — never on the recruiter path.

**Prompt:**

> Plan Phase 3.5 from PHASES.md: Tier 1 editable values plus `//` comments in the source view.
> Read CLAUDE.md's "Source view" section first. Values only — no new keys, no type changes, no
> raw-text editing. Comments are an annotation layer, not part of the JSON body, and their
> treatment on the human view needs my approval before you build it.
> Confirm edits render as text not HTML, that they are ephemeral with a reset control, that the
> background stays static, and that the island loads only when the source view is opened. Build
> one step at a time and stop for my approval after each.

---

## Phase 4 — Return Experience

**Goal:** light reason to come back, without pressure mechanics.

**No backend** — this phase is entirely localStorage. No sync, no remote store, no service.

Build (one at a time, approval between each):

1. Anonymous visitor ID, generated client-side, kept in localStorage
2. Interaction/unlock-flag persistence in localStorage, read after first paint
3. Returning-visitor message + one small rotating discovery
4. Public repo link ("view source"), if not already placed in Phase 1

Achievements are still deferred (Phase 5) — this phase persists the underlying flags, not a
list. Getting the flags right here is what makes Phase 5 cheap.

**Prompt:**

> Plan Phase 4 from PHASES.md: visitor state and the returning-visitor experience per CLAUDE.md.
> There is no backend — localStorage only, no sync, no remote store. Confirm it never blocks
> first paint and that there's no streak/daily-reward mechanic. Include adding a "view source"
> link to the repo if it isn't already there. Achievements stay deferred: persist the flags, not
> an achievement list. Build one step at a time and stop for my approval after each.

---

## Phase 5 — Achievements (designed last, from the finished site)

**Goal:** now that the site actually exists, work out what's worth rewarding and build it. This
phase is deliberately last-but-one: the list is derived from the real moments the finished site
offers, not invented up front. Nothing in Phases 1–4 should have shipped achievement UI.

Precondition: Phases 1–4 are done and the unlock-worthy moments are already recorded as plain
flags/events (Phase 3 step-by-step, persisted in Phase 4). If they aren't, wire that first.

Build, one step at a time with approval between each:

1. **Audit + propose the list** — no code. Walk the finished site, inventory every real moment a
   visitor can reach (terminal, each API Simulation stage, bug icon, easter eggs, return visit,
   whatever else exists by then), and propose a flat list ordered easy → hard. **Taha approves
   the list before any of it gets built.** Expect to cut more than you keep; a short list of real
   moments beats a padded one.
2. **Unlock plumbing** — map the approved list onto the existing flags. Add flags for anything
   the audit found that isn't tracked yet. localStorage only, no backend, per CLAUDE.md.
3. **`/achievements` page** — the flat ordered list, locked entries shown as `???`.
4. **Entry icon** — small, muted/low-opacity, more visible on hover, no idle animation, no
   counter or achievement mention anywhere on the homepage.
5. **Unlock feedback** — graceful and one-time (quiet icon state change or a brief notice),
   never looping or flashing.

Locked rules that still apply: flat list, no categories, `???` for locked, no homepage mention.
See CLAUDE.md's Achievements section — it is the authority.

**Prompt:**

> Plan Phase 5 from PHASES.md: achievements. Read CLAUDE.md's Achievements section first — the
> old draft chain (Hello World / Explorer / etc.) is withdrawn, do not resurrect it. Start with
> the audit only: walk the finished site, inventory the real moments a visitor can actually
> reach, and propose a flat list ordered easy → hard for my approval. Do not write any
> achievement code until I've approved the list. Then build the plumbing, the /achievements page,
> the entry icon, and unlock feedback as separate approval steps. Keep it code-split and
> localStorage-only — there is no backend.

---

## Phase 6 — Polish + README

**Goal:** only after everything above works end to end.

### Required

- **`README.md`** — the final deliverable, and the last thing built. See CLAUDE.md's "What the
  README must cover" for the full contents. Written last on purpose: it documents what actually
  shipped, including real measured numbers from the audit below, not what was planned. Since
  "view source" is a load-bearing link on the site, the repo landing page is a second front door
  for recruiters — treat it as portfolio surface, not boilerplate.

### Consider (not committed — propose and confirm before building)

- Page transitions (undecided — evaluate whether they're worth the cost first)
- Interaction micro-feedback refinement
- Full accessibility pass
- Performance pass: Lighthouse/Core Web Vitals check, bundle size audit for the interactive
  layer, confirm code-splitting is actually working as intended

Run the performance pass **before** writing the README — its numbers go straight into the README.

**Prompt:**

> Plan Phase 6 from PHASES.md: polish pass and the README. Start with a performance and
> accessibility audit of everything built in Phases 1–5 — Lighthouse scores, bundle size for the
> interactive layer, and confirmation that code-splitting is working. Then propose whether page
> transitions are worth adding given CLAUDE.md's performance constraint, and let me decide before
> building them. Finish by writing README.md per CLAUDE.md's "What the README must cover",
> using the real numbers from the audit — no resume-speak, no claims the repo doesn't back up.
> Show me the README for approval before committing it.

---

## Parked / not scheduled

- Guestbook or an alternative unique interaction (still deciding what — do not build until a
  phase is written for it)
- World State system
- Sound effects
- Theme toggle

Do not pull these into any phase above without an explicit instruction.
