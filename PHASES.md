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

1. **Terminal panel** — bottom-anchored, drag-resizable, 50dvh default, height persisted to
   localStorage, keyboard-operable separator, non-modal with `Esc` to close.
2. **Commands** — `about`, `stack`, `contact`, `cls`, `help`, plus hidden `sudo hire taha`.
   Content commands render from the content module; nothing is retyped.
3. **Entry points** — ⌘K/Ctrl+K, plus a button that is visible on touch and screen-reader-only
   on desktop.
4. **JSON signpost** — add the `interfaces` block to the content module so the source view
   advertises the terminal, its shortcut and its commands. Do this last: it must not advertise
   something that does not yet work.
5. **`perf` and `curl`** — built, then **removed at Taha's request** along with the
   `/api/whoami.json` easter egg. Do not rebuild them without an explicit instruction. The
   terminal's listed commands are now `about`, `stack`, `contact`, `help`, `cls`, plus the hidden
   one.

**This is where "zero JS" ends.** ⌘K needs a listener, so the recruiter path goes from literally
0 bytes to a small always-present loader plus an on-demand chunk. Measure both and say so
honestly — see CLAUDE.md's note under Tech stack.

The **source view** was pulled forward into Phase 1 (step 8), because the background _is_ the
machine view — the two are one idea and the background cannot be judged without the toggle that
reveals it. Its editable-values tier is Phase 3.5 below.

**Prompt:**

> Plan Phase 2 from PHASES.md: the Terminal and the Source view, per CLAUDE.md's "Interactive
> layer" section. For the Terminal, confirm it's code-split so it adds no weight to the
> homepage's initial load — only fetched when the visitor actually opens it. Note the `work`
> command is gone — commands are `about`, `stack`, `contact`, `cls`, plus the hidden one. For
> the Source view, confirm it is zero-JS (hidden checkbox + `:checked ~`), that it renders from
> the Phase 1 content module rather than duplicating content, and that it stays small — the API
> Simulation is still the headline interaction that carries the engineering depth. Build in
> reviewable steps and stop for my approval
> between them.

---

## Phase 3 — The API Simulation (REMOVED) + easter eggs

**The API Simulation was built in full and then removed.** Everything below is kept as a record
of what existed and why it did not work — see Phase 3.6 for what replaced it, and CLAUDE.md for
the diagnosis. The easter eggs from step 6 (the hidden terminal command and the 404) survive.

**Goal at the time:** the discovery layer, built around the API Simulation as the spine.

**Achievements are deferred to Phase 5** — see CLAUDE.md. The list is not designed yet and will
be derived from the finished site. Build the _unlock moments_ (crash, bug icon, each stage
broken); do not build an achievement list, an `/achievements` page, or unlock copy in this
phase.

Build, in this order, one step at a time with approval between each:

1. **API Simulation, stage 1 only** — DONE. Lives between Stack and Contact as `#api`, with no
   nav item (discovered, not advertised). Static markup ships; the island loads on first click.
   The engine (`src/islands/api/engine.ts`) is a real concurrency model, not a counter: requests
   occupy the server for a service time, that time degrades as concurrency rises, and the
   feedback loop is what kills it. Crash expiry is derived from the clock, never from a flag a
   render loop has to clear.
2. **The fix loop + stage 2** — persistence, the inline fix button, the middleware chain, reset,
   and a real fixed-window rate limiter. Built before the bug icon because it closes one full
   turn of the loop (crash → fix → spam stops working), which is the thing worth reviewing.
3. **Hidden bug icon** — crashing reveals the bug icon per CLAUDE.md's spec (low-opacity, tucked
   near the button/input, appears only post-crash). It is what makes stage 2 onwards breakable
   on purpose rather than by luck. It opens the **defect report**: one entry per stage, the
   current one `open` with its exploit spelled out, earlier ones struck through and labelled with
   the defence that patched them, so the panel doubles as a changelog. Only stages the visitor
   has actually reached are listed — the panel never spoils a weakness in a defence they have not
   built yet.
   - **The earned nudge.** From stage 2 the icon is the only route forward, so someone who misses
     it hits a dead end. Rather than making it permanently more obvious, it gets easier to see
     for a visitor who is visibly attacking and getting nowhere: two opacity steps, at 10 and 24
     requests turned away since the last fix, cleared by a successful breach. A one-time step
     change with a 200ms transition — never a loop. Nothing on this site pulses for attention.
4. **Attack toolkit** — the open defect in the report gains a control that actually runs the
   attack, since the stage-2 exploit (a boundary burst timed to a ~100ms window two seconds after
   a probe request) is not something a human can perform by hand.
   - **Attacks are volleys, not individual timers.** A volley is a group of requests fired on one
     timestamp, so what reaches the limiter is "these went out together" and the attack depends
     only on which side of the window boundary each volley lands — never on `setTimeout` being
     accurate to 10ms.
   - **The opening silence is load-bearing.** The limiter's window opens on the first request
     after the previous one lapsed, so an exploit that just fires offsets from "now" lands at an
     unknown phase and gets 429s. A full window of quiet before the probe is what makes the
     boundary land at a known time regardless of when the visitor last clicked.
   - **The fetch button is locked during a run**, or a stray manual click in the quiet gap resets
     the window and breaks the attack.
   - **A run that does not land must say so.** Browsers throttle timers in background tabs, so a
     visitor who switches away mid-run returns to collapsed volleys that were simply rate
     limited. Reverting the read-out silently makes the exploit look inert and puts them back at
     the dead end the toolkit exists to remove.
5. **Stages 3–5** — rate limiting → caching → queue → graceful degradation, each with its
   corresponding attack and the "patched" state applied to older attacks. Treat each stage as
   its own approval step.
   - **Stage 3, the cache — built.** A bounded response cache keyed by path, sitting behind the
     limiter so the request order matches the order the chain displays. A hit is answered from
     memory and never occupies the origin, which is precisely why it defeats a burst that asks
     for the same thing repeatedly. Notes worth keeping:
     - **A cache needs a key, so the engine needed one too.** `send()` takes a path; a plain
       click asks for `/taha`. Without that there is nothing for a cache to be a cache _of_.
     - **The TTL must outlast the burst it defends against.** The boundary attack runs ~4s, so an
       entry expiring inside that window would let the same-path burst through and the fix would
       be theatre — the same class of bug as a rate limit set above capacity. Asserted in tests.
     - **Attacks stack, they do not replace.** The limiter is still out front, so the cache-miss
       flood keeps the boundary timing that beats it and _adds_ a different path per request.
       Six requests, same schedule as stage 2, none of them answerable from memory.
     - **No request coalescing:** a second request for a path whose miss is still in flight is
       also a miss. That is how a plain cache behaves, and the limiter caps the pile-up.
     - **Each defence earns its own number** in the totals the moment it is applied (`turned
away` for the limiter, `reused` for the cache), so what the visitor built becomes visible
       rather than implied.
   - **Stage 4, the queue — built.** Requests that arrive with every worker busy join a line
     instead of piling onto the server, so over-concurrency stops being a failure mode at all.
     The failure _moves_ rather than disappearing: overload becomes "too many waiting".
     - **The limiter had to become per-caller first, and this is why.** The arithmetic does not
       work otherwise: a limit of 3 per 2s allows 1.5/s sustained (6 across a boundary) while the
       server drains ~2.9/s, so arrival can never outrun the drain and no amount of timing fills
       a queue. Counting per caller — the way a real limiter keyed by IP or API key does — opens
       the honest route: the **multi-identity flood** already listed in CLAUDE.md's attack menu.
     - **The best teaching moment in the progression.** Eight callers x three requests is exactly
       the per-client allowance, so the attack triggers **zero 429s** — every client is perfectly
       compliant and the system dies anyway. A per-client limit says nothing about the total,
       which is the whole argument for global backpressure. Asserted in the test suite.
     - **Overflow is fatal because there is no policy for "full" yet.** That missing policy is
       precisely what the breaker adds, which is why backpressure is the fix this defect earns
       rather than simply a deeper queue. Requests still waiting when it goes down fail with it.
     - **The queue trades failures for latency, so the latency is shown.** Records carry
       `waitedMs`, and a row that waited says so — otherwise the cost of the fix is invisible and
       the queue reads as a free win.
   - **Stage 5, the breaker — built. The API Simulation is complete.** Load shedding with
     hysteresis: the breaker opens when the line gets deep and closes once it has drained well
     back down. Two marks, not one, or it would flip state on every other request while the depth
     sat on the boundary.
     - **`tripAt` must sit below `queue.maxDepth`**, or the breaker opens only after the overflow
       it exists to prevent has already happened. Same off-by-a-threshold family as a rate limit
       above capacity or a cache TTL shorter than the burst. Asserted as a relationship, not a
       number.
     - **Where the shed check sits is the whole meaning of the stage.** It runs _after_ the
       cache, so anything already known still gets answered while new work is refused. Degrading
       gracefully means serving what you can and declining the rest — not going dark.
     - **The capstone is checkable, not asserted.** Once every defence is applied all four
       exploits become runnable again, so the visitor can throw the attack that killed stage 4 at
       the finished stack and watch it report `held — the stack absorbed it`. "You built a
       production-grade API" lands very differently when you can test it yourself.
     - Verified: 200 requests from 40 callers produce **zero 503s**, the line peaks at 8 of 12,
       and it returns to healthy on its own.
6. **Easter eggs — done.** Two ship: the hidden terminal command (`sudo hire taha`, built in
   Phase 2) and the **backend-humour 404 page** (`src/pages/404.astro` → `dist/404.html`, which
   Cloudflare Pages serves for any unresolved path — no server involved, which is what the copy
   says). The logo click sequence was **cut**, and `/api/whoami.json` was built and then
   **removed**; neither returns without an explicit instruction.

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

## Phase 3.5 — Making the source view interactive — DONE

Three independent features, deliberately split so any of them could be built, reordered, or cut
without touching the others. That split earned itself: **3.5a and 3.5b shipped, 3.5c was cut**,
and neither decision disturbed the other two.

|          |                                                                  | Needs JS? |
| -------- | ---------------------------------------------------------------- | --------- |
| **3.5a** | Palette editing — presets + contrast readout (**done, zero JS**) | no        |
| **3.5b** | Tier 1 editable values, plus array add/remove (**done**)         | yes       |
| **3.5c** | ~~Visitor comments (`//`)~~ — **cut, never built**               | —         |

What shipped shares: **text never HTML**, **ephemeral** (reload restores the real thing), one
**reset** control, and an island that loads **only when the source view is opened**.

---

### Terminal commands that ride on these

`get` / `set` / `theme` / `reset` land with 3.5a and 3.5b — the terminal and the JSON viewer
driving one shared state is the whole point, and it is what stops the terminal being a read-only
view. Build them alongside the feature they expose, not as a separate pass.

---

### 3.5a — Palette editing

**Goal:** a visiting developer recolours the site and it becomes theirs. This is what makes the
source view a headline interaction rather than a flourish.

