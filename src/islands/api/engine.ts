/**
 * A simulated API server.
 *
 * The load is fake; the mechanics are not. Requests occupy the server for a
 * service time, that service time degrades as concurrency rises, and the
 * feedback loop is what kills it — real systems fail this way rather than
 * politely stopping at a limit.
 *
 * Defences are real implementations too, added one at a time by the visitor.
 * Each is deliberately the *textbook* version, flaws included: the fixed-window
 * limiter below really can be beaten by bursting across a window boundary, and
 * that flaw is the next stage of the game rather than a bug to hide.
 *
 * No DOM in here on purpose: the engine is a plain state machine the UI polls,
 * which keeps it readable on its own and testable without a browser.
 */

export type Outcome = 'served' | 'failed' | 'limited' | 'cached' | 'queued' | 'shed';

/** What a plain click asks for. Attacks vary it to defeat the cache. */
export const ORIGIN_PATH = '/taha';

/** Who a plain click is. Attacks vary it to defeat the rate limiter. */
export const SELF_IDENTITY = 'you';

/** Defences, in the order they become available. */
export const DEFENCE_ORDER = ['ratelimit', 'cache', 'queue', 'breaker'] as const;
export type Defence = (typeof DEFENCE_ORDER)[number];

export const DEFENCE_LABEL: Record<Defence, string> = {
  ratelimit: 'rate limit',
  cache: 'cache',
  queue: 'queue',
  breaker: 'breaker',
};

/**
 * One line each, in plain words.
 *
 * The chain keeps the real names — `rate limit`, `cache` — because those are
 * worth learning and an engineer reading the page should see them. The blurb is
 * where the idea gets explained, so it says what the thing does rather than
 * restating its name in more jargon. "Cap requests per window" tells you
 * nothing you did not already get from "rate limit".
 */
export const DEFENCE_BLURB: Record<Defence, string> = {
  ratelimit: 'only let a few through every couple of seconds',
  cache: 'remember answers and reuse them',
  queue: 'make requests wait in line instead of piling up',
  breaker: 'turn people away early instead of falling over',
};

/**
 * A group of requests fired in a single tick.
 *
 * Volleys rather than one timer per request, because the stage-2 exploit needs
 * requests landing on the correct side of a window boundary and `setTimeout`
 * cannot be trusted to 10ms. Requests inside a volley share a timestamp, which
 * is exactly what "sent together" means to the limiter — so the attack depends
 * only on where each volley falls relative to the window, never on scheduler
 * precision.
 */
export interface Volley {
  /** Milliseconds from the start of the run. */
  readonly at: number;
  readonly count: number;
}

/**
 * The executable form of a defect. From stage 2 these are not a convenience:
 * the boundary burst asks for six requests placed across a 120ms slot two
 * seconds after a probe, which no one can do by hand.
 */
export interface Attack {
  readonly volleys: readonly Volley[];
  /** Shown while the run is deliberately idle, before the first volley. */
  readonly wait?: string;
  /**
   * Give every request in the run a different path, so nothing can be reused.
   * This is what makes an attack survive a cache — and it stacks with the
   * boundary timing rather than replacing it, because the rate limiter is still
   * out front and has to be beaten first.
   */
  readonly unique?: boolean;
  /**
   * Spread the run across this many callers. A fixed-window limiter counts per
   * client, so arriving as several clients multiplies the allowance without any
   * single one of them breaking its own limit — which is the whole lesson of
   * the stage it unlocks.
   */
  readonly identities?: number;
}

export interface Defect {
  readonly id: string;
  /** What is wrong, in words that need no background to read. */
  readonly title: string;
  /**
   * The name an engineer would use. Shown as a dim tag beside the title, so the
   * plain sentence is what carries the meaning and the jargon is a label you
   * can look up rather than a wall you have to get past.
   */
  readonly term: string;
  /** How the exploit works. Plain language — it arms, it does not lecture. */
  readonly hint: string;
  readonly patchedBy: Defence;
  /** Absent until the stage that introduces it has been built. */
  readonly attack?: Attack;
}

/**
 * The known defects, one per stage, in the order they become reachable.
 *
 * These are the contents of the hidden report the bug icon opens. Listing the
 * weakness is the whole point of finding it — the secret is that the report
 * exists, not what it says. Each entry is patched by the defence that answers
 * it, at which point it stays in the list as a changelog line rather than
 * disappearing.
 *
 * Index `n` is the defect present when `n` defences are applied, so
 * `DEFECTS[i].patchedBy === DEFENCE_ORDER[i]` by construction.
 */
