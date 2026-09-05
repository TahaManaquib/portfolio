/**
 * The API Simulation UI — a thin read-out over `engine.ts`, which owns all the
 * mechanics. This component owns the animation frame loop and persistence, and
 * nothing else.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import BugReport, { BugIcon, type AttackRun } from './BugReport';
import {
  ApiServer,
  DEFECTS,
  DEFENCE_BLURB,
  DEFENCE_LABEL,
  DEFENCE_ORDER,
  ORIGIN_PATH,
  SELF_IDENTITY,
  attackEnd,
  attackSize,
  type Defence,
  type Snapshot,
} from './engine';

const STORAGE_KEY = 'taha:api-progress';

/**
 * How many blocked requests earn a nudge towards the bug icon.
 *
 * From stage 2 the icon is the only route forward, so someone who never spots
 * it hits a dead end: an endpoint they cannot break and no sign that anything
 * else exists. Rather than making it permanently more obvious — which would
 * spoil it for everyone who does find it — it simply gets easier to see for
 * someone visibly trying and failing. Two steps: a lift, then a stronger one.
 */
const NUDGE_AT = [10, 24] as const;

/**
 * The status codes stay, as a dim suffix — this is a backend portfolio and 503
 * is worth recognising — but the plain word leads, so nobody has to know what a
 * 503 is to see that the thing just fell over.
 */
const HEALTH_LABEL: Record<Snapshot['health'], string> = {
  healthy: 'healthy',
  strained: 'struggling',
  crashed: 'down',
  recovering: 'restarting',
};

const HEALTH_CODE: Partial<Record<Snapshot['health'], string>> = { crashed: '503' };

/**
 * Shown once the current stack has been beaten, keyed by how many defences were
 * in place at the time. Terse on purpose — it names what went wrong, it does
 * not explain the fix.
 */
const BREACH_NOTE: readonly string[] = [
  'It fell over. Nothing was stopping you.',
  'The limit cleared halfway through the burst, so two rounds’ worth arrived at once.',
  'Every request asked for something different, so there was never an answer to reuse.',
  'Every caller stayed inside its limit. The limit counts each caller separately, and nothing was counting the total.',
];

interface Saved {
  readonly applied: string[];
  readonly breached: boolean;
  readonly crashedEver: boolean;
  /** Whether the bug icon has been opened. Once found, it stays found. */
  readonly bugSeen: boolean;
}

/** Storage is untrusted: hand-editable, stale, or from an older shape. */
function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { applied, breached, crashedEver, bugSeen } = parsed as Record<string, unknown>;
    return {
      applied: Array.isArray(applied)
        ? applied.filter((a): a is string => typeof a === 'string')
        : [],
      breached: breached === true,
      crashedEver: crashedEver === true || breached === true,
      bugSeen: bugSeen === true,
    };
  } catch {
    return null;
  }
}

function save(snap: Snapshot, bugSeen: boolean): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        applied: snap.applied,
        breached: snap.breached,
        crashedEver: snap.crashedEver,
        bugSeen,
      }),
    );
  } catch {
    /* private mode or quota — never break the simulation over it */
  }
}

function createServer(): ApiServer {
  const server = new ApiServer();
  const saved = load();
  if (saved) server.restore(saved.applied, saved.breached, saved.crashedEver);
  return server;
}

