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

## Phase 3 — The API Simulation + easter eggs

**Goal:** the discovery layer, built around the API Simulation as the spine.

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
> below, before Phase 4.

---

## Checkpoint — cut the API Simulation back

**Runs after Phase 3.5 and before Phase 4.**

**The simulation is finished and it is too big. Do not start Phase 4 until this is resolved.**
Taha's own words after stage 5 landed: _"i myself am not understanding the API endpoint part, how
will others understand it"_ — the person who commissioned it cannot follow it, so a recruiter
certainly cannot.

The mechanics are not the problem; the legibility is. Every step was verified for "is this
technically honest" and none for "can a person follow this". The diagnosis, recorded so it is not
re-derived:

- **The visitor stops being the one doing it.** Stage 1 is broken by hand and feels caused.
  From stage 2 on you press "run exploit" and watch numbers, because those attacks genuinely
  require machine timing. You become the audience for your own game.
- **There is no sense of place.** Nothing ever states which stage you are on, how many there are,
  or what is protecting the endpoint right now. It has to be reconstructed from a chain of words
  and six counters.
- **"Say nothing up front" got over-applied.** That rule exists to protect the _first_ discovery.
  Applied forever it means the game still refuses to explain itself after the visitor has crashed
  it and clearly opted in — which is obscurity, not mystery.
- **Stage 4 depends on the multi-identity idea**, the hardest thing here to feel. Eight callers
  each obeying their own limit cannot be experienced, only reported.

**The leading proposal** (not yet decided — revisit with Taha): cut the _visitor's_ path to three
stages, ending at the cache, and keep the full engine in the repo. CLAUDE.md already holds that
the backend credibility comes from the code rather than a running system, and the queue,
backpressure and breaker read well to an engineer who opens the source — which is the reader they
were always for. A recruiter was never going to reach stage 5. Pair the cut with a persistent
"where am I" line and with un-hiding the toolkit after the first crash, since three stages still
needs to say where you are.

Also open, and worth deciding at the same time: **whether the section deserves this much of the
page at all.** It sits between Stack and Contact on a deliberately minimal portfolio and is the
largest thing on it even at three stages. A version that keeps only the crash and one fix, with
all remaining depth in the repo, is a legitimate outcome.

---

## Phase 4 — Return Experience

**Goal:** light reason to come back, without pressure mechanics.

**No backend** — this phase is entirely localStorage. No sync, no remote store, no service.

Build (one at a time, approval between each):

1. Anonymous visitor ID, generated client-side, kept in localStorage
2. Interaction/unlock-flag persistence in localStorage, read after first paint
3. Returning-visitor message + one small rotating discovery
   - Add the terminal's **`whoami`** here: visitor id, first vs returning, what has been found.
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