export const DEFECTS: readonly Defect[] = [
  {
    id: 'BUG-01',
    title: 'it starts more work than it can finish',
    term: 'unbounded concurrency',
    hint: 'Every click starts a new request and nothing turns any of them away. It can only handle four at a time — send eight in half a second and it falls over.',
    patchedBy: 'ratelimit',
    // Eight singles, 60ms apart: concurrency outruns the service time and the
    // fifth one is over capacity. Nothing clever — it is the attack the visitor
    // has already performed by hand, offered here so the toolkit teaches itself
    // before the stage where it becomes the only option.
    attack: { volleys: Array.from({ length: 8 }, (_, i) => ({ at: i * 60, count: 1 })) },
  },
  {
    id: 'BUG-02',
    title: 'the limit clears all at once',
    term: 'fixed window reset',
    hint: 'The allowance resets every two seconds rather than easing off. Save yours for the last moment before it resets, then send the next batch the instant it does, and two rounds’ worth arrive together.',
    patchedBy: 'cache',
    /**
     * The classic fixed-window break, and the timings are load-bearing.
     *
     * The opening 2000ms of silence is not padding: the limiter's window opens
     * on the first request after the previous one lapsed, so a full window of
     * quiet is what guarantees the probe at 2000 plants a boundary at a known
     * time. Without it the burst lands at an unknown phase and simply gets 429s.
     *
     * Probe opens the window (2000-4000). Two more at 3900 spend the rest of
     * that window's budget; three at 4000 spend the next window's the instant it
     * opens. Five requests are then in flight against a capacity of 4.
     */
    attack: {
      wait: 'waiting for the limit to reset',
      volleys: [
        { at: 2000, count: 1 },
        { at: 3900, count: 2 },
        { at: 4000, count: 3 },
      ],
    },
  },
  {
    id: 'BUG-03',
    title: 'it can only reuse an exact repeat',
    term: 'cache miss',
    hint: 'Answers are only reused when you ask for the very same thing twice. Ask for something slightly different every time and there is nothing to reuse, so every request goes straight through.',
    patchedBy: 'queue',
    /**
     * Defences stack, so attacks have to as well. The rate limiter is still in
     * front, so this keeps the boundary timing that beats it and adds a
     * different path per request so the cache can never answer any of them.
     * Same six requests as BUG-02; every one of them now reaches the origin.
     */
    attack: {
      wait: 'waiting for the limit to reset',
      unique: true,
      volleys: [
        { at: 2000, count: 1 },
        { at: 3900, count: 2 },
        { at: 4000, count: 3 },
      ],
    },
  },
  {
    id: 'BUG-04',
    title: 'nothing ever tells anyone to slow down',
    term: 'no backpressure',
    hint: 'The limit counts each caller separately, so arriving as eight callers at once multiplies it without any of them going over. They all wait in line politely, the line has a size, and nothing turns anyone away before it is full.',
    patchedBy: 'breaker',
    /**
     * The point of this one is that every caller obeys its limit exactly.
     * Eight identities x three requests is precisely the per-client allowance,
     * so not a single request is rate limited — and the queue still overflows,
     * because a per-client limit says nothing about the total. That is the
     * argument for global backpressure, made by demonstration.
     */
    attack: {
      unique: true,
      identities: 8,
      volleys: [
        { at: 0, count: 8 },
        { at: 300, count: 8 },
        { at: 600, count: 8 },
      ],
    },
  },
];

/** What a cache hit costs. Not zero — a lookup is still work, just cheap. */
export const CACHE_HIT_MS = 12;

/** Total requests an attack will send, for the progress read-out. */
export function attackSize(attack: Attack): number {
  return attack.volleys.reduce((n, v) => n + v.count, 0);
}

/** When the last volley goes out, in ms from the start of the run. */
export function attackEnd(attack: Attack): number {
  return attack.volleys[attack.volleys.length - 1]?.at ?? 0;
}

export interface ResponseRecord {
  readonly id: number;
  readonly status: number;
  readonly outcome: Outcome;
  /** Total time the caller waited: time in the line plus time being served. */
  readonly latencyMs: number;
  /** How much of that was spent waiting. Zero unless it was queued. */
  readonly waitedMs: number;
}