- **Three seeds only** — background, foreground, accent. Everything else derives from them via
  `color-mix()`. **Done** — the tokens in `global.css` are now nine `color-mix(in oklab, …)`
  derivations of three seeds, verified to cascade when a seed is overridden. Notes:
  - **oklab, not sRGB.** sRGB interpolation between two saturated colours passes through muddy
    intermediates, which is exactly what a derived palette must not do for an arbitrary accent.
  - **Percentages were fitted to the previous hand-picked palette, not guessed.** Every neutral
    landed within 1–6 RGB units of the hex it replaced, with contrast unchanged to two decimals.
  - **The derivation must stay runtime `var()`/`color-mix()`.** Tailwind emits a static hex
    fallback plus the live version inside `@supports (color: color-mix(…))`; modern browsers take
    the live one, which is what makes a seed override move everything with it.
  - **A latent bug surfaced: `accent-dim` was doing two jobs.** It coloured decorative borders and
    gauge fills _and_ three pieces of small text (log status codes, log tags, JSON
    numbers/booleans). Those have different contrast floors, and measuring across six accents
    showed a red or blue seed puts a bg-ward mix at ~4.4:1 — fine for a border, failing AA as
    text. Split into `--color-accent-dim` (decorative, mixed toward bg) and
    `--color-accent-soft` (text, mixed toward `--color-fg-muted`). Mixing toward fg-muted is
    self-correcting: both endpoints clear AA, so the result does too — a deliberately weak accent
    at 3.98:1 derives to 4.96:1, better than the seed. **Never colour text with `accent-dim`.**
- **Contrast readout is mandatory.** Live ratio + AA/AAA verdict per seed as the visitor picks.
  Non-negotiable: without it this feature can make the site unreadable, on a site with a hard AA
  floor in its spec. With it, it demonstrates the opposite. **Done** — build-time for presets,
  live for the custom picker, sharing one formatter in `src/data/contrast.ts`. It reports failure
  honestly rather than preventing it: a bad accent reads `accent 2.5:1 below AA`.
- **The custom picker was built and then removed at Taha's request** — "it feels weird". Do not
  rebuild it without an explicit instruction. It worked (a plain 882-byte module, not a Preact
  island, loaded on first contact) and the notes are kept only because they generalise: a value
  picked while its chunk is still downloading must survive the mount, and choosing a preset while
  a custom palette is active should honour that preset rather than snapping back to default.
  **With it gone, 3.5a is entirely zero-JS** and the source view ships no script at all.
- **The JSON font-size control was also removed at Taha's request.** 11px is the size the view is
  designed at, and the control was never a site-wide type control anyway. `.tree` is now a fixed
  11px. Do not reintroduce a size picker.
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

**Built.** Notes worth keeping:

- **The editable set is derived from the DOM, not from a second list.** The island collects every
  `[data-bind]` on the page and only makes a JSON leaf editable if its path is among them, so the
  editable values are exactly the rendered values by construction. 44 of 59 string leaves qualify;
  `meta.*`, `interfaces.*` and the hrefs stay read-only because nothing on the page renders them.
- **Hrefs are deliberately not bound.** Tier 1 edits text; letting a visitor rewrite a `href`
  invites `javascript:` into an otherwise text-only feature for no demonstration value.
- **Text-never-HTML is structural, not promised.** Every read and write is `textContent`, and
  paste inserts through `createTextNode` via the Range API — `execCommand` is deprecated, and the
  replacement happens to make the rule impossible to violate. Verified: an `onerror` payload
  renders as characters, creates zero element nodes and does not execute.
- **One value can have several homes.** `name` renders in the hero and the footer; editing it
  once updates both, which makes the "one dataset" claim land harder than a single binding would.
- Enter commits rather than splitting the value in two, Escape reverts it, and the reset row stays
  hidden until there is something to reset.
- **The Astro whitespace trap bit again, in a new place.** Wrapping an inline value in a
  multi-line `<span>` renders the newlines as spaces — `authorization , billing , and
integrations .` — and Prettier reformats a hand-fixed single line straight back. The durable fix
  is `set:text` on a self-closing element: no template children, so no formatter can reintroduce
  whitespace. Use it for every inline bound value.

**Scope is Tier 1 and stays Tier 1:**

- Values only: strings, numbers, booleans, edited in place.
- **No** structural editing: no new keys, no type changes, no raw-text JSON editing. Editing
  values in place means there is no invalid-JSON state to design for, which is the whole reason
  this tier is affordable.
- **Array add/remove — Tier 2, pulled in and built at Taha's request** right after Tier 1 landed,
  which is the decision this line was waiting on.
  - **Arrays of objects too**, added straight after. A new entry keeps the **shape** of the
    existing ones — same keys, in the same order — and only the values are blank and editable.
    Keys are never editable and cannot be added or removed, which is the "no new keys, no type
    changes" rule still holding. Unrendered arrays (`interfaces.*`) still get no controls; the
    guard is the same DOM-derived one Tier 1 uses.
  - **An entry is one element on each side.** A string entry is its `<li>`/`<span>`; an object
    entry spans a `<dt>` and a `<dd>`, so those are wrapped in a `display: contents` div carrying
    `data-bind-item`. That single handle per entry is what keeps add, remove and renumber generic
    instead of growing a branch per shape.
  - **`renumber` is recursive.** Renaming `contact.2` has to carry `contact.2.label` and
    `contact.2.value` with it, however deep they sit.
  - **A cloned object brings its nested arrays along.** They are registered for their own
    controls and trimmed to one blank entry, rather than inheriting however many the entry they
    were copied from happened to have.
  - **The page metadata is editable too**, added at Taha's request. `meta.title` binds by _text_
    — setting `<title>`'s textContent is what changes the browser tab, which makes it the most
    visible edit on the page that is not on the page — and `meta.description` binds to the
    `content` attribute of the description and Open Graph tags. Bound only when the page really
    is showing the site's own metadata: the 404 passes its own title and must not be rewritten.
    51 of 59 string leaves are now editable; the rest are `interfaces.*`, which nothing renders.
  - **URLs are editable**, added at Taha's request after the first pass left them read-only.
    A path can be bound as a link's destination (`data-bind-href`) instead of as text; contact
    links, the résumé and the repo link all are. Only `http:`, `https:` and `mailto:` are
    accepted — anything else drops the `href` entirely rather than keeping the old one. Edits are
    local and ephemeral so a `javascript:` URL could only target the visitor's own browser, but
    turning typed text into an executable URL is the wrong habit and refusing costs one function.
  - **A cloned row can arrive already `contenteditable`.** A nested list's template is captured
    after its parent's cells were wired, so `makeEditable`'s `isContentEditable` guard skipped it
    and attached **no listeners** — the cell looked editable, accepted typing, and nothing reached
    the page. Guard on a `WeakSet` of wired cells instead, and strip editing state from clones
    before wiring. This is the bug that made a new stack group show one item instead of three.
  - **Reset restores the original elements, not blanks-plus-text.** An entry carries more than
    its bound values — `href`, `target`/`rel`, the screen-reader-only "opens in a new tab" note —
    and none of that is editable, so none of it could be typed back. Pristine clones are captured
    before any control is attached.
  - **One `relabel` pass after every change**, rather than add and remove each keeping their own
    index books. It renumbers both sides and repairs the punctuation that depends on position:
    the trailing comma in the JSON, and the `, ` / `, and ` that turn a list back into a sentence.
  - **The joined list is the hard case.** `pitch.highlights` renders inside a sentence, so its
    separators are text nodes between spans. The container carries `data-bind-join="comma-and"`
    — an attribute on an element that already exists, so no template whitespace can creep in —
    and only text nodes strictly _between_ the first and last item are rebuilt, leaving the
    lead-in and the full stop alone.
  - **New rows are cloned from rendered ones, never parsed**, which keeps text-never-HTML true
    for structural edits too.
  - Reset restores original array _lengths_ as well as values.
  - **Astro scopes component CSS by a `data-astro-cid` attribute that runtime-created elements
    never get.** The add/remove buttons silently collapsed to 7x19 — well under the 24x24 target
    floor — until their rule was marked `:global`. Worth remembering for anything an island
    injects.
  - **`querySelector` searches descendants, and nested arrays made that bite twice.** Looking up
    "this list's add row" found one belonging to a _nested_ list and threw on `insertBefore`.
    Anything addressing a list's own parts needs `:scope >`.
  - **A branch carries `data-path` too**, so "clear the value" matched the `<details>` of an
    object entry and wiped its whole subtree. Leaf cells are `[data-path]:not([data-kind])`.
  - **The joined sentence has two edge cases worth keeping.** Removing the _last_ entry must drop
    the separator _before_ it, not the text after it — that text is the full stop. And with a
    single entry `first === last`, so the "clear between" walk runs to the end of the paragraph
    and eats everything unless it is skipped. Both produced sentences like `authorization, and
billing, and .` before they were fixed.

### 3.5c — Visitor comments (`//`) — CUT

**Cut at Taha's request before any of it was built. Do not build it without an explicit
instruction.** The idea was an annotation layer rendered JSONC-style beside the data and surfaced
on the human view.

The reasoning it was cut on is worth keeping, because it is the same reasoning that trimmed the
rest of this phase: the open question was never the JSON half but how a comment should show up on
the **human** view, and every answer to that adds a permanently visible marker to a page whose
whole design is low-noise. It would have been the only part of the discovery layer that leaves a
mark on the recruiter path.

If it is ever revived, the constraints it was designed under still hold: comments are an
**annotation layer, never part of the payload** — JSON has no comment syntax, so putting them in
the body would invalidate a response still labelled `application/json` — and they are **never
persisted and never shared between visitors**, since shared comments are a guestbook, which
CLAUDE.md lists as explicitly not-building and which would drag in moderation and a backend.

Non-negotiables:

1. Edits render as **text, never HTML**. A visitor typing `<img onerror=...>` sees characters.
   Cheap now; a real vulnerability to retrofit if anything ever persists or is shared.
2. Edits are **ephemeral** — a reload restores the real content. Do not persist to localStorage:
   a returning visitor finding the site renamed is confusing, not delightful.
3. A visible **reset** control.
4. Only the **revealed** source view is interactive. Written when a faint JSON background still
   existed — that background is gone (CLAUDE.md, "Background"), so what remains of this rule is
   the part that still matters: the hidden branch is `display: none`, which keeps its focusable
   controls out of the tab order and the accessibility tree. Do not swap that for
   `visibility`/opacity.
5. The island loads **only when the source view is opened** — never on the recruiter path.

**Prompt:**

> Phase 3.5 is complete: palette presets (3.5a) and editing (3.5b) are built, and visitor
> comments (3.5c) were cut. The custom colour picker and the JSON font-size control were built and
> then removed. Nothing here is outstanding — the next thing is the API Simulation checkpoint
> below.

---

## Phase 3.6 — The three pillars

**Resolves the checkpoint that used to sit here.** The question was whether to cut the API
Simulation back; the answer, reached with Taha, was to **remove it** and to settle what the site's
interactive layer actually consists of. Three pillars, deliberately three different _kinds_ of
thing:

| Pillar                 | What it demonstrates              | Residue it leaves  |
| ---------------------- | --------------------------------- | ------------------ |
| **Permission Sandbox** | engineering depth, his speciality | a config you built |
| **Terminal**           | a tool, and a place with secrets  | history and access |
| **Customization**      | the portfolio becomes yours       | your vibe          |

Those three residues are what the Phase 5 achievement list is derived from. (Phase 4 was going
to remember them for a returning visitor; it was removed — the list is the return mechanic.) Do not
design achievements here.

**Build order is fixed, and each pillar is planned separately before any of it is written.** They
are independent — do not start two at once, and do not scaffold ahead.

### 3.6a — The Permission Sandbox

