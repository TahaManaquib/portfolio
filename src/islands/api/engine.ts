/**
 * A simulated API server.
 *
 * The load is fake; the mechanics are not. This is a real concurrency model —
 * requests occupy the server for a service time, that service time degrades as
 * concurrency rises, and the server falls over when it runs out of headroom.
 * Later stages add a real token-bucket limiter, an LRU cache, a bounded queue
 * with backpressure, and a circuit breaker, rather than counters pretending to
 * be those things.
 *
 * No DOM in here on purpose: the engine is a plain state machine the UI polls,
 * which keeps it readable on its own and testable without a browser.
 */

/** What happened to a single request. Later stages add more outcomes. */
export type Outcome = 'served' | 'failed';

export interface ResponseRecord {
  readonly id: number;
  readonly status: number;
  readonly outcome: Outcome;
  /** Milliseconds the request took, or would have taken. */
  readonly latencyMs: number;
}

export type Health = 'healthy' | 'strained' | 'crashed' | 'recovering';

export interface Snapshot {
  readonly inflight: number;
  readonly capacity: number;
  /** 0–1+, can exceed 1 in the moment before a crash. */
  readonly load: number;
  readonly health: Health;
  /** What a request issued right now would cost. */
  readonly latencyMs: number;
  readonly sent: number;
  readonly served: number;
  readonly failed: number;
  readonly recent: readonly ResponseRecord[];
}

export interface ServerOptions {
  /** Service time with an idle server. */
  readonly baseLatencyMs: number;
  /** Concurrent requests the server can hold before it falls over. */
  readonly capacity: number;
  /** How long a crashed server takes to come back. */
  readonly recoveryMs: number;
  /** How many recent responses to keep for display. */
  readonly logSize: number;
}

/**
 * Tuned by measuring time-to-crash across sustained click rates, not by feel.
 * At these numbers: ~3 clicks/second is survivable indefinitely, 4/s falls over
 * in about 1.5s, 5/s in about 1s. Casual poking is safe; deliberate mashing is
 * not — which is the difference between "it's broken" and "I broke it".
 *
 * The previous values (capacity 8, 240ms) survived 15 clicks/second, so only a
 * script could ever trigger the crash.
 */
export const DEFAULTS: ServerOptions = {
  baseLatencyMs: 700,
  capacity: 4,
  recoveryMs: 3200,
  logSize: 8,
};

interface Inflight {
  readonly id: number;
  readonly completesAt: number;
  readonly latencyMs: number;
}

export class ApiServer {
  readonly #options: ServerOptions;
  #inflight: Inflight[] = [];
  #recent: ResponseRecord[] = [];
  #nextId = 1;
  #sent = 0;
  #served = 0;
  #failed = 0;
  /** Timestamp the server recovers at; 0 when it is up. */
  #downUntil = 0;

  constructor(options: Partial<ServerOptions> = {}) {
    this.#options = { ...DEFAULTS, ...options };
  }

  /**
   * Latency rises with concurrency. This is the whole reason the server can
   * die: each request makes the next one slower, so requests leave more slowly
   * than they arrive, and the queue of in-flight work feeds on itself. Real
   * systems fail exactly this way — not by politely stopping at a limit.
   */
  #latencyAt(inflight: number): number {
    const { baseLatencyMs, capacity } = this.#options;
    return Math.round(baseLatencyMs * (1 + inflight / capacity));
  }

  /**
   * Whether the server is down *at this instant*, derived from the clock rather
   * than from a flag someone remembered to clear. Recovery previously depended
   * on `tick()` running, which made it hostage to requestAnimationFrame — and
   * browsers throttle rAF in background tabs, so a crashed server could stay
   * crashed indefinitely with no frames to heal it. Deriving it from `now`
   * means any single call reports the truth, whenever it happens.
   */
  #isDown(now: number): boolean {
    return this.#downUntil > 0 && now < this.#downUntil;
  }

  #record(record: ResponseRecord): void {
    this.#recent = [record, ...this.#recent].slice(0, this.#options.logSize);
  }

  #crash(now: number): void {
    this.#downUntil = now + this.#options.recoveryMs;
    // Everything in flight dies with the process.
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

  /** Advance the simulation: retire completed work, come back from a crash. */
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

  /** Issue one request. Returns what happened to it right now. */
  send(now: number): Outcome {
    this.#sent += 1;

    if (this.#isDown(now)) {
      this.#failed += 1;
      this.#record({ id: this.#nextId++, status: 503, outcome: 'failed', latencyMs: 0 });
      return 'failed';
    }

    const latencyMs = this.#latencyAt(this.#inflight.length);
    this.#inflight.push({ id: this.#nextId++, completesAt: now + latencyMs, latencyMs });

    // Stage 1 has nothing standing between arrivals and the server, so the only
    // thing that stops unbounded concurrency is the server itself falling over.
    if (this.#inflight.length > this.#options.capacity) {
      this.#crash(now);
      return 'failed';
    }
    return 'served';
  }

  /** Bring a crashed server back immediately. */
  restart(): void {
    this.#downUntil = 0;
    this.#inflight = [];
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
      recent: this.#recent,
    };
  }
}