export type Health = 'healthy' | 'strained' | 'crashed' | 'recovering';

export interface Snapshot {
  readonly inflight: number;
  readonly capacity: number;
  readonly load: number;
  readonly health: Health;
  readonly latencyMs: number;
  readonly sent: number;
  readonly served: number;
  readonly failed: number;
  readonly limited: number;
  /** Answered from cache. A subset of `served` — these are 200s too. */
  readonly cached: number;
  /** How many are waiting in line right now. */
  readonly waiting: number;
  /** Turned away early by the breaker rather than by the rate limiter. */
  readonly shed: number;
  /** Whether the breaker is currently refusing new work. */
  readonly shedding: boolean;
  readonly recent: readonly ResponseRecord[];
  /** Defences currently in the chain, in the order they were applied. */
  readonly applied: readonly Defence[];
  /** The next defence to offer, or null at the capstone. */
  readonly nextFix: Defence | null;
  /** Whether the current stack has been beaten at least once. */
  readonly breached: boolean;
  /**
   * Whether the server has ever gone down, across the whole run. Unlike
   * `breached` this is never cleared by applying a fix — it is what reveals the
   * bug icon, and a revealed icon must not vanish again.
   */
  readonly crashedEver: boolean;
  /**
   * Requests a defence has turned away since the last fix was applied. The
   * signal for "this visitor is attacking and getting nowhere", which is what
   * earns them a nudge towards the bug icon.
   */
  readonly blockedSinceFix: number;
}

export interface ServerOptions {
  readonly baseLatencyMs: number;
  readonly capacity: number;
  readonly recoveryMs: number;
  readonly logSize: number;
  /** Fixed-window limiter settings, used once `ratelimit` is applied. */
  readonly rateLimit: { readonly windowMs: number; readonly max: number };
  /** Response cache settings, used once `cache` is applied. */
  readonly cache: { readonly ttlMs: number; readonly maxEntries: number };
  /** Waiting-line settings, used once `queue` is applied. */
  readonly queue: { readonly maxDepth: number };
  /**
   * Load shedding, used once `breaker` is applied. Two marks rather than one so
   * the thing has hysteresis: a single threshold would flap open and shut on
   * every request while the line hovered at the line.
   */
  readonly breaker: { readonly tripAt: number; readonly resetAt: number };
}

/**
 * Tuned by measuring time-to-crash across sustained click rates, not by feel.
 * ~3 clicks/second is survivable indefinitely, 4/s falls over in about 1.5s.
 * Casual poking is safe; deliberate mashing is not — the difference between
 * "it's broken" and "I broke it".
 */
export const DEFAULTS: ServerOptions = {
  baseLatencyMs: 700,
  capacity: 4,
  recoveryMs: 3200,
  logSize: 8,
  /**
   * `max` must sit BELOW `capacity`, or the limiter is theatre: at max 5 with
   * capacity 4, a client obeying the limit perfectly could still put 5 requests
   * in flight and kill the server, so applying the fix changed nothing.
   *
   * At 3 per 2s window, a full window's allowance peaks at 3 in flight and has
   * retired (~1225ms) well before the next window opens — so sustained mashing
   * is now genuinely survivable. Beating it requires saving the budget for the
   * end of one window and spending the next window's immediately, which is
   * deliberate timing rather than something a masher stumbles into.
   */
  rateLimit: { windowMs: 2000, max: 3 },
  /**
   * `ttlMs` must comfortably outlast the burst the cache is meant to absorb.
   * The boundary attack it answers runs for ~4s, so an entry expiring inside
   * that window would let the same-path burst through and the fix would be
   * theatre — the same failure as a rate limit set above capacity.
   *
   * `maxEntries` is what makes the next stage honest: a real cache is bounded,
   * so a flood of unique paths evicts its way through rather than growing
   * without limit.
   */
  cache: { ttlMs: 10_000, maxEntries: 32 },
  /**
   * The line has a size, and stage 4's flaw is that nothing turns anyone away
   * before it is full — overflowing it is fatal because there is no policy for
   * "full" yet. Adding that policy is exactly what the breaker does, which is
   * why backpressure is the fix this defect earns rather than a bigger queue.
   *
   * 12 is deep enough that the single-client attacks from earlier stages fit
   * inside it comfortably (stage 3's burst peaks at one waiting), and shallow
   * enough that a genuine flood overflows it in about a second.
   */
  queue: { maxDepth: 12 },
  /**
   * `tripAt` must sit below `queue.maxDepth`, or the breaker opens only after
   * the overflow it exists to prevent has already happened — the same
   * off-by-a-threshold mistake as a rate limit set above capacity. 8 against a
   * depth of 12 leaves four slots of headroom for requests already in flight
   * when it trips.
   */
  breaker: { tripAt: 8, resetAt: 3 },
};