Replaces the API Simulation, which is deleted rather than left unreachable. See CLAUDE.md for the
full spec and for why the old shape failed. One screen, no stages, no win state; a real DOM-free
policy engine underneath, testable in Node.

**Step 1 — removal: done.** 1,976 lines deleted across seven files (engine, island, defect report,
static markup, five blocks of CSS). Always-present JS fell from 1,278 to 805 bytes gzipped.

**Step 2 — engine + read-only sandbox: done.** `src/islands/access/policy.ts` is the whole model in
one pure function: explicit denials win outright, grants may carry a per-resource condition, and
anything unmatched is denied. 16 assertions in Node; all 36 role x question combinations resolve.
Notes worth keeping:

- **The cast is asymmetric on purpose.** `billing` can pay an invoice and `admin` cannot. Most
  people read roles as a ladder, and one click between those two breaks that assumption without a
  word of explanation. It is the section's hook and it cost nothing.
- **Two projects, not one.** Apollo is yours, Zephyr is Dana's. An ownership condition described
  in prose is forgettable; the same role giving two different answers to the same question one row
  apart is not.
- **The static HTML carries real answers**, computed at build time by the same engine the island
  uses. A visitor who never clicks still reads something true — including the hook, since
  `pay it · denied · nothing gives admin this` is in the shipped markup with no JS at all.
- **Preact here, unlike the palette control.** There is genuine state — selected role, open trace,
  and next a mutable policy with analysis derived from it. The deviation last time was justified
  by there being none.
- **Two columns, matching Stack and Contact.** A stacked layout spent four rows on group headers
  and read as a widget; borrowing the site's existing label-left rhythm reclaimed them and made it
  read as part of the page. Section went 761px -> 642px.
- **Step 4 — scenarios: done. The section became a puzzle.** The summary table and the three
  policy toggles are gone; in their place a brief, a list of requirements, a permission editor and
  a **check** button. The visitor produces something and finds out whether it is right.
  - **Three shapes of task, not three difficulties**, and unordered — a numbered list to work
    through is a curriculum, which is what sank the section this replaced. _the contractor_ builds
    a role from nothing, _running the team_ satisfies a constraint, _after the leak_ starts
    over-permissioned so the operation is subtraction.
  - **Least privilege is the real bar.** Pass/fail is not interesting; two people can both satisfy
    a brief while one grants three permissions nobody asked for. `needed` is derived from the
    requirements themselves rather than stored as an answer key, so it cannot drift: _"solved, but
    1 more than needed: view deploy keys"_.
  - **Only a `build` is graded on minimality.** A `fix` scenario starts holding permissions the
    brief never mentions, where "extra" is noise rather than a finding — it just says `solved`.
  - **Checked on demand, at Taha's request, and any edit throws the verdict away.** Checking is a
    commitment; a tick left over from a policy that no longer exists is worse than no tick. The
    requirements sit at `·` until asked, then resolve to ✓/✗ with the reason.
  - **The escalation detector became a fail condition** rather than a warning. "Running the team"
    reads like it includes changing roles; granting that trips the detector and fails the brief.
    Far better use of it than a notice.
  - **Denials survive the visitor's edits.** `policyFor` replaces only the edited role's _allows_
    — denials belong to the organisation, and a visitor who could untick one would be able to
    grant their way around a block, which the model says is impossible. Asserted.
  - **The probe was removed entirely**, after being kept and then folded away. Taha could not tell
    what "ask a question" was for, which is the only verdict that matters for a control nobody
    asked for. Everything it explained, the requirement rows already explain in plain words.
  - **Step 5 — three levels, nine briefs: done.** Difficulty is a demand stacked on the grading,
    and each level has its own three scenarios: nine distinct runs out of one model.
    - **stated** — meet the brief; extras are reported but tolerated.
      **minimal** — and grant nothing beyond it.
      **judgement** — and the must-not list is hidden; you are told what the person needs to do
      and have to work out the limits yourself.
    - **Nothing is locked.** A level is chosen, never earned. The moment it gates, this is a
      curriculum again — the thing that sank the section it replaced.
    - **The fairness rule for judgement:** an unstated limit may only be one that follows from
      least privilege. Never a business opinion. "Common sense" is not common, and marking a
      defensible answer wrong turns a test of judgement into guess-what-the-author-thought.
    - **Minimality had to be defined for subtraction too**, or "after the leak" could not sit at
      the minimal level: `needed` for a fix is what the role started with, minus what must go.
      That also made the scenario sharper.
    - **Judgement needs content minimality cannot express**, or it would just be the level below
      wearing a hat — extras already fail there. Conditions are that content: `only their own` is
      a modifier, not an action, so it is invisible to the extras count. Someone can be perfectly
      minimal and still hand a contractor edit rights over everyone else's work.
    - The nine are distinct in kind, not difficulty: domain / narrow / read-only, then
      grant-precision / near-miss / revoke-precision, then condition / escalation / read-vs-write.
    - **It earned a nav item: TAHA / STACK / ACCESS / CONTACT.** The section it replaced
      deliberately had none, being mysterious by design; this one is legible in five seconds, and
      naming it in the nav states the specialism it is evidence for. "Access" over "Sandbox"
      because it matches the section heading and says what the subject is, not merely that there is
      something to play with.
    - **A fourth link broke the mobile nav, and exposed that it was already broken.** The row
      needed 406px against the 312px a 360px screen leaves after the gutter — and 322px without
      the new link, so it was already overflowing by 10px before this change. Fixed by letting the
      row wrap, tightening the gaps below `sm`, and shortening the widest item: the résumé button
      reads **CV** on small screens, which is what the file is called anyway. One row from 360px
      up, two below that, no horizontal overflow at any width, 36px tap targets throughout.
    - **`scroll-padding-top` went 5rem -> 6.5rem** to clear the two-row nav at 320px.
    - **Container-width simulation cannot test responsive classes.** Shrinking a wrapper and
      measuring told me the fix had not worked, because `sm:hidden` keys off the viewport, not the
      parent. An iframe at the target width has its own viewport and gives the real answer — use
      that for anything behind a breakpoint.
    - **The section itself then needed the same pass**, at Taha's report that it "doesn't look
      well optimized for phone". Two defects at 375px, neither of them overflow:
      - **A ragged left edge.** The label column is intrinsic, so `level` (34px), `people` (41px),
        `projects` (54px) and `deploy keys` (75px) each started their chips at a different x —
        four columns where the design has one. Fixed by making `.ax-ask-line` a **two-column grid**
        (`5.5rem minmax(0, 1fr)`) from 34rem up. A wrapping flex row was the obvious fix and the
        wrong one: it seats short groups beside their label and long ones underneath, which
        produces _two_ left edges instead of one.
      - **Below 34rem the label goes above the chips** rather than beside them. A 5.5rem gutter out
        of 345px is a sixth of the screen spent on four words, and the chips are the content.
      - A phone density block (`@media (width < 34rem)`) trims chips to a 28px min-height, 10px
        text and 0.5rem padding, and tightens the section's gaps. 28px keeps AA 2.5.8 (24px) with
        margin; the 36px used elsewhere would have cost another row per group.
      - Measured after, at four widths: one distinct chip left-edge at every one, no horizontal
        overflow, min chip 28px on phones and 30px above. Section height 944px -> 901px on a
        phone, 736px on desktop. The remainder is the editor (326px) and the requirement lists
        (136px), which is content — trimming it further means restructuring the editor, which is
        not worth risking the desktop layout for.
      - **Then the two requirement lists were paired on phones too**, at Taha's ask — they had been
        stacked below 34rem. Reading _must be able to_ beside _must not_ **is** the comparison the
        section is built on, so losing it on the device most people arrive on was the wrong trade.
        Forcing it naively is genuinely ugly, though, and the measurement says exactly where the
        line is:
        - At 342px content the columns are 131px and **three of the four labels wrap to two
          lines**, failure notes to three, for a saving of only 26-40px out of ~990. That is the
          "weird and not cohesive" outcome, and dropping to 10px type does not rescue it — it
          buys 14px per label against a 40px shortfall.
        - What actually pays is **width, not type size**. Two fixes together move the clean
          threshold from 420px to 364px: a narrower mark gutter (`1ch` + `0.35rem` on phones,
          worth ~10px a column) and shortening the single widest label.
        - **`edit a project of Dana` -> `edit Dana's project`** — 146px to 126px, and better
          English besides. It was the widest string in the whole set and the only one forcing the
          issue; the possessive says the same thing in three fewer words.
        - Breakpoint therefore **34rem -> 23rem** (368px), which is measured rather than picked:
          one line down to 364px, two-line wrapping at 360px. Phones at 375px and up get the
          pairing; a 320-360px screen keeps the stack, which is the right answer at that width.
        - Verified at nine widths against the shipped CSS with the worst-case brief loaded
          (judgement / _whose project is it_, verdicts shown): no wrapped label and no overflow
          at any of them. Requirement block 172px -> 98px, and the section 937px -> 863px at
          375px. Desktop is untouched at 755px.
  - **Hidden limits render as one `???` each, not as a sentence.** The count is a fair hint —
    it says how many boundaries there are to find without saying what they are — and a column
    of placeholders reads as "three things to work out" rather than as missing content. They
    reveal on check **with the visitor's verdicts against them**, which keeps a wrong guess
    instructive rather than merely scolding, and return to `???` on the next edit along with
    the verdict. Same `???` the achievements use for the same idea, so the site has one way of
    saying "not yet known".

  - **`Draft` became `{ actions, scoped }`** rather than a bare list, because a condition is not a
    permission and modelling it as another checkbox would have made it look like one.
  - **The pre-hydration bug class, now handled everywhere it applies.** Anything clicked before
    the chunk arrives is very often the click that loaded it. Two places need it here: a ticked
    permission is carried across the mount, and a press of **check** runs the check on arrival
    rather than silently hydrating and appearing to do nothing. Fifth occurrence in this project
    — assume it for every island, do not rediscover it.
- **Step 3 — policy toggles + escalation: done.** Three switches the visitor can flip, each
  chosen because it teaches something the default policy cannot, and an analysis that reads the
  policy in force rather than the switches.
  - **`admins change roles` is the star.** It creates a real privilege-escalation path, and the
    finding states what is actually gained: transfer, pay, refund, remove someone — _including
    `transfer`, the one thing an explicit deny blocks admins from doing._ The deny holds, and the
    escalation walks around it by becoming the owner instead. That is exactly how this class of
    finding defeats a carve-out in practice.
  - **The analysis is derived, not matched.** `POLICY_CHANGING` names the actions that let a
    holder rewrite the policy; a role that can reach one of them can assign itself any role, so
    its true reach is the union of every role's permissions. Proven by three tests: granting
    _member_ the same power surfaces a second finding with nothing in the code mentioning member,
    denying the vector removes the finding entirely, and the gains list shrinks when another
    toggle removes an action from everyone.
  - **`members delete anything`** shows an unconditional grant overriding an ownership condition.
    **`nobody deletes projects`** applies a blanket deny that stops even the owner — the wildcard
    does not save them, which is the clearest possible statement of deny-overrides-allow.
  - **A toggle flipped before the chunk arrives survives the mount**, read from the checkbox at
    mount time. Third occurrence of that bug class after the API section's clicks and the
    palette's colour; it is worth assuming rather than discovering next time.
  - **Nothing persists, decided late.** The policy did save for a while, on the grounds that it
    was the residue Phase 4 would remember. Taha cut it: a draft is an attempt at a puzzle, not a
    preference, and a half-finished answer restored on the next visit is worse than a blank page.
    Phase 5 will need a different residue from this pillar — most likely which briefs were
    solved, which is a different thing from the draft and belongs to that phase.
  - Findings state themselves calmly — one accent, no red the palette does not have. Verified
    7.77:1 worst case across the presets. Section rests at 710px, 810px with every toggle on and
    a finding showing.
