/**
 * Stage 1 of the API Simulation: a fetch button, a load gauge, and a server
 * with no protection in front of it.
 *
 * The UI is a thin read-out over `engine.ts` — all the mechanics live there.
 * This component owns the animation frame loop and nothing else.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { ApiServer, type Snapshot } from './engine';

const HEALTH_LABEL: Record<Snapshot['health'], string> = {
  healthy: 'healthy',
  strained: 'degraded',
  crashed: '503 service unavailable',
  recovering: 'restarting',
};

export default function ApiSim({ pressedAt = [] }: { pressedAt?: readonly number[] }) {
  const serverRef = useRef<ApiServer>(new ApiServer());
  const [snap, setSnap] = useState<Snapshot>(() => serverRef.current.snapshot(performance.now()));
  /** Set once, so the crash copy can appear without re-triggering on recovery. */
  const [hasCrashed, setHasCrashed] = useState(false);

  const frameRef = useRef(0);

  /**
   * The animation loop runs only while something can still change — requests in
   * flight, or a crash healing — and stops itself once the server is idle. A
   * permanently-running rAF would re-render sixty times a second to display the
   * same zeroes, which is exactly the idle work this site is not supposed to do.
   */
  const pump = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    const loop = () => {
      const now = performance.now();
      const server = serverRef.current;
      server.tick(now);
      const next = server.snapshot(now);
      setSnap(next);
      const busy = next.inflight > 0 || next.health === 'crashed' || next.health === 'recovering';
      if (busy) frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const send = useCallback(() => {
    const now = performance.now();
    serverRef.current.send(now);
    const next = serverRef.current.snapshot(now);
    setSnap(next);
    if (next.health === 'crashed') setHasCrashed(true);
    pump();
  }, [pump]);

  // Presses made before this island existed still need to count.
  const replayed = useRef(false);
  useEffect(() => {
    if (replayed.current || pressedAt.length === 0) return;
    replayed.current = true;
    const server = serverRef.current;
    for (const t of pressedAt) server.send(t);
    const now = performance.now();
    server.tick(now);
    const next = server.snapshot(now);
    setSnap(next);
    if (next.health === 'crashed') setHasCrashed(true);
    pump();
  }, [pressedAt, pump]);

  const down = snap.health === 'crashed' || snap.health === 'recovering';
  const pct = Math.min(100, Math.round(snap.load * 100));

  return (
    <div class="api">
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
        <div>
          <dt>503</dt>
          <dd>{snap.failed}</dd>
        </div>
      </dl>

      {snap.recent.length > 0 && (
        <ul class="api-log">
          {snap.recent.map((r) => (
            <li key={r.id} class={r.outcome === 'failed' ? 'is-failed' : undefined}>
              <span class="api-log-id">#{String(r.id).padStart(3, '0')}</span>
              <span class="api-log-status">{r.status}</span>
              <span class="api-log-latency">{r.latencyMs ? `${r.latencyMs} ms` : '—'}</span>
            </li>
          ))}
        </ul>
      )}

      {hasCrashed && <p class="api-note">It fell over. There was nothing in front of it.</p>}
    </div>
  );
}