/**
 * The naive fixed-window limiter, flaw and all: the counter resets on a clock
 * boundary, so a client that saves its budget until the end of one window and
 * spends the next window's immediately can push 2x `max` through in a moment.
 * That is the documented weakness of this algorithm and the opening for the
 * next stage — a sliding window or token bucket would not have it.
 */
class FixedWindowLimiter {
  // Plain fields rather than TypeScript parameter properties: Node's strip-only
  // type removal cannot compile those, and this engine is deliberately runnable
  // under bare `node` so it can be tested without a browser.
  readonly #windowMs: number;
  readonly #max: number;
  /**
   * Counted per caller, the way a real limiter keyed by IP or API key is. That
   * is a second, entirely separate weakness from the boundary reset: a limit
   * enforced per client says nothing whatsoever about the total load, so
   * arriving as many clients multiplies the allowance while every one of them
   * stays perfectly compliant.
   */
  #windows = new Map<string, { start: number; count: number }>();

  constructor(windowMs: number, max: number) {
    this.#windowMs = windowMs;
    this.#max = max;
  }

  allow(now: number, identity: string): boolean {
    const window = this.#windows.get(identity);
    if (window === undefined || now - window.start >= this.#windowMs) {
      this.#windows.set(identity, { start: now, count: 1 });
      return true;
    }
    if (window.count >= this.#max) return false;
    window.count += 1;
    return true;
  }

  reset(): void {
    this.#windows.clear();
  }
}

/**
 * A bounded response cache keyed by path.
 *
 * There is deliberately no request coalescing: while a miss is still in flight,
 * another request for the same path is also a miss. That is how a plain cache
 * behaves, and pretending otherwise would hide a real effect. It costs nothing
 * here because the rate limiter in front caps how many can pile up.
 */
class ResponseCache {
  readonly #ttlMs: number;
  readonly #max: number;
  /** Insertion-ordered, so the first key is the least recently used. */
  #entries = new Map<string, number>();

  constructor(ttlMs: number, max: number) {
    this.#ttlMs = ttlMs;
    this.#max = max;
  }

  has(key: string, now: number): boolean {
    const expiresAt = this.#entries.get(key);
    if (expiresAt === undefined) return false;
    if (now >= expiresAt) {
      this.#entries.delete(key);
      return false;
    }
    // Re-insert to mark it recently used.
    this.#entries.delete(key);
    this.#entries.set(key, expiresAt);
    return true;
  }

  store(key: string, now: number): void {
    this.#entries.delete(key);
    this.#entries.set(key, now + this.#ttlMs);
    while (this.#entries.size > this.#max) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  reset(): void {
    this.#entries.clear();
  }
}

interface Inflight {
  readonly id: number;
  readonly key: string;
  readonly completesAt: number;
  readonly latencyMs: number;
  readonly waitedMs: number;
}

/** A request accepted but not yet started, because every worker was busy. */
interface Waiting {
  readonly id: number;
  readonly key: string;
  readonly enqueuedAt: number;
}

export class ApiServer {
  readonly #options: ServerOptions;
  readonly #limiter: FixedWindowLimiter;
  readonly #cache: ResponseCache;
  #applied: Defence[] = [];
  #inflight: Inflight[] = [];
  #waiting: Waiting[] = [];
  #recent: ResponseRecord[] = [];
  #nextId = 1;
  #sent = 0;
  #served = 0;
  #failed = 0;
  #limited = 0;
  #cached = 0;
  #shed = 0;
  #open = false;
  #downUntil = 0;
  #breached = false;
  #crashedEver = false;
  #blockedSinceFix = 0;

  constructor(options: Partial<ServerOptions> = {}) {
    this.#options = { ...DEFAULTS, ...options };
    this.#limiter = new FixedWindowLimiter(
      this.#options.rateLimit.windowMs,
      this.#options.rateLimit.max,
    );
    this.#cache = new ResponseCache(this.#options.cache.ttlMs, this.#options.cache.maxEntries);
  }