- **Step 2b — the composer: done.** A second layer of agency on top of the summary: `can you
[action] [resource]` with a verdict, a plain reason, and the same expandable trace.
  - **The condition it had to meet.** A composer that only re-asks the questions already on
    screen is a second way to read the same data — the exact criticism the terminal earned. So
    the model was widened past the summary: a Deploy key resource, and `transfer`, `refund`,
    `remove`. **18 askable combinations against 7 listed**, asserted in the suite.
  - **It reuses the selected role rather than adding its own.** Two places to pick a role is two
    sources of truth; reusing it also shortens the sentence to "can you…", reinforcing the
    framing above instead of competing with it.
  - **Actions are filtered by resource kind**, and changing the resource snaps the action to one
    that applies. Nothing can pay a project. Asserted, and it teaches that actions belong to
    resource types rather than to a global list.
  - **`admin` now has `project:*` _and_ an explicit deny on `transfer`.** That makes
    deny-overrides-allow a live fact in the default policy instead of something only a test could
    reach — and it is invisible in the summary, so the composer is the only way to find it. It is
    also what the composer opens on, so the shipped static HTML poses a question worth clicking.
  - **Chips, not `<select>`.** Native selects were tried and replaced: a dropdown's popup is drawn
    by the OS and ignores the palette entirely, which is glaring once a visitor recolours the
    site. A custom listbox was rejected too — it means reimplementing keyboard navigation, focus
    management and ARIA, which is exactly where bespoke dropdowns quietly break. The option counts
    are tiny (5 resources, at most 4 actions), so the composer reuses the same radio-chip control
    as the role selector. One visual language, native keyboard behaviour, no `<select>` in the
    build.
  - Cost: 642px -> 675px, because dropping the two least informative rows (`view` on Apollo and
    the invoice) paid for most of it. Fits 300px wide.
- **`accent-soft`, not `accent-dim`, for the allowed verdict.** Verified across all four palettes:
  worst case 7.12:1. `accent-dim` would have been ~4.4:1 under the azure and violet seeds, which
  is exactly the trap the two-token split was introduced to avoid.

### 3.6b — Terminal: real tools — DONE

`jwt <token>` decoding locally, plus `hash`, `uuid`, `base64`. The bar was that an engineer can use
the site to get actual work done, and it is met: the digests match the published NIST vectors.

- **`src/islands/terminal/tools.ts` is the deliverable**, not the commands. DOM-free, no imports
  from the component, **38 assertions in Node** — the same split as `policy.ts`, for the same
  reason: it is the file an engineer reading the repo will open. The commands are a thin printing
  layer over it.
- **Three bugs the tests caught before the browser did**, all of them the kind that only show up
  on input nobody tries by hand:
  - `btoa` throws on anything outside Latin-1, so `base64 encode café` would have failed. Fixed by
    encoding to UTF-8 bytes first — asserted against Node's own base64 and against an emoji.
  - Spreading a large byte array into `String.fromCharCode` overflows the call stack. Chunked at
    32k; asserted with a 200k input.
  - base64url needs `-`/`_` swapped back **and** its stripped padding restored. One test string,
    `PDw_Pz8-Pg`, exercises all three at once.
- **The whole-line `toLowerCase()` was a latent corruption bug.** Every existing command was a
  single lowercase word, so nothing had exposed it; the moment an argument matters, lowercasing
  and whitespace-collapsing the line silently mangles tokens, base64 and hash inputs. Dispatch now
  splits verb from argument and only normalises the verb.
- **`help` is generated from the registry**, with usage and a one-line description per command,
  grouped content / tools / session. Usage, description and implementation live in one object, so
  a command cannot be added without being documented.
- **Commands may return a Promise**, because `crypto.subtle` is async. The echo goes in
  immediately and the output appends on resolve, so the line never looks ignored. A `.catch`
  backstop puts a rejection in the terminal rather than only the console.
- **A per-row alignment helper aligns nothing.** `jwt` initially padded each claim against its own
  width, which is a no-op; the column has to be measured across the whole block. Caught by eye in
  the browser, not by the suite — worth remembering that formatting is not covered by unit tests.
- **Cost:** always-present JS unchanged at 1,268 B gzipped. The terminal chunk went 3,297 -> 5,573 B,
  all of it behind the button.

**Two changes made alongside, at Taha's request.**

- **The terminal button is now visible on every device** rather than touch-only and sr-only on
  desktop. See CLAUDE.md — the old arrangement made a headline pillar's discoverability depend on
  a visitor opening the machine view and reading it.
- **The source view's `interfaces` block is gone**, and with it the shortcut and the command list.
  What remains is one top-level `undocumented: ["sudo hire taha"]`. The removal is what the button
  bought: the signpost existed because the terminal had no visible entry, and a command list was
  never profile data. The joke was always the better half, and it is now the only written record
  of the command.
- Knock-on: `LISTED_COMMANDS` had derived from `site.interfaces.terminal.commands` specifically so
  the JSON and the terminal could not drift. With the JSON out of that business the constraint
  dissolves, and the registry moved into `commands.ts` where it belongs.
- **The panel's height cap was raised**, also at Taha's request: `~90dvh` -> `100dvh - 40px`.
  Two things worth keeping:
  - **Not a true 100dvh.** The resize handle would then sit on the viewport edge, un-grabbable —
    a panel you can open to full height and not drag back down. 40px keeps the handle reachable
    and leaves the nav visible, which is the only remaining sign the site is behind the panel.
  - **The bound was duplicated, and the duplicate won.** Raising the JS knob appeared to do
    nothing: `.term` still carried `max-height: 90dvh`, and the stricter CSS cap silently clamped
    the island's own clamp. Only caught because the measurement came back 626px against a
    requested 655px — 626/695 being exactly 90% is what gave it away. Both sites now carry a
    comment naming the other. `aria-valuemax` was hardcoded to `90` for the same reason and is
    now derived.

### 3.6c — Terminal: secrets worth finding — DONE

A four-step chain, and `sudo hire taha` is now earnable instead of only a joke.

1. `help` ends with **"not everything is listed."**
2. **`auth`** reports the session unauthenticated, shows `usage: auth <token>`, and points at the
   page source — "this site ships its own source. that is where credentials leak in real life
   too." Where to look, not what to look for.
3. A genuine HS256 JWT sits in **an HTML comment in the shipped page**. It is the only comment in
   the output, so the puzzle is noticing that view-source is worth doing at all. `jwt <token>`
   decodes it; the payload's own `note` claim says to hand it to `auth`, so the token
   self-documents for anyone who finds it without the terminal.
4. `auth <token>` **verifies the signature** and grants `sudo`. After that `sudo hire taha`
   succeeds — contact details and `exit 0` — and `help` reveals the command it had been hiding.

Notes worth keeping:

- **The verification is real**, not a string comparison: HMAC-SHA256 in `tools.ts`, asserted
  against `node:crypto` rather than only against itself. The token is minted at build time in
  `Base.astro`, so the comment carries a signature that was actually computed. Node and the
  browser share one `crypto.subtle` path.
- **The key ships in the bundle and the terminal says so on every success.** That is the lesson,
  not a caveat — client-side verification is theatre. Forging your own token by reading the key is
  the deeper easter egg. Nothing here protects anything, and nothing pretends to.
- **Claims are read only after the signature holds.** Trusting an unverified payload is the exact
  mistake this section is about; the tamper test grafts a valid signature onto an altered payload
  (`scope: owner`) and asserts it is rejected.
- **No `exp` on the token**, asserted. An expiry would break the puzzle at some future date,
  silently, with nobody watching — the failure mode is "the site looks broken to whoever finds it
  next", which no test would ever catch after the fact.
- **The layering bit back.** `src/data/secret.ts` first imported `signHs256` from
  `src/islands/terminal/tools.ts`. The bundler was happy; `node --experimental-strip-types` was
  not, because it will not resolve an extensionless relative import. That was the right complaint
  for the wrong reason — data should not depend on an island — so `secret.ts` is now
  dependency-free and the signing happens where it is used.
- **The unlock persists**, deliberately unlike the sandbox's drafts: a draft is an unfinished
  attempt, this is earned progress. It is the "access" residue and the Phase 5 achievement
  flag, recorded with no UI as CLAUDE.md requires. Six malformed stored values were fed to it —
  bad JSON, an object, an array of numbers, `null`, a mixed array, an empty array — and all six
  degrade to "unauthenticated" rather than throwing.
- **Cost:** always-present JS unchanged at 1,270 B gzipped. The signing key and verifier live only
  in the on-demand terminal chunk, checked by grepping the built assets rather than assumed.

### 3.6d — Terminal: the control surface — DONE

`theme`, `set`, `reset`, `open`, driving the same state as the source view. Fourteen commands now,
in four groups. **The terminal pillar is complete** — `whoami` was cut at Taha's request, so there
is no fourth terminal slice.

- **"Driving the same state" was held to literally**, which is the whole value of the slice.
  `theme` checks the same radio the palette buttons check, so the recolouring still happens in CSS
  with no JavaScript in the path. `set` and `reset` go through the source view's own editor
  closure — the same `write()` the contenteditable cells call, the same function the reset button
  is bound to. Proven in both directions in the browser: a `set` typed in the terminal is undone
  by the source view's reset button, and a value typed into a JSON cell is undone by `reset`.
  Neither would hold if this had been a parallel implementation, which is exactly the failure the
  rule exists to prevent.
- **That forced an idempotence guard.** The editor is lazy, and there are now two front doors onto
  it. Mounting twice would have bound a second listener to the reset button. `ensureEditor()`
  mounts once and returns a handle; `mountEditor` returns early if the handle already exists.
- **Two real bugs found while testing, both invisible without checking:**
  - **`scrollIntoView({ behavior: 'smooth' })` overrides CSS `scroll-behavior`**, and global.css
    flips that to `auto` under `prefers-reduced-motion`. Hardcoding smooth in JS would have forced
    the animation on precisely the visitors who opted out of it. Omitting the option defers to the
    CSS, so the existing guard applies. The nav anchors were never affected — being plain links is
    what saved them.
  - **Splitting the argument on whitespace truncates values.** `set role Backend Engineer` must
    keep all three words, so only the first token is the path and the remainder is the value,
    quotes optional.
- **`open` closes the panel before scrolling.** At full height the terminal covers the page, so
  scrolling behind it looks like nothing happened.
- **`theme` is deliberately not folded into `set`.** Colours are viewer settings and content is
  payload; one verb for both would blur the boundary that keeps `theme.accent` out of `GET /taha`.
- **51 settable paths**, read from the DOM rather than a list, so `set` with no argument cannot
  drift from what the page actually renders. `open`'s section list is read the same way.
- **A hidden-tab artefact worth not rediscovering:** a smooth `scrollIntoView` does not move a
  backgrounded tab at all, while `behavior: 'auto'` does. That looked like a broken `open` until
  the two were measured side by side. Third time this class of thing has cost time in this
  project — frozen transitions, clamped timers, and now suppressed smooth scrolling.
