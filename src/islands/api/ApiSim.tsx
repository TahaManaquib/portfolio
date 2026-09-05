/**
 * The API Simulation UI — a thin read-out over `engine.ts`, which owns all the
 * mechanics. This component owns the animation frame loop and persistence, and
 * nothing else.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  ApiServer,
  DEFENCE_BLURB,
  DEFENCE_LABEL,
  DEFENCE_ORDER,
  type Defence,
  type Snapshot,
} from './engine';

const STORAGE_KEY = 'taha:api-progress';

const HEALTH_LABEL: Record<Snapshot['health'], string> = {
  healthy: 'healthy',
  strained: 'degraded',
  crashed: '503 service unavailable',
  recovering: 'restarting',
};

/**
 * Shown once the current stack has been beaten, keyed by how many defences were
 * in place at the time. Terse on purpose — it names what went wrong, it does
 * not explain the fix.
 */
const BREACH_NOTE: readonly string[] = [
  'It fell over. There was nothing in front of it.',
  'The limiter reset mid-burst, and a whole window of budget went through at once.',
  'Every request asked for something different, so the cache never helped.',
  'Work arrived faster than the queue could drain it.',
];

interface Saved {
  readonly applied: string[];
  readonly breached: boolean;
}

/** Storage is untrusted: hand-editable, stale, or from an older shape. */
function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { applied, breached } = parsed as Record<string, unknown>;
    return {
      applied: Array.isArray(applied)
        ? applied.filter((a): a is string => typeof a === 'string')
        : [],
      breached: breached === true,
    };
  } catch {
    return null;
  }
}

function save(snap: Snapshot): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ applied: snap.applied, breached: snap.breached }),
    );
  } catch {
    /* private mode or quota — never break the simulation over it */
  }
}

function createServer(): ApiServer {
  const server = new ApiServer();
  const saved = load();
  if (saved) server.restore(saved.applied, saved.breached);
  return server;
}

export default function ApiSim({ pressedAt = [] }: { pressedAt?: readonly number[] }) {
  const serverRef = useRef<ApiServer | null>(null);
  serverRef.current ??= createServer();
  const server = serverRef.current;

  const [snap, setSnap] = useState<Snapshot>(() => server.snapshot(performance.now()));
  const frameRef = useRef(0);

  /**
   * The loop runs only while something can still change — requests in flight or
   * a crash healing — and stops once the server is idle. A permanently running
   * rAF would re-render sixty times a second to display the same zeroes, which
   * is exactly the idle work this site is not supposed to do.
   */
  const pump = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    const loop = () => {
      const now = performance.now();
      server.tick(now);
      const next = server.snapshot(now);
      setSnap(next);
      const busy = next.inflight > 0 || next.health === 'crashed' || next.health === 'recovering';
      if (busy) frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
  }, [server]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  // Only progress is persisted — the defence chain and whether it has been
  // beaten. Counters are session noise, not a five-stage journey.
  useEffect(() => save(snap), [snap]);

  const send = useCallback(() => {
    const now = performance.now();
    server.send(now);
    setSnap(server.snapshot(now));
    pump();
  }, [server, pump]);

  // Presses made before this island existed still need to count.
  const replayed = useRef(false);
  useEffect(() => {
    if (replayed.current || pressedAt.length === 0) return;
    replayed.current = true;
    for (const t of pressedAt) server.send(t);
    const now = performance.now();
    server.tick(now);
    setSnap(server.snapshot(now));
    pump();
  }, [pressedAt, server, pump]);

  const applyFix = useCallback(
    (defence: Defence) => {
      server.apply(defence);
      setSnap(server.snapshot(performance.now()));
    },
    [server],
  );

  const resetAll = useCallback(() => {
    server.reset();
    setSnap(server.snapshot(performance.now()));
  }, [server]);

  const down = snap.health === 'crashed' || snap.health === 'recovering';
  const pct = Math.min(100, Math.round(snap.load * 100));
  const nextFix = snap.nextFix;
  const complete = snap.applied.length === DEFENCE_ORDER.length;

  return (
    <div class="api">
      {/* The chain is the progress indicator: it starts empty and grows, so the
          capstone is something the visitor can see they built. */}
      {snap.applied.length > 0 && (
        <div class="api-chain">
          <ol>
            {snap.applied.map((d) => (
              <li key={d}>{DEFENCE_LABEL[d]}</li>
            ))}
          </ol>
          <button type="button" class="api-reset" onClick={resetAll}>
            reset
          </button>
        </div>
      )}

      <div class="api-row">
        <button type="button" class="api-fetch" onClick={send} disabled={down}>
          <span class="api-verb">GET</span>
          <span class="api-path">/taha</span>
        </button>

        <p class="api-status" role="status" aria-live="polite">
          <span class={`api-dot is-${snap.health}`} aria-hidden="true" />
          {HEALTH_LABEL[snap.health]}
        </p>
      </div>

      <div class="api-gauge">
        <div class="api-gauge-track">
          <div class={`api-gauge-fill is-${snap.health}`} style={{ width: `${pct}%` }} />
        </div>
        <p class="api-gauge-meta">
          <span>
            {snap.inflight} / {snap.capacity} in flight
          </span>
          <span>{snap.latencyMs} ms</span>
        </p>
      </div>

      <dl class="api-totals">
        <div>
          <dt>sent</dt>
          <dd>{snap.sent}</dd>
        </div>
        <div>
          <dt>200</dt>
          <dd>{snap.served}</dd>
        </div>
        {snap.applied.includes('ratelimit') && (
          <div>
            <dt>429</dt>
            <dd>{snap.limited}</dd>
          </div>
        )}
        <div>
          <dt>503</dt>
          <dd>{snap.failed}</dd>
        </div>
      </dl>

      {snap.recent.length > 0 && (
        <ul class="api-log">
          {snap.recent.map((r) => (
            <li key={r.id} class={r.outcome === 'served' ? undefined : 'is-failed'}>
              <span class="api-log-id">#{String(r.id).padStart(3, '0')}</span>
              <span class="api-log-status">{r.status}</span>
              <span class="api-log-latency">{r.latencyMs ? `${r.latencyMs} ms` : '—'}</span>
            </li>
          ))}
        </ul>
      )}

      {/* The fix arrives at the point of failure — no panel, no discovery. */}
      {snap.breached && nextFix !== null && (
        <div class="api-fixbox">
          <p class="api-note">{BREACH_NOTE[snap.applied.length] ?? 'The stack was beaten.'}</p>
          <p class="api-offer">
            <button type="button" class="api-apply" onClick={() => applyFix(nextFix)}>
              + {DEFENCE_LABEL[nextFix]}
            </button>
            <span class="api-apply-blurb">{DEFENCE_BLURB[nextFix]}</span>
          </p>
        </div>
      )}

      {complete && <p class="api-note">You built a production-grade API.</p>}
    </div>
  );
}