  /** Restore a saved run. Unknown values are dropped rather than trusted. */
  restore(applied: readonly string[], breached: boolean, crashedEver = breached): void {
    this.#applied = DEFENCE_ORDER.filter((d) => applied.includes(d));
    this.#breached = breached;
    // Older saves predate the flag; having beaten a stack implies a crash, so
    // `breached` is a safe fallback rather than re-hiding an icon already found.
    this.#crashedEver = crashedEver || breached;
  }

  apply(defence: Defence): void {
    if (this.#applied.includes(defence)) return;
    this.#applied.push(defence);
    // A fresh defence deserves a fresh attempt at breaking it.
    this.#breached = false;
    this.#blockedSinceFix = 0;
    this.#open = false;
    this.#limiter.reset();
    this.#cache.reset();
  }

  reset(): void {
    this.#applied = [];
    this.#inflight = [];
    this.#waiting = [];
    this.#recent = [];
    this.#sent = 0;
    this.#served = 0;
    this.#failed = 0;
    this.#limited = 0;
    this.#downUntil = 0;
    this.#breached = false;
    this.#crashedEver = false;
    this.#blockedSinceFix = 0;
    this.#cached = 0;
    this.#shed = 0;
    this.#open = false;
    this.#nextId = 1;
    this.#limiter.reset();
    this.#cache.reset();
  }

  #has(defence: Defence): boolean {
    return this.#applied.includes(defence);
  }

  /**
   * Down-ness is derived from the clock, not from a flag something has to
   * clear. Recovery used to depend on `tick()` running, which made it hostage
   * to requestAnimationFrame — and browsers throttle rAF in background tabs.
   */
  #isDown(now: number): boolean {
    return this.#downUntil > 0 && now < this.#downUntil;
  }

  /**
   * Opens when the line gets deep, closes once it has drained well back down.
   * Two marks, not one: with a single threshold the breaker would flip on every
   * other request while the depth sat on the boundary, which is worse than
   * either state.
   */
  #updateBreaker(): void {
    if (!this.#has('breaker')) return;
    const depth = this.#waiting.length;
    const { tripAt, resetAt } = this.#options.breaker;
    if (this.#open) {
      if (depth <= resetAt) this.#open = false;
    } else if (depth >= tripAt) {
      this.#open = true;
    }
  }