- **Cost:** always-present JS 1,270 -> 1,274 B gzipped. The editor chunk is shared, not duplicated:
  `set` dynamic-imports the same module the source view loads.

### 3.6g — Terminal: docking (bottom / left / right) — DONE

Added at Taha's request, after the three planned terminal slices. The panel now docks to any of
three edges and can either overlay the page or push it aside like an editor's.

- **Two orthogonal settings, published as two attributes.** The island writes `data-dock`,
  `data-dock-mode` and the size as `--dock-w` / `--dock-h` to `:root`, and every layout
  consequence is a stylesheet rule keyed off those. That is what keeps push mode a one-attribute
  difference rather than a second layout engine in JavaScript. All of it is gated on
  `[data-term-open]`, so closing the panel puts the page back with nothing to unwind.
- **`dock.ts` holds the sizing, DOM-free and tested in Node** — 46 assertions. The rules it
  encodes are relationships rather than numbers: min must fit inside max at every supported
  viewport, and a side dock may only be offered where the reserve still leaves a usable panel.
- **The test suite also reads `global.css` and asserts the backstops agree with the constants.**
  The stylesheet duplicates min/max as a pre-hydration fallback, and a stricter value there
  silently overrides the island — which had already happened once, when the height cap was raised
  and the CSS still said `90dvh`. That class of bug is now caught by a test rather than by
  someone noticing the panel will not grow.
- **The gutter had to change, and it is shared by the whole page.** `padding-inline: clamp(1.5rem,
15vw - 2rem, 12rem)` measures the viewport, which stops being the available width the moment a
  side dock pushes the page over: on a 1536px window with a 484px dock the column is 1037px but a
  bare `15vw` still bills it 192px a side. Subtracting the dock takes that to 83px. Verified in
  the browser, both numbers.
- **Per-axis sizes, stored separately.** A 50dvh height is a nonsense width. The height key keeps
  its old name so returning visitors' stored heights still apply.
- **A side dock defaults to 420px, not half the window.** Half the _width_ is a split screen;
  editors sit side panels around 300-400px. The bottom dock keeps 50dvh, which is what the spec
  asks for.
- **The resize direction inverts between the two side docks** — ArrowRight grows a left-docked
  panel, ArrowLeft grows a right-docked one — and `aria-orientation` becomes `vertical`. Wiring
  both sides to the same key is the easy mistake and feels wrong immediately.
- **Below 40rem a side dock is refused, with a reason.** The command says how much viewport it
  needs and how much there is, rather than accepting the instruction and quietly undoing it.
- **Cost:** always-present JS 1,274 -> 1,273 B gzipped. Nothing here is on the recruiter path.

**Push won, and overlay is gone.** Taha compared the two and chose push, so the losing mode and
the toggle were both deleted rather than left as a permanent setting — which is what the A/B was
set up to allow. What that removal touched: the `Mode` type, `MODES`, `DEFAULT_MODE`, `loadMode`,
`saveMode`, the `taha:terminal-mode` key, the `data-dock-mode` attribute, the title-bar toggle and
its styles, the `dock push|overlay` arm of the command, and the `[data-dock-mode='push']` qualifier
on every layout rule — push is now unconditional. Two assertions guard the removal: the stylesheet
must contain no `data-dock-mode`, and `dock.ts` must export no mode API.

**The default is the bottom dock**, and the dock plus each axis's size persist, so a visitor who
moves or resizes the panel finds it where they left it.

A stale `taha:terminal-mode` in a returning visitor's storage is inert — nothing reads it — and is
left to be swept up with `taha:api-progress` in Phase 5, where the localStorage work now lives.
Verified: a browser holding `taha:terminal-mode: "overlay"` still gets push.

Two harness lessons from testing this one, both cost real time:

- **Preact schedules `useEffect` through `requestAnimationFrame`,** which is paused in a
  backgrounded tab — so the dock attributes were simply never written and the panel looked broken.
  They arrive on the `setTimeout` fallback about a second later. Anything that asserts on an
  effect's result needs a real timer, not microtasks.
- **Never monkeypatch `window.innerWidth`.** Restoring it as a static value left it frozen at a
  stale number while the real window was 300px narrower; the component reads it for clamping, so
  every later measurement was against a fake viewport and produced a convincing-looking "clipped
  nav" bug that did not exist. Reload rather than patch.

### 3.6h — Twelve identities, six dark and six light

Taha's escalation: every theme becomes a full vibe, half of them light, so the site has twelve
distinct looks rather than twelve recolours — and brightness stops being a mode and becomes a
property of an identity. Split into three parts because it is the largest slice in the project.

#### 3.6h-1 — foundation — DONE

- **The three-seed derivation turned out to be polarity-agnostic**, which was the thing most likely
  to sink this. All nine derived tokens behave on a light ground with no light-specific overrides,
  and the contrast validator needed no change either. An unplanned payoff from deriving rather than
  hand-picking.
- **Light grounds are measurably harder, and the numbers are worth keeping.** Contrasting against
  near-white needs a _dark_ accent, and dark colours hold less chroma in sRGB. The same sweep used
  for the dark set says the most chroma every hue can share is 0.091 at L=0.53 — but that lands on
  4.6:1, AA with no headroom. L=0.45 trades colour for room: **C=0.077 at 6.6:1**, derived text
  accent at 5.9:1. So light identities are ~40% less colourful than their dark counterparts. That
  is the colour space, not a compromise, and it is better stated than discovered.
- **`color-scheme` had to become a CSS property.** It was a hardcoded `<meta content="dark">`, and
  a meta tag cannot respond to which radio is checked. Without the property a light theme keeps
  dark scrollbars, form controls and canvas underlay — broken at the edges rather than merely
  unusual. The meta stays as the pre-CSS default; the property overrides it.
- **Three panel shadows were an 85% black glow** — depth on a dark ground, a smudge on a light one.
  Now `--shadow-color`, softened to 16% for light identities.
- **`--vibe-bg` exists and defaults to `none`.** See CLAUDE.md: the background rule is amended, not
  dropped. What failed before was ambient texture on the page everyone sees; a ground belonging to
  one identity, off by default, is a different thing.
- **The vibe guard was inverted.** It required a _featured_ theme, on the reasoning that only a
  labelled palette could be selected — no longer true now the terminal has `theme <name>`. It now
  catches the thing still worth catching: a vibe whose id matches no theme at all.
- **`theme` lists the polarity, and nothing else does.** `default (dark)`, `ember (light)`, with
  `·` marking the current one. The polarity rides to the terminal as a `data-polarity` attribute on
  each radio rather than by importing `themes.ts`, which would drag the whole OKLab conversion into
  the terminal chunk to answer a question the markup already knows.
- **The boundary that keeps this from being a light/dark toggle**, asserted in tests: the default is
  dark, all four featured themes are dark, and every light theme is unlisted. There is no brightness
  control anywhere on the recruiter path.
- Verified in the browser: a light identity renders correctly end to end — hero, nav, chips, the
  permission sandbox and the terminal panel all follow, with no component-level light handling.
- **Font baseline recorded for 3.6h-2:** the default page fetches exactly two font files, 87KB. A
  new `@font-face` must not change that number until its identity is selected — the claim that
  per-vibe typefaces are free rests on it, so it gets measured rather than assumed.

#### 3.6h-2 — the six shapes — DONE

Six identities that differ in typeface, ground, borders, corners and density. Every dark theme is
now a shape; `default` is the sixth by absence of any override.

| shape         | theme   | typeface       | ground        | borders    | corners  |
| ------------- | ------- | -------------- | ------------- | ---------- | -------- |
| **clean**     | default | Inter          | flat          | 1px        | 2px      |
| **terminal**  | amber   | JetBrains Mono | scanlines     | 1px        | square   |
| **editorial** | azure   | Newsreader     | flat          | 1px        | square   |
| **brutal**    | violet  | Archivo, caps  | flat          | **3px**    | square   |
| **blueprint** | teal    | Space Grotesk  | drafting grid | **dashed** | square   |
| **soft**      | crimson | Nunito         | accent wash   | 1px        | **14px** |

- **The claim the whole plan rested on is now measured, not assumed.** A `@font-face` whose family
  no rendered text matches is never fetched, so four extra typefaces cost the default path nothing.
  Verified in the browser: the default page fetches **exactly 2 font files**, and selecting the
  editorial identity fetches Newsreader — a third — and only then. 149KB of typefaces, none of it
  on the recruiter path. A test also asserts no default-path rule references an identity face,
  because one accidental reference would fetch it for everybody.
- **Grounds are built from `color-mix` on the seeds**, never fixed colours, so a grid or a wash
  follows the palette and inverts with the polarity for free in 3.6h-3. Asserted.
- **Two more tokens were needed**: `--border-style` (blueprint is dashed) and `--display-case`
  (brutal is uppercase). Tailwind keeps its own `--tw-border-style` for the border utilities, so a
  shape sets both or the section rules stay solid while the components go dashed.
- **`background-attachment: fixed` was dropped.** It gives the nicest result for a wash but forces
  a repaint on every scroll of a 2,600px page, which is the wrong trade on a site with a hard
  performance constraint. Grounds tile or use `no-repeat` instead.
- **The hero was re-measured for all six shapes at 360 and 390** — no h1, nav or page overflow
  anywhere. This is the check that has bitten twice before: a serif at display size runs to 47px
  where Inter runs to 39, and Archivo and Newsreader have very different metrics.
- One false alarm worth recording: brutal's résumé button _looked_ clipped in a screenshot. It sits
  at 1243–1329 with **192px of slack** — a capture artifact, not overflow. Measure before believing
  a JPEG.
- Two shapes (**blueprint**, **soft**) are on unlisted themes, so they are terminal-only. That
  inverted an earlier build guard which required a vibe to be on a _featured_ theme — true when
  only labelled palettes could be selected, false once `theme <name>` existed.

#### 3.6h-3 — the light twins — DONE

Twelve identities from six designs. Every shape is worn twice — once on a dark ground, once on a
light one.

| shape         | dark    | light  | pairing                                      |
| ------------- | ------- | ------ | -------------------------------------------- |
| **clean**     | default | fern   | what ships, and its daylight equivalent      |
| **terminal**  | amber   | ember  | amber phosphor / a receipt printer           |
| **editorial** | azure   | moss   | a magazine, and the paper it is printed on   |
| **brutal**    | violet  | orchid | the pair that differs least — heavy is heavy |
| **blueprint** | teal    | indigo | pale lines on dark / a real whiteprint       |
| **soft**      | crimson | rose   | a wash of the accent, either way             |

- **A shape is defined once and worn twice.** `SHAPES` is keyed by design and `SHAPE_OF` maps
  themes onto it, so a pair literally shares one object — twelve separate definitions would have
  been twelve chances for a pair to drift apart, and the pairing is the whole idea. Asserted by
  identity (`===`), not by comparing values.
- **The grounds inverted for free, exactly as designed** — and this was the part I expected to need
  tuning. Because every ground is `color-mix` on `--color-fg` or `--color-accent` rather than a
  fixed colour, the blueprint grid becomes pencil lines on paper, the scanlines become a faint
  weave on warm white, and the soft wash becomes a blush instead of a dark smear. Nothing needed a
  light-specific value. Had any ground hardcoded a colour, all three would have needed doubling.
- **`clean` is still the absence of every override**, on both grounds: `default` and `fern` set
  nothing but their seeds. That keeps the shipped site the thing the other five depart from.