export default function ApiSim({ pressedAt = [] }: { pressedAt?: readonly number[] }) {
  const serverRef = useRef<ApiServer | null>(null);
  serverRef.current ??= createServer();
  const server = serverRef.current;

  const [snap, setSnap] = useState<Snapshot>(() => server.snapshot(performance.now()));
  const [bugSeen, setBugSeen] = useState(() => load()?.bugSeen === true);
  const [bugOpen, setBugOpen] = useState(false);
  const [run, setRun] = useState<AttackRun | null>(null);
  /** Outcome of the last run, tied to the defect it belongs under. */
  const [runNote, setRunNote] = useState<{ index: number; text: string } | null>(null);
  const frameRef = useRef(0);
  const timers = useRef<number[]>([]);

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
  useEffect(() => save(snap, bugSeen), [snap, bugSeen]);

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

  const stopRun = useCallback(() => {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
    setRun(null);
  }, []);

  useEffect(() => stopRun, [stopRun]);

  /**
   * Runs a defect's exploit: each volley fires on its own timer, and every
   * request inside a volley shares one timestamp, so what reaches the limiter
   * is "these went out together" rather than whatever spacing the scheduler
   * happened to produce.
   */
  const runAttack = useCallback(
    (index: number) => {
      const attack = DEFECTS[index]?.attack;
      if (!attack) return;
      stopRun();

      const total = attackSize(attack);
      let fired = 0;
      let sequence = 0;
      setRunNote(null);
      setRun({ index, fired: 0, total, waiting: (attack.volleys[0]?.at ?? 0) > 0 });

      for (const volley of attack.volleys) {
        timers.current.push(
          window.setTimeout(() => {
            const now = performance.now();
            server.tick(now);

            // Already down: the attack has landed, so stop here rather than pad
            // the log with 503s for requests nobody needed to send.
            const health = server.snapshot(now).health;
            if (health === 'crashed' || health === 'recovering') {
              stopRun();
              return;
            }

            for (let i = 0; i < volley.count; i++) {
              sequence += 1;
              // A cache-busting run asks for something different every time, so
              // nothing it sends can ever be answered from memory. A
              // multi-identity run spreads itself over several callers, so the
              // per-client limiter counts each of them separately.
              server.send(
                now,
                attack.unique ? `${ORIGIN_PATH}?v=${sequence}` : ORIGIN_PATH,
                attack.identities
                  ? `client-${((sequence - 1) % attack.identities) + 1}`
                  : SELF_IDENTITY,
              );
            }
            fired += volley.count;
            setRun((r) => (r === null ? r : { ...r, fired, waiting: false }));
            setSnap(server.snapshot(now));
            pump();
          }, volley.at),
        );
      }

      /**
       * A run that ends without the server going down has to say so.
       *
       * The volleys are placed by `setTimeout`, and a browser throttles timers
       * in a background tab — so a visitor who switches away mid-run comes back
       * to bursts that collapsed into a single window and were simply rate
       * limited. Without this the read-out just reverts to "6 requests" and the
       * attack looks like it does nothing, which puts them back at the dead end
       * the toolkit exists to remove.
       */
      timers.current.push(
        window.setTimeout(
          () => {
            const snapshot = server.snapshot(performance.now());
            const beaten = snapshot.health === 'crashed' || snapshot.health === 'recovering';
            if (!beaten) {
              // Against a defence that is already in place, not landing is the
              // entire point — say so rather than blaming the timing.
              const patched = index < snapshot.applied.length;
              setRunNote({
                index,
                text: patched
                  ? 'held — the stack absorbed it'
                  : 'the timing slipped — run it again',
              });
            }
            stopRun();
          },
          attackEnd(attack) + 400,
        ),
      );
    },
    [server, pump, stopRun],
  );

  const resetAll = useCallback(() => {
    stopRun();
    server.reset();
    setBugSeen(false);
    setBugOpen(false);
    setSnap(server.snapshot(performance.now()));
  }, [server, stopRun]);

  const toggleBug = useCallback(() => {
    setBugSeen(true);
    setBugOpen((open) => !open);
  }, []);

  const down = snap.health === 'crashed' || snap.health === 'recovering';
  const pct = Math.min(100, Math.round(snap.load * 100));
  const nextFix = snap.nextFix;
  const complete = snap.applied.length === DEFENCE_ORDER.length;

  // Resting state is deliberately faint. It brightens only for someone who has
  // been turned away enough times to have clearly earned the hint, and settles
  // once they have opened it.
  const nudge = NUDGE_AT.filter((n) => snap.blockedSinceFix >= n).length;
  const bugState = bugSeen ? 'is-found' : nudge > 0 ? `is-nudged-${nudge}` : '';

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
        <div class="api-launch">
          {/* Locked out during a run: the boundary exploit depends on a full
              window of silence before its probe, and a stray manual click in
              that gap would reset the window and quietly break the attack. */}
          <button type="button" class="api-fetch" onClick={send} disabled={down || run !== null}>
            <span class="api-verb">GET</span>
            <span class="api-path">/taha</span>
          </button>

          {/* Hidden until the endpoint has actually gone down once. Faint, but a
              real control: keyboard-reachable, named, and full strength on
              hover or focus — quiet to look at is not the same as inaccessible. */}
          {snap.crashedEver && (
            <button
              type="button"
              class={bugState ? `api-bug ${bugState}` : 'api-bug'}
              aria-expanded={bugOpen}
              aria-controls="api-bugs"
              aria-label="Known issues"
              onClick={toggleBug}
            >
              <BugIcon />
            </button>
          )}
        </div>

        <p class="api-status" role="status" aria-live="polite">
          <span class={`api-dot is-${snap.health}`} aria-hidden="true" />
          {HEALTH_LABEL[snap.health]}
          {HEALTH_CODE[snap.health] && <span class="api-code">{HEALTH_CODE[snap.health]}</span>}
        </p>
      </div>

      {/* Rendered whenever the icon is, hidden rather than removed, so the
          button's `aria-controls` always points at something real. */}
      {snap.crashedEver && (
        <div id="api-bugs" hidden={!bugOpen}>
          <BugReport
            snap={snap}
            run={run}
            note={runNote}
            busy={down || run !== null}
            onRun={runAttack}
          />
        </div>
      )}

      <div class="api-gauge">
        <div class="api-gauge-track">
          <div class={`api-gauge-fill is-${snap.health}`} style={{ width: `${pct}%` }} />
        </div>
        <p class="api-gauge-meta">
          <span>
            handling {snap.inflight} of {snap.capacity}
            {snap.applied.includes('queue') && `, ${snap.waiting} waiting`}
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
          <dt>
            answered <span class="api-code">200</span>
          </dt>
          <dd>{snap.served}</dd>
        </div>
        {snap.applied.includes('ratelimit') && (
          <div>
            <dt>
              turned away <span class="api-code">429</span>
            </dt>
            <dd>{snap.limited}</dd>
          </div>
        )}
        {/* Each defence earns its own number the moment it is applied, so the
            thing the visitor just built becomes visible rather than implied. */}
        {snap.applied.includes('cache') && (
          <div>
            <dt>reused</dt>
            <dd>{snap.cached}</dd>
          </div>
        )}
        {/* Both are 429s, for different reasons: "turned away" is you asking
            too often, "too busy" is the system protecting itself. */}
        {snap.applied.includes('breaker') && (
          <div>
            <dt>
              too busy <span class="api-code">429</span>
            </dt>
            <dd>{snap.shed}</dd>
          </div>
        )}
        <div>
          <dt>
            failed <span class="api-code">503</span>
          </dt>
          <dd>{snap.failed}</dd>
        </div>
      </dl>

      {snap.recent.length > 0 && (
        <ul class="api-log">
          {snap.recent.map((r) => (
            <li
              key={r.id}
              class={r.outcome === 'served' || r.outcome === 'cached' ? undefined : 'is-failed'}
            >
              <span class="api-log-id">#{String(r.id).padStart(3, '0')}</span>
              <span class="api-log-status">{r.status}</span>
              <span class="api-log-latency">{r.latencyMs ? `${r.latencyMs} ms` : '—'}</span>
              {r.outcome === 'cached' && <span class="api-log-tag">reused</span>}
              {r.waitedMs > 0 && <span class="api-log-tag is-wait">waited {r.waitedMs} ms</span>}
              {r.outcome === 'shed' && <span class="api-log-tag is-wait">too busy</span>}
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

      {complete && (
        <p class="api-note">
          You built a production-grade API. Under load it now turns people away in good order and
          still answers anything it already knows, instead of falling over. Every attack is still in
          the report — run one and watch it bounce.
        </p>
      )}
    </div>
  );
}