  /** Moves one request onto a worker, carrying any time it spent waiting. */
  #start(id: number, key: string, now: number, waitedMs: number): void {
    const serviceMs = this.#latencyAt(this.#inflight.length);
    this.#inflight.push({
      id,
      key,
      completesAt: now + serviceMs,
      latencyMs: waitedMs + serviceMs,
      waitedMs,
    });
  }

  /** Latency rises with concurrency. This is what makes the collapse a spiral. */
  #latencyAt(inflight: number): number {
    const { baseLatencyMs, capacity } = this.#options;
    return Math.round(baseLatencyMs * (1 + inflight / capacity));
  }

  #record(record: ResponseRecord): void {
    this.#recent = [record, ...this.#recent].slice(0, this.#options.logSize);
  }

  #crash(now: number): void {
    this.#downUntil = now + this.#options.recoveryMs;
    this.#breached = true;
    this.#crashedEver = true;
    // They got through. Nothing left to nudge them towards.
    this.#blockedSinceFix = 0;
    for (const request of this.#inflight) {
      this.#failed += 1;
      this.#record({
        id: request.id,
        status: 503,
        outcome: 'failed',
        latencyMs: request.latencyMs,
        waitedMs: request.waitedMs,
      });
    }
    // Anyone still in the line goes down with it. A queue does not protect the
    // work inside it when the thing it feeds dies.
    for (const request of this.#waiting) {
      this.#failed += 1;
      this.#record({
        id: request.id,
        status: 503,
        outcome: 'failed',
        latencyMs: now - request.enqueuedAt,
        waitedMs: now - request.enqueuedAt,
      });
    }
    this.#inflight = [];
    this.#waiting = [];
  }

  tick(now: number): void {
    if (this.#downUntil > 0 && !this.#isDown(now)) this.#downUntil = 0;
    if (this.#isDown(now)) return;

    const done = this.#inflight.filter((r) => now >= r.completesAt);
    if (done.length === 0) return;

    this.#inflight = this.#inflight.filter((r) => now < r.completesAt);
    for (const request of done) {
      this.#served += 1;
      // A response is only cacheable once it exists, so entries are written on
      // completion rather than on arrival.
      if (this.#has('cache')) this.#cache.store(request.key, now);
      this.#record({
        id: request.id,
        status: 200,
        outcome: 'served',
        latencyMs: request.latencyMs,
        waitedMs: request.waitedMs,
      });
    }

    // A freed worker pulls the next request off the line. This is the drain
    // rate, and it is what the flood has to outrun.
    while (this.#waiting.length > 0 && this.#inflight.length < this.#options.capacity) {
      const next = this.#waiting.shift();
      if (next === undefined) break;
      this.#start(next.id, next.key, now, now - next.enqueuedAt);
    }

    this.#updateBreaker();
  }

  send(now: number, key: string = ORIGIN_PATH, identity: string = SELF_IDENTITY): Outcome {
    this.#sent += 1;

    if (this.#isDown(now)) {
      this.#failed += 1;
      this.#record({
        id: this.#nextId++,
        status: 503,
        outcome: 'failed',
        latencyMs: 0,
        waitedMs: 0,
      });
      return 'failed';
    }

    // The limiter sits in front of the server, so a rejected request costs the
    // server nothing — which is the entire point of having one.
    if (this.#has('ratelimit') && !this.#limiter.allow(now, identity)) {
      this.#limited += 1;
      this.#blockedSinceFix += 1;
      this.#record({
        id: this.#nextId++,
        status: 429,
        outcome: 'limited',
        latencyMs: 0,
        waitedMs: 0,
      });
      return 'limited';
    }

    // Sits behind the limiter, matching the order the chain displays. A hit is
    // answered from memory and never occupies the origin — which is exactly why
    // it defeats a burst that asks for the same thing over and over.
    if (this.#has('cache') && this.#cache.has(key, now)) {
      this.#served += 1;
      this.#cached += 1;
      this.#record({
        id: this.#nextId++,
        status: 200,
        outcome: 'cached',
        latencyMs: CACHE_HIT_MS,
        waitedMs: 0,
      });
      return 'cached';
    }

    // Refuse new work while the line is deep, immediately and cheaply. Note
    // where this sits: *after* the cache, so anything already known still gets
    // answered. Degrading gracefully means serving what you can and declining
    // the rest — not going dark.
    this.#updateBreaker();
    if (this.#open) {
      this.#shed += 1;
      this.#blockedSinceFix += 1;
      this.#record({
        id: this.#nextId++,
        status: 429,
        outcome: 'shed',
        latencyMs: 0,
        waitedMs: 0,
      });
      return 'shed';
    }

    const id = this.#nextId++;

    if (this.#has('queue')) {
      // With a line, concurrency can no longer be exceeded — overload stops
      // being "too many at once" and becomes "too many waiting". The failure
      // moves rather than disappearing, which is the point of the stage.
      if (this.#inflight.length < this.#options.capacity) {
        this.#start(id, key, now, 0);
        return 'served';
      }
      this.#waiting.push({ id, key, enqueuedAt: now });
      if (this.#waiting.length > this.#options.queue.maxDepth) {
        this.#crash(now);
        return 'failed';
      }
      return 'queued';
    }

    this.#start(id, key, now, 0);
    if (this.#inflight.length > this.#options.capacity) {
      this.#crash(now);
      return 'failed';
    }
    return 'served';
  }

  snapshot(now: number): Snapshot {
    const inflight = this.#inflight.length;
    const { capacity } = this.#options;
    const crashed = this.#isDown(now);
    const load = crashed ? 1 : inflight / capacity;

    let health: Health = 'healthy';
    if (crashed) health = now >= this.#downUntil - 600 ? 'recovering' : 'crashed';
    else if (load >= 0.6) health = 'strained';

    return {
      inflight,
      capacity,
      load,
      health,
      latencyMs: this.#latencyAt(inflight),
      sent: this.#sent,
      served: this.#served,
      failed: this.#failed,
      limited: this.#limited,
      cached: this.#cached,
      waiting: this.#waiting.length,
      shed: this.#shed,
      shedding: this.#open,
      recent: this.#recent,
      applied: this.#applied,
      nextFix: DEFENCE_ORDER[this.#applied.length] ?? null,
      breached: this.#breached,
      crashedEver: this.#crashedEver,
      blockedSinceFix: this.#blockedSinceFix,
    };
  }
}