- **All twelve measured at 360 and 390** — no hero, nav or page overflow. Six typefaces, display
  sizes from 28px (mono) to 47px (serif), and nothing breaks.
- **Cost: 1,061 bytes gzipped for all twelve identities** (5,205 raw — highly repetitive selectors
  compress hard). A raw-byte assertion failed the moment the identities became complete, which was
  the assertion being wrong rather than the CSS: raw bytes never ship. It tests the gzipped figure
  now.

#### 3.6h-4 — pushed much further, at Taha's request — DONE

The six looks were "clean but tame". His brief: make selecting a theme feel like _a whole new site
opened_, and group the pairs so the twelve read as six. Both done.

- **Layout became an axis, which is what the set was missing.** Colour, type and spacing are a
  repaint; moving where the page _sits_ is a different site. Three new levers, all zero-JS:
  `--layout-align` / `--layout-justify` (the hero centres), `--layout-mx` (the measure centres with
  it), and `--label-cols` (section labels sit beside their content, or stack above it).
  - This required unpicking a hardcoded `sm:grid-cols-[9rem_1fr]` in Stack and Contact — a real
    layout axis was sitting inside a Tailwind arbitrary value where no identity could reach it.
    Both now share a `.label-grid` class driven by the token.
- **`--display-weight` too**, because `font-medium` is a utility and utilities outrank layers.
  Unlayered `h1 { font-weight: var(--display-weight) }` re-points it, the same trick `.border-b`
  uses. Editorial is 300, brutal is 900 — the same typeface at those two weights is barely the same
  typeface.
- **The grounds got much richer**, since the crimson wash was the thing Taha liked most. They are
  multi-layer now: terminal pools an accent glow out of the top _and_ keeps its scanlines,
  blueprint has a heavy major gridline every fifth square so the sheet has structure, brutal has
  hard diagonal bands, and soft is a three-stop wash that fades accent into foreground rather than
  a single flat tint.
- **What the six became:** clean is unchanged and restrained on purpose. Terminal is a CRT.
  Editorial is a magazine cover — 96px thin serif, centred, labels stacked. Brutal is a poster —
  Archivo 900 uppercase at 76px on diagonal bands. Blueprint is a drafting sheet. Soft is centred,
  rounded at 20px, on a three-stop gradient.
- **The listing groups by look**, so the twelve read as six designs on two grounds rather than
  twelve unrelated names, and `HUES` is ordered in pairs so that holds everywhere and not only
  where the terminal makes it explicit.
- **All twelve re-measured at 390 and 360** — no hero, nav or page overflow. This mattered more
  than usual: display sizes now run to 96px on desktop, and the clamp floors had to be checked
  against the smallest screen rather than assumed.
- Tests now assert the _brief_, not just the mechanism: every look must move type **and** either
  the layout or the ground. Colour and spacing alone would pass a token-diff check and still be a
  repaint.

**Phase 3.6 is complete.** Three pillars — the Permission Sandbox, the terminal, and customization
— all built.

### 3.6e — Customization: generated palettes — DONE

Four hand-picked presets became **twelve**: one hand-picked `default` plus eleven generated from a
single hue each. The generator, the contrast validation and every per-palette CSS rule live in
`src/data/themes.ts`, which stays import-free so Node can load it directly — 47 assertions.

- **OKLCH in, hex out.** OKLCH because its lightness is perceptually uniform: in HSL one recipe
  makes yellow far brighter than blue, so contrast would swing across the wheel and some hues
  would land under the floor while others washed out. Converted at build time rather than emitting
  `oklch()`, so the value that is validated is exactly the value the browser paints.
- **The recipe's lightness was found by measurement, and that was the whole job.** A fixed chroma
  is not achievable at every hue, because sRGB is not equally wide around the wheel. The first
  attempt (L=0.82, C=0.145) clipped seven of eleven hues and left the set visibly uneven — indigo
  down at C=0.089 while amber held 0.145, a 63% spread, with teal landing on pure `#00e0e0`.
  Sweeping L and taking the _minimum_ achievable chroma across all hues shows a clear optimum:
  below L=0.74 teal is the limiting hue, above it indigo is, and the two curves cross at 0.74
  where every hue can hold C=0.126. Every generated accent is now L=0.740 ±0.001, C=0.125 ±0.002,
  no clipped channels, 8.0–8.9:1 on its own background.
- **Clipping is a correctness bug, not a rounding detail** — it moves hue as well as chroma, so
  the generated blue stops being the requested blue. Chroma is binary-searched down until the
  colour fits, and a test asserts no accent sits on the sRGB boundary.
- **The derived text token is validated now, not assumed.** `--color-accent-soft` is a runtime
  `color-mix(in oklab, accent 65%, fg-muted)` that carries small text, so it is the one derived
  value that can quietly drop under AA. The oklab mix is reproduced at build time and checked; it
  lands 7.2–7.8:1 across the set. Four palettes could be measured by hand, twelve cannot.
- **`default` is not generated**, so tuning the recipe can never move the colours the site ships.
  Selecting it remains the absence of an override.
- **Swatches were built and reverted.** Twelve colour chips replaced the text labels, and Taha
  preferred the names — correctly: "amber" and "azure" say what they are, where a dozen anonymous
  squares make you click each one to find out. The named labels are back exactly as they were.
- **The source view shows four; the terminal reaches twelve.** Rather than crowd a strip meant to
  be quiet, only `default`, `amber`, `azure` and `violet` get a label. The other eight are
  **unlisted, not removed** — `theme <name>` selects any of them. That falls out of the existing
  markup for free: radios and labels were already separate so `~` could reach the header, so all
  twelve radios render and only four are labelled, and an unlabelled radio is still checkable.
  The terminal reads the radios rather than keeping its own list, so the two cannot disagree about
  what exists.
  - Every palette keeps its **seed rule** and its **contrast readout** whether featured or not:
    without the first, a terminal-selected palette would silently do nothing; without the second,
    the mandatory figures would be wrong. Both asserted.
- **Three hand-written sibling-combinator blocks are now generated.** They were four lines each
  and would have been thirty-six; a sibling combinator cannot be parameterised in CSS, so the
  choice was generating them or maintaining them by hand, which is the drift this file exists to
  prevent.
- **Still zero JS.** Verified rather than assumed: after clicking a swatch, `:root` carries no
  inline style, so the recolouring is `html:has(#theme-x:checked)` and nothing else.
- **Cost:** the whole palette system is 3,427 bytes raw, ~698 gzipped, for twelve palettes.

One finding worth keeping: **a hex cannot round-trip a precise hue at low chroma.** 8 bits a
channel is about 0.003 in OKLab a/b, so the angular error is `atan(step / C)` — 0.03° at C=0.125
but 2.2° at C=0.012. A round-trip test with a fixed hue tolerance fails on the near-neutral seeds
and looks like a conversion bug; it is the format's limit. The tolerance scales with chroma now.

### 3.6f — Customization: vibes — DONE

The featured four stopped being palettes and became **identities**: `default`, `amber`, `azure`,
`violet`, each carrying typography, density and border treatment on top of its colours. The names
stay colour names at Taha's request. Still zero JS — the same radio group, more tokens.

|         | typeface | display  | section rhythm | border  | corners | page height |
| ------- | -------- | -------- | -------------- | ------- | ------- | ----------- |
| default | Inter    | 60px     | 96px           | 1px     | 2px     | 2292px      |
| amber   | **mono** | 44px     | 84px           | 1px     | square  | 2097px      |
| azure   | Inter    | **72px** | 115px          | 1px     | square  | 2602px      |
| violet  | Inter    | 60px     | 92px           | **2px** | square  | 2238px      |

A 24% swing in page height between the densest and airiest. Amber reads as an amber-phosphor
terminal, azure as an editorial spread — the same site with a different character, which is what
"the vibe can be changed" was supposed to mean.

- **Density was nearly free, and that was the enabling discovery.** Tailwind v4 emits
  `--spacing: .25rem` and every one of the 33 spacing utilities on the site derives from it, so
  one override rescales the whole page. No per-component work.
- **But it missed the biggest spacing on the page.** `--spacing-section` was a fixed 6rem, so
  section rhythm ignored the density axis — the measurement showed 96px padding under every vibe.
  Deriving it as `calc(var(--spacing) * 24)` fixes that and is exactly 6rem at the default, so
  nothing shipped changes.
- **Tailwind inlines `1px` into `.border-b` and `.border-t`** rather than referencing a var, so
  the border-weight axis could not reach the nav, the section rules or the footer. Re-pointed by
  an unlayered rule, the same trick `themeCss` already uses to beat `@layer theme`. Verified:
  violet doubles all three.
- **Typography goes through two new indirections**, `--font-body` and `--font-display`, rather
  than redefining `--font-sans`/`--font-mono`. The stacks stay what they are and a vibe repoints
  what the page uses, so "everything mono" is a single declaration.
- **A mono vibe has to shrink its display size.** JetBrains Mono at the default clamp is far wider
  than Inter and the hero overflows a phone. Amber's clamp is pulled down accordingly, and the
  hero and nav were measured for **every vibe at 360 and 390** — no overflow anywhere, which is
  the check that would have caught it.
- **26 hardcoded values became tokens** — 11 radii and 15 border widths. Three were deliberately
  left alone: the 50% status dot (a circle), and the dock glyph's `1px solid currentColor` plus
  its 1px radius, which are an icon drawn out of borders rather than chrome.
- **A vibe on an unlisted palette throws at build.** Only the featured four have a label, so only
  they can be selected; a vibe anywhere else is dead weight that looks like a feature.
- Tests assert the thing that actually matters: **no two vibes emit the same declarations**, and
  each moves at least two axes beyond colour. Four names for one design would otherwise pass.
- **Cost:** the whole palette-and-vibe system is 2,460 bytes raw. No new fonts — a third typeface
  would be 20–30KB against a hard performance constraint, and mono-vs-sans plus scale and tracking
  already carries more character than a third family would.

## Phase 4 — Return Experience (REMOVED)

**Cut at Taha's request**, and the reasoning is worth keeping because it also explains what
replaced it.

The phase had four items. Three were already hollow by the time it came up: the **repo link** was
built in Phase 1 and sits in the footer; the **anonymous visitor ID** had no consumer, since with
no backend and no analytics nothing reads it and "have I been here before" is answered by a
timestamp; and the **flag persistence** was never really return-experience work — it is the
substrate achievements are built on.

That left the **returning-visitor message and rotating hint** as the only real content, and Taha's
argument against it is the stronger one: achievements persist, so a visitor who found three things
already has a concrete reason to come back, and a list showing `???` for what is unfound says
exactly what is left. "Welcome back" says nothing by comparison. CLAUDE.md's framing for this was
_"curiosity, not addiction"_ — a list of unfound things is precisely that.

**A second benefit, which is not incidental.** The returning-visitor line was the only planned
feature that would have put _content_ JavaScript on the recruiter path. Everything on the initial
page today is loaders for on-demand features — 1,273 bytes that fetch things when asked and
otherwise do nothing. A message on the page means the initial load executes code that mutates the
DOM. Cutting it keeps "the recruiter path ships no JS until the visitor asks for it" literally
true, which is a claim the README has to be able to make.

**What survives, and where it went:** the unlock-worthy flags are now **Phase 5 step 2**, where
they belong. Removing this phase must not be read as "persist nothing" — the persistence is the
load-bearing half and getting it right is what makes the achievement list cheap to build.

