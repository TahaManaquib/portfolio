/**
 * The hidden defect report — what the bug icon opens, and the toolkit that arms
 * the visitor with the attacks listed in it.
 *
 * It appears only after the endpoint has gone down at least once, which makes
 * it a reward for having already broken something rather than a hint handed out
 * up front. From stage 2 onward it stops being optional: once a rate limiter is
 * in place, mashing the button cannot get through at any speed, and the only
 * way forward is the timed attack this panel can run.
 *
 * Patched defects stay in the list, struck through and with their exploit
 * removed, so the panel doubles as a changelog of everything the visitor has
 * hardened.
 */
import { DEFECTS, DEFENCE_LABEL, attackSize, type Snapshot } from './engine';

/** Progress of the attack currently running, owned by ApiSim. */
export interface AttackRun {
  /** Index into DEFECTS. */
  readonly index: number;
  readonly fired: number;
  readonly total: number;
  /** True before the first volley — the run is idle on purpose. */
  readonly waiting: boolean;
}

/**
 * Drawn rather than typed: there is no bug glyph in the font stack, and an
 * emoji would drag its own colour into a two-colour palette.
 */
export function BugIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.2 3.4 5.1 2.1M9.8 3.4l1.1-1.3" />
      <rect x="4.4" y="4.2" width="7.2" height="8.4" rx="3.6" />
      <path d="M8 4.6v7.6" />
      <path d="M4.4 6.6 2 5.7M4.4 8.6H1.7M4.4 10.6 2 11.7" />
      <path d="M11.6 6.6 14 5.7M11.6 8.6h2.7M11.6 10.6l2.4 1.1" />
    </svg>
  );
}

interface Props {
  readonly snap: Snapshot;
  readonly run: AttackRun | null;
  /** Outcome of the last run, and which defect it belongs under. */
  readonly note: { readonly index: number; readonly text: string } | null;
  /** Something else has the endpoint — a run in progress, or a crash healing. */
  readonly busy: boolean;
  readonly onRun: (index: number) => void;
}

export default function BugReport({ snap, run, note, busy, onRun }: Props) {
  // One defect per stage reached: everything already patched, plus the one
  // currently open. Nothing further is shown, so the panel never spoils a
  // weakness in a defence the visitor has not built yet.
  const shown = DEFECTS.slice(0, Math.min(snap.applied.length + 1, DEFECTS.length));
  // Once everything is built there is nothing left to break, so the exploits
  // become a way to test what the visitor made rather than a way to progress.
  // Watching an old attack bounce is what turns the capstone from a claim into
  // something they can check.
  const capstone = snap.applied.length === DEFECTS.length;

  return (
    <div class="api-bugs">
      <p class="api-bugs-title">known issues</p>
      <ol>
        {shown.map((defect, i) => {
          const patched = i < snap.applied.length;
          const running = run !== null && run.index === i;

          return (
            <li key={defect.id} class={patched ? 'api-defect is-patched' : 'api-defect'}>
              <p class="api-defect-head">
                <span class="api-defect-id">{defect.id}</span>
                <span class="api-defect-title">{defect.title}</span>
                {/* The jargon rides along rather than leading: an engineer gets
                    the real name, everyone else gets a sentence they can read. */}
                <span class="api-defect-term">{defect.term}</span>
                <span class="api-defect-state">
                  {patched ? `patched · ${DEFENCE_LABEL[defect.patchedBy]}` : 'open'}
                </span>
              </p>
              <p class="api-defect-hint">{defect.hint}</p>

              {/* The exploit is only runnable while the defect is open, and only
                  once the stage that introduces it has been built. */}
              {(!patched || capstone) && defect.attack && (
                <p class="api-defect-run">
                  <button type="button" class="api-run" disabled={busy} onClick={() => onRun(i)}>
                    run exploit
                  </button>
                  <span class="api-run-status" role="status" aria-live="polite">
                    {running
                      ? run.waiting
                        ? (defect.attack.wait ?? 'running')
                        : `${run.fired} / ${run.total} sent`
                      : note?.index === i
                        ? note.text
                        : `sends ${attackSize(defect.attack)} requests`}
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
