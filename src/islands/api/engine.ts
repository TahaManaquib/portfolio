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

export type Outcome = 'served' | 'failed' | 'limited';

/** Defences, in the order they become available. */
export const DEFENCE_ORDER = ['ratelimit', 'cache', 'queue', 'breaker'] as const;
export type Defence = (typeof DEFENCE_ORDER)[number];

export const DEFENCE_LABEL: Record<Defence, string> = {
  ratelimit: 'rate limit',
  cache: 'cache',
  queue: 'queue',
  breaker: 'breaker',
};

/** One line each. Enough to teach the idea, not enough to lecture. */
export const DEFENCE_BLURB: Record<Defence, string> = {
  ratelimit: 'cap requests per window',
  cache: 'serve repeats from memory',
  queue: 'buffer bursts, apply backpressure',
  breaker: 'fail fast, degrade gracefully',
};

export interface ResponseRecord {
  readonly id: number;
  readonly status: number;
  readonly outcome: Outcome;
  readonly latencyMs: number;
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
  readonly recent: readonly ResponseRecord[];
  /** Defences currently in the chain, in the order they were applied. */
  readonly applied: readonly Defence[];
  /** The next defence to offer, or null at the capstone. */
  readonly nextFix: Defence | null;
  /** Whether the current stack has been beaten at least once. */
  readonly breached: boolean;
}

export interface ServerOptions {
  readonly baseLatencyMs: number;
  readonly capacity: number;
  readonly recoveryMs: number;
  readonly logSize: number;
  /** Fixed-window limiter settings, used once `ratelimit` is applied. */
  readonly rateLimit: { readonly windowMs: number; readonly max: number };
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
  #windowStart = 0;
  #count = 0;

  constructor(windowMs: number, max: number) {
    this.#windowMs = windowMs;
    this.#max = max;
  }

  allow(now: number): boolean {
    if (now - this.#windowStart >= this.#windowMs) {
      this.#windowStart = now;
      this.#count = 0;
    }
    if (this.#count >= this.#max) return false;
    this.#count += 1;
    return true;
  }

  reset(): void {
    this.#windowStart = 0;
    this.#count = 0;
  }
}

interface Inflight {
  readonly id: number;
  readonly completesAt: number;
  readonly latencyMs: number;
}

export class ApiServer {
  readonly #options: ServerOptions;
  readonly #limiter: FixedWindowLimiter;
  #applied: Defence[] = [];
  #inflight: Inflight[] = [];
  #recent: ResponseRecord[] = [];
  #nextId = 1;
  #sent = 0;
  #served = 0;
  #failed = 0;
  #limited = 0;
  #downUntil = 0;
  #breached = false;

  constructor(options: Partial<ServerOptions> = {}) {
    this.#options = { ...DEFAULTS, ...options };
    this.#limiter = new FixedWindowLimiter(
      this.#options.rateLimit.windowMs,
      this.#options.rateLimit.max,
    );
  }

  /** Restore a saved run. Unknown values are dropped rather than trusted. */
  restore(applied: readonly string[], breached: boolean): void {
    this.#applied = DEFENCE_ORDER.filter((d) => applied.includes(d));
    this.#breached = breached;
  }

  apply(defence: Defence): void {
    if (this.#applied.includes(defence)) return;
    this.#applied.push(defence);
    // A fresh defence deserves a fresh attempt at breaking it.
    this.#breached = false;
    this.#limiter.reset();
  }

  reset(): void {
    this.#applied = [];
    this.#inflight = [];
    this.#recent = [];
    this.#sent = 0;
    this.#served = 0;
    this.#failed = 0;
    this.#limited = 0;
    this.#downUntil = 0;
    this.#breached = false;
    this.#nextId = 1;
    this.#limiter.reset();
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
    for (const request of this.#inflight) {
      this.#failed += 1;
      this.#record({
        id: request.id,
        status: 503,
        outcome: 'failed',
        latencyMs: request.latencyMs,
      });
    }
    this.#inflight = [];
  }

  tick(now: number): void {
    if (this.#downUntil > 0 && !this.#isDown(now)) this.#downUntil = 0;
    if (this.#isDown(now)) return;

    const done = this.#inflight.filter((r) => now >= r.completesAt);
    if (done.length === 0) return;

    this.#inflight = this.#inflight.filter((r) => now < r.completesAt);
    for (const request of done) {
      this.#served += 1;
      this.#record({
        id: request.id,
        status: 200,
        outcome: 'served',
        latencyMs: request.latencyMs,
      });
    }
  }

  send(now: number): Outcome {
    this.#sent += 1;

    if (this.#isDown(now)) {
      this.#failed += 1;
      this.#record({ id: this.#nextId++, status: 503, outcome: 'failed', latencyMs: 0 });
      return 'failed';
    }

    // The limiter sits in front of the server, so a rejected request costs the
    // server nothing — which is the entire point of having one.
    if (this.#has('ratelimit') && !this.#limiter.allow(now)) {
      this.#limited += 1;
      this.#record({ id: this.#nextId++, status: 429, outcome: 'limited', latencyMs: 0 });
      return 'limited';
    }

    const latencyMs = this.#latencyAt(this.#inflight.length);
    this.#inflight.push({ id: this.#nextId++, completesAt: now + latencyMs, latencyMs });

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
      recent: this.#recent,
      applied: this.#applied,
      nextFix: DEFENCE_ORDER[this.#applied.length] ?? null,
      breached: this.#breached,
    };
  }
}