Also folded into Phase 5: sweeping the two keys orphaned in returning visitors' browsers,
`taha:api-progress` (from the removed API Simulation) and `taha:terminal-mode` (from the
push/overlay comparison). Both are inert; neither is read by anything.

**Not to be rebuilt without an explicit instruction:** the returning-visitor message, the rotating
discovery hint, the anonymous visitor ID, and `whoami`.

### 3.6i — Terminal: text size — DONE

A small UI change asked for before Phase 5's plumbing: `A−` / `A+` in the title bar, plus
Ctrl/Cmd `+` / `-` while the panel has focus. **10–15px from a default of 13**, persisted
alongside the dock and the per-axis sizes.

- **One token, one line.** `.term` already set the base size and `.term-input` already said
  `font: inherit`, so putting the size in the panel's inline style scales the scrollback and the
  input together. The title bar states 11px explicitly and is therefore untouched — chrome must
  not scale with the thing it is scaling.
- **The bounds ended up Taha's**, narrowed from the 11–20 first proposed: a terminal is somewhere
  you want more lines on screen rather than comfortable prose, so the floor sits below the machine
  view's 11px.
- **One assertion earned its place immediately.** `FONT_MAX` was briefly equal to `FONT_DEFAULT`,
  which disabled `A+` from the moment the panel opened — the control could only shrink. The test
  now asserts `FONT_MIN < FONT_DEFAULT < FONT_MAX` rather than any particular numbers, so the
  bounds can move freely but cannot become unusable.
- **The shortcut takes Ctrl/Cmd `+`/`-` from browser zoom**, which is only acceptable because the
  handler sits on the panel and so fires only while focus is inside it. Verified both ways: all
  four key faces (`+ = - _`) work inside, a plain `+` still types, and `Ctrl+=` on the hero is
  **not** swallowed — zoom comes straight back when you click away.
- **A test found a real weakness.** `Math.min(Math.max(NaN, lo), hi)` is NaN, so `clampFont` could
  return NaN and reach the DOM as `font-size: NaNpx` — invisible until someone wondered why the
  buttons had stopped working. Unreachable today because `loadFont` guards first, but it is a
  public function, so it now falls back to the default on non-finite input.
- Buttons disable at each bound rather than silently ignoring a press.

---

## Phase 5 — Achievements (designed last, from the finished site)

**Goal:** now that the site actually exists, work out what's worth rewarding and build it. This
phase is deliberately last-but-one: the list is derived from the real moments the finished site
offers, not invented up front. Nothing built so far has shipped achievement UI, which is what makes this possible.

Precondition: the site is finished. **Phase 4 was removed**, so the flags it would have persisted
are this phase's job — step 2 below. What already exists to build on: `taha:unlocked` (the `sudo`
scope earned through the terminal's auth chain) and the terminal's own UI preferences. Everything
else needs wiring here.

Build, one step at a time with approval between each:

1. **Audit + propose the list — DONE.** The audit found ~40 reachable moments; Taha approved
   **twelve**, listed below. Anything not on it was cut, and the cuts are as deliberate as the
   keeps.

   | #   | achievement                | what it takes                                                     |
   | --- | -------------------------- | ----------------------------------------------------------------- |
   | 1   | Open a channel             | open the terminal                                                 |
   | 2   | Rewrite the page           | edit a value in the JSON                                          |
   | 3   | Use it, don't just read it | run `jwt` / `hash` / `base64` / `uuid`                            |
   | 4   | Give them what they need   | satisfy a brief                                                   |
   | 5   | Grow the payload           | add an object to an array                                         |
   | 6   | Daylight                   | find one of the six light identities                              |
   | 7   | Find the leak              | run `sudo hire taha` while still locked                           |
   | 8   | Clean slate                | empty the whole payload — every value cleared, every array empty  |
   | 9   | Clear the board            | solve all nine briefs                                             |
   | 10  | Get authorised             | `auth <token>` verifies                                           |
   | 11  | Same state, two doors      | change it with the terminal, undo it with the source view's reset |
   | 12  | Mint your own              | forge a valid token and pass it to `auth`                         |

   **The wording is present tense**, changed at Taha's request after the list shipped: the panel
   is read far more often as a checklist of what is left than as a trophy case, and past tense
   told an unearned row that it had already happened. The table above tracks the shipped
   wording rather than the wording as first approved — it is what CLAUDE.md points at for
   "the list". Four entries are noun phrases with no tense to change.

   Ordered easy → hard. **Mint your own** is last deliberately: it is the only one that requires
   understanding _why_ the auth chain is theatre, since earning it means noticing that the signing
   key ships in the bundle and using it yourself.

   Notes that matter for the build:

   - **Every trigger lives inside one of the three on-demand islands** — terminal, source view,
     sandbox. That is a hard constraint, not a coincidence: an achievement triggered on the
     homepage itself would need JavaScript on the recruiter path, which is exactly what removing
     Phase 4 protected. It is why "found the 404", "clicked View source" and "downloaded the
     résumé" are **not** on the list, and must not be added.
   - **Subsumed entries were cut rather than kept.** "Opened the machine view" is implied by
     _Rewrite the page_; "decoded the token" is implied by _Get authorised_. Both were dropped.
   - **Clean slate is the tedious one**, by design — 46 values plus emptying six arrays.
     `set <path> ""` works from the terminal, so the fast route is to clear values through the
     control surface and use the `−` control for structure, which quietly rewards the same insight
     as _Same state, two doors_.
   - **Clear the board needs a set of solved brief ids**, not a counter — a collection of
     write-once flags, which keeps it inside the no-streaks rule.
   - Rejected during the audit, with reasons, so they do not come back: all-six-shapes (rewards
     clicking through a list rather than noticing anything), docking (a preference, not a
     discovery), least-privilege and judgement-specific solves (cut as repeating the same
     criteria), and the 404 (would need JS on a page that ships none).

2. **Unlock plumbing — DONE.** Two modules and twelve writes.
   - **`src/data/achievements.ts`** — the twelve as pure data, no imports, so Node reads it
     directly. Each entry names the island that awards it, which is documentation _and_ an
     assertion.
   - **`src/islands/achievements/flags.ts`** — a deliberately dumb store. It records ids and does
     not know what any of them mean; every derivation belongs to the island that owns the
     question, because that is the only place the denominator is known. A store hardcoding
     `=== 9` would be wrong the day a tenth brief is written, so `Clear the board` is derived in
     `Access.tsx` from `SCENARIOS.length`.
   - **Write-once flags, no counters, no dates.** Not even a first-seen timestamp — nothing needs
     one now that the list is the return mechanic. Asserted by grepping the store for date
     arithmetic and increments, so a streak mechanic cannot creep in later.
   - **Solved briefs are a set of ids**, never a count: solving the same brief twice must not move
     you closer to having solved them all.
   - **Untrusted reads**, like everything else stored here — bad JSON, an object, a number array,
     `null` and a mixed array all read as "found nothing", verified.
   - **The orphan sweep runs from whichever island loads first.** A visitor who never opens one
     keeps their two dead keys, and that is the right trade: sweeping on the homepage would put
     JavaScript on the recruiter path to delete two strings nothing reads.

   **The test that matters most** cross-references the list against the source: every id must be
   awarded somewhere, and nothing may be awarded that is not on the list. An achievement defined
   but never wired is a permanent `???`; an award for an unknown id is dead code. Neither can now
   survive a run.

   **Two bugs found while wiring, both by testing rather than reading:**
   - `used-a-tool` required an argument, so a bare `uuid` — which is a completely valid use, it
     generates one — did not count, while a bare `jwt` printing a usage error would have if the
     guard had been the other way round. `uuid` is now separated from the three tools that need
     input.
   - `found-leak` was written into the _success_ branch of `sudo hire taha` under the wrong id.
     It belongs in the **locked** branch: `help` does not name that command, so running it while
     still locked is what proves you read the payload. Reaching the success ending means the
     unlock chain told you, which is a different discovery.

   **Cost:** always-present JS 1,274 → 1,382 bytes gzipped. None of it is achievement logic —
   `flags.ts` became a shared chunk, so each loader now carries a `__vite__mapDeps` array naming
   it. That is preload metadata, and it buys a parallel fetch when an island opens rather than a
   serial one. Verified no initial script contains any flag code.

   All twelve were earned by hand in the browser, including signing a token with the key scraped
   out of the built bundle — which is the intended route for **Mint your own** and confirms the
   key really is findable. `Clean slate` turned out easier than estimated: emptying the arrays
   removes most of the values with them, so it is ~29 actions rather than 50+.

3. **`/achievements` page — DONE, then redesigned.** The first version was a numbered list of
   `???` with the earned ones filled in by script. Taha's verdict was that it was not intuitive,
   and two of his instructions removed the reason it was built that way:
   - **Every row shows its title and what it takes, earned or not** — greyed until found, at his
     request. That kills the "labels are not in the HTML" rule outright: there is nothing left to
     withhold, so the labels are now plain markup and **the page is complete with JavaScript off**
     rather than being thirteen blanks waiting for a chunk. The script only marks which rows are
     done. The list reads as a checklist of what is left, which is what makes it the return
     mechanic that replaced Phase 4.
   - **Ordered by difficulty, with no difficulty labels** — easiest first, hardest last, the
     grouping carried by comments in `achievements.ts` and by nothing the visitor sees. Naming
     tiers would turn a list of things to find into a scoreboard.
   - **The redesign itself.** The framing block borrowed from the source view and the 404 is gone:
     it dressed a real page as a fake HTTP response for no reason, and it was the first thing on
     the page. In its place, a **row of thirteen pips plus a count** — progress answerable at a
     glance, before any reading, which a line of small caps above a list never was. Rows became
     **two lines**: a 15px sans title over an 11px mono description. Thirteen single-line mono
     rows read as one undifferentiated block with nothing marking where an entry began.
   - **State shows in three ways at once**, never hue alone (WCAG 1.4.1): the glyph changes
     (`check` vs `circle-dashed`), the title comes forward from muted to full, and the pip fills.
   - This route runs a script, which is fine: it is not the recruiter path. That distinction is
     the whole reason the flag design works.

4. **Entry icon — DONE, then redesigned.** A door in the **bottom-left**, opposite corner to the
   terminal and source-view controls so it does not read as a third button in a row.
   - **It is a bordered box containing a Lucide `shapes` mark**, at Taha's request — the first
     version was a bare glyph, and the two controls in the opposite corner are boxes. Matching
     them makes it read as a control rather than as a smudge, without making it loud.
   - **Deliberately hard to spot**, also at his request: `opacity: 0.22` at rest, full on hover or
     focus. Raised from `0.09`, which the box treatment made unnecessary — a shape at 0.22 is
     still easy to miss and no longer invisible. Not `0`: an icon nobody can find is a feature
     that does not exist. No idle animation (CLAUDE.md).
   - **A plain `<a>` and nothing else.** It does not read stored flags to show its state, because
     that would put content JavaScript on the recruiter path — the one thing removing Phase 4
     protected. Verified: adding the door changed the initial JS by **zero bytes**.
   - 44×44 hit area so sweeping the corner finds it and WCAG 2.5.8 is met even though the mark
     inside is small; keyboard-focusable with a real accessible name, so a screen-reader visitor
     finds it by tabbing rather than being excluded from the game.

   **A thirteenth achievement came with it**, at Taha's request: **Find the door**, earned by
   arriving.

5. **Unlock feedback — DONE, then redesigned.** A card in the bottom-left saying what was just
   found, stacked above the door.
   - **Not the icon's state**, which CLAUDE.md offers as the alternative: rendering it would mean
     reading stored flags on the homepage, and that is content JavaScript on the recruiter path.
   - **The two rules in CLAUDE.md conflict on their face** — "a brief one-time notice" is
     permitted one line above "no achievement mention anywhere on the homepage". Resolved by
     reading the second as forbidding _persistent_ chrome: no counter, no badge, nothing left
     behind, and never seen by anyone who does not open an island. Recorded there.
   - **It became a card because a line was missable.** The first version was one thin mono line;
     Taha asked that an unlock be plainly visible. It is now the `shapes` mark, an `Unlocked`
     kicker, the title in sans and the moment in mono, with a 3px accent left border and a
     shadow — held for **5s** rather than 3.2s, since there are three lines to read now.
     Still nothing that loops, and still nothing left behind.
   - **`award()` replaced `earn()` in the islands**, so recording and announcing cannot come
     apart. There is no way to add an achievement that earns silently. The page still uses
     `earn()` — announcing "Find the door" to someone reading the list is telling them what is
     in front of them.
   - **The notice does not link to the page.** It sits above the door so it gestures at where the
     door is without handing it over, and it carries the same mark, so the notice and the place it
     points at are visibly the same thing.
   - **A real bug, caught by measuring rather than reading.** The entrance was a transition
     triggered by a `data-shown` attribute set inside `requestAnimationFrame` — and rAF is paused
     in a backgrounded tab, so the notice would have stayed at `opacity: 0` for its whole life and
     then been removed unseen. It is a CSS animation on insert now, with no JavaScript trigger at
     all. Verified the resting opacity is 1 with the animation removed, since a frozen animation
     cannot be observed in a hidden tab.
   - `role="status"` and `aria-live="polite"`, so it never interrupts a screen reader mid-sentence,
     and `pointer-events: none` so it can never eat a click.

6. **An icon library, added for the above — `lucide-static`.** The page, the door and the notice
   all wanted real marks rather than punctuation, so one dependency arrived to serve all three.
   - **`lucide-static`, not `lucide-react`.** Taha suggested the React package; it would have
     pulled React into a Preact project for the sake of drawing three shapes. `lucide-preact`
     would at least reuse the runtime, but both ship a component and therefore client JavaScript.
     `lucide-static` is a directory of plain SVG files.
   - **`src/components/Icon.astro` inlines one at build time** with `readFileSync`, so an icon
     costs **zero client JavaScript** — the only terms on which one belongs on the recruiter path.
     A missing name throws at build rather than rendering nothing.
   - **Two traps, both hit.** The file was resolved from `import.meta.url`, which during a build
     points into `dist/.prerender/chunks/` — every icon "did not exist". Resolved from
     `process.cwd()` instead. And Astro's scoped CSS cannot reach markup injected through
     `set:html` by another component, so `.ac-icon-done { display: none }` matched nothing and
     **both** row icons rendered on every row; `:global()` is required, the same trap as
     runtime-created elements already recorded in CLAUDE.md.

**Also changed while here:** every in-page anchor became a rooted fragment (`/#stack`). The nav
renders on `/achievements` and the 404 too, where a bare `#stack` pointed at nothing and the link
silently did nothing.

**And a real bug in the policy engine, surfaced by two tests contradicting each other.** One
asserted a `fix` scenario is never graded on extras (the rule written on `Scenario.mode`); another
asserted that adding something while fixing _is_ an extra. `grade()` implemented neither — it
measured every draft against zero, so `leak` began with its three key permissions counted as the
visitor's own over-granting while a failing must-not already named all three. The same problem,
reported twice in two vocabularies, one of them blaming the visitor for the starting policy.

The rule that reconciles them: **an extra is what the visitor granted, measured against what they
were handed** — `initialDraft(scenario)` is the baseline, not the empty set. A permission already
in the shipped policy is not theirs; one they tick on top still is. `build` starts from nothing, so
its behaviour is unchanged. Verified in the browser as well as in Node: the finished `leak` fix now
reads _"solved — exactly the permissions needed"_, and ticking `project:transfer` on top of it
still fails.

Locked rules that still apply: flat list, no categories, no homepage mention. (`???` for
locked is **withdrawn** — see item 3.)
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

### Done ahead of the phase: the tests moved into the repo

They were written outside it, in a temp directory, and were one sweep away from being gone —
nine suites and ~400 assertions encoding decisions that would otherwise regress silently. The
`fix`-mode baseline rule found at the end of Phase 5 is the example: two suites disagreed, and
that disagreement was the only thing that surfaced a real bug in `grade()`.

- **`tests/` plus `npm test`**, a 40-line `harness.mjs` and a runner giving each suite its own
  process — `achievements.test.mjs` installs a fake `localStorage` on `globalThis`, and suites
  sharing a process would share that.
- **No framework**, per CLAUDE.md's rule that none is added until something demands one. Nothing
  here does: every assertion is one boolean and one label.
- **The absolute paths were the actual blocker.** Every suite named `D:/My Data/...`, which is
  precisely why they could not be committed. All resolution goes through `harness.mjs`'s `ROOT`
  now, `readFileSync` included.
- **Verified assertion-for-assertion**: each migrated suite prints exactly the count its original
  did (34/54/14/46/25/51/18/122/38), so the mechanical rewrite dropped nothing. Two Node builtins
  (`node:fs`, `node:crypto`) were caught by a blanket `import(` → `load(` rewrite and put back.
- **The API Simulation's five suites were not moved** — their engine is deleted, so they are dead
  code, and dead code is clutter in a repo that _is_ the portfolio.
- Three unused destructured imports came out with them; `npm run check` is now 0 errors,
  0 warnings, 0 hints across 47 files.

The README must describe this honestly: plain Node scripts, no framework, and they cover the
engines rather than the UI.

### Also done ahead of the phase: the achievements panel replaced the route

Taha's proposal, and the right one: the site is an SPA, and a whole route for a thirteen-row list
was the one thing that was not. `/achievements` is gone; the door is a toggle for a panel in the
same corner.

- **It fixed a real defect.** `/achievements` and the 404 both shipped the entire `GET /taha`
  payload and a working source-view toggle — pressing `{ }` on the achievements page swapped it
  for JSON about Taha. The source view is the machine rendering of _this page's_ content and only
  the homepage has one, so it now renders there and nowhere else. The 404's HTML fell from ~7.3 KB
  to 3.8 KB gzipped and its JS from ~1.3 KB to 816 B.
- **What it cost, stated honestly.** The route rendered all thirteen rows as HTML and read
  correctly with JavaScript off. A runtime panel cannot. Accepted knowingly: the list is entirely
  per-visitor state living in localStorage, so JavaScript-off gave you a catalogue and no progress.
  The recruiter path went from **1,267 to 1,587 B gzipped** for the loader; the panel itself is a
  1,365 B chunk fetched on the first click, and **no achievement label appears in any prerendered
  HTML** — which the route could not say.
- **Both other buttons stay visible while it is open**, at Taha's instruction. Hiding them was in
  the original proposal and he was right to keep them: watching a row tick over while you work in
  the terminal is the best moment the feature has, and hiding is the modality the terminal's spec
  rejects. The source view is the one exception — it swaps the whole page, so opening it closes
  the panel, via a listener that lives in the panel's own chunk rather than in the loader.
- **A latent bug surfaced.** Only the _right_ dock offset the fixed corner controls. A left-docked
  terminal slid underneath the door, the unlock notices and the panel; a bottom dock covered that
  corner outright. Both mirrored rules added, and the panel's height budget subtracts the dock too.
- **Plain DOM, not Preact** — thirteen static rows whose only state is one boolean each, decided at
  open. A renderer would be a dependency in that chunk earning nothing.
- Non-modal like the terminal: `Esc` closes, focus returns to the door, nothing is trapped.
- Measured in a sized iframe at 360 and 390, since the harness would not shrink the window: fits,
  clears the door, scrolls internally, no horizontal overflow.

**Tests followed the move.** The suite's page assertions are now panel assertions, and the two
properties above — dynamic import, and a loader that never touches flags — are asserted rather
than assumed.

### Also done ahead of the phase: spacing, scrollbars, reset, and a fourteenth

Four things, all Taha's:

1. **The panel got room to breathe.** Wider (23 → 25rem), rows at 0.8rem block padding with the
   title and description further apart, and 1.15rem insets throughout. The list's right inset is
   smaller than its left so the scrollbar sits in the gap rather than over the text.
2. **Custom scrollbars, site-wide.** See CLAUDE.md's Scrollbars section for the rules. Two real
   findings: `scrollbar-width` does not inherit (so it goes on `*`, not `:root`, or every inner
   container keeps the 15px platform bar _with arrows_), and the thumb at `--color-fg-subtle`
   failed WCAG 1.4.11's 3:1 on **all six light identities** at 2.77-2.79:1. Swept the mix: 50%
   lands on exactly 3.00, 54% gives 3.35 worst case. Asserted per theme, both grounds.
3. **A reset control**, quietest thing in the panel, two-step, clearing `taha:earned` **and
   nothing else**. It cleared the solved briefs too at first; Taha's instruction was achievements
   only, and the distinction is right — the briefs are the sandbox's progress, not an achievement
   record. See CLAUDE.md for the consequence that follows.
4. **A fourteenth achievement** — `all-found`, the capstone, earned when the other thirteen are.
   Excluded from its own requirement, or the set never closes. Awarded from `sealIfComplete()` at
   the single point every island records through.

**One regression I introduced and then fixed.** Offsetting the panel above a bottom-docked
terminal left it ~240px on a laptop, of which the fixed chrome took 160 — one visible row above a
footer, which reads as broken rather than as tight. Under a bottom dock the intro and the footer
note now give way and the paddings come in: two full rows plus partials, with the reset still
reachable. It is genuinely cramped at a half-height terminal on a 695px viewport, and dragging the
terminal down gives it back immediately.

### Also done ahead of the phase: the terminal button became a toggle

Taha's note: the source-view and achievements controls both highlight while open and close on a
second click, and the terminal should match.

- **Click now toggles** rather than always opening, and the button is **lit while the panel is
  open**, keyed on `:root[data-term-open]` so it is correct however the panel was opened — the
  button, ⌘K, or a command. `aria-expanded` is published from `markOpen()`, the one place that
  knows, so `Esc`, the panel's own close control and `open <section>` all keep it honest.
- **It uncovered a worse bug than the one it fixed.** Only the _right_ dock offset the fixed
  corner controls, so a bottom-docked terminal — the default — drew itself straight over its own
  open button and the source-view toggle. The terminal could be opened by clicking and then only
  closed with `Esc`, because the button it came from was underneath the panel. Making the button a
  toggle would have been pointless without this. All four controls now offset for a bottom dock,
  with a test per control per dock (eleven assertions).
- **A measurement lesson worth keeping.** `getComputedStyle` through the browser harness reported
  the muted colour whether the panel was open or closed — even with the accent forced inline,
  which is impossible. I moved the rule between files chasing a cascade problem that did not
  exist; the screenshot showed the highlight working the whole time. The rule stayed in
  `global.css` because that is where the other rules targeting this button live, but the comment
  claiming it "silently did nothing" was written on a bad measurement and has been corrected.
  **On this project, the screenshot is the ground truth for anything visual.**

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
