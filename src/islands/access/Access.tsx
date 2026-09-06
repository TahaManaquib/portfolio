/**
 * The permission sandbox — a thin shell over `policy.ts`, which owns every
 * decision. This component holds a draft policy and shows what the engine
 * makes of it; it never judges anything itself.
 *
 * Preact rather than a plain module, unlike the palette control: there is real
 * state here — the chosen scenario, a draft the visitor edits, a verdict that
 * has to go stale the moment they change something — which is what a component
 * framework is actually for.
 */
import { useState } from 'preact/hooks';
import {
  DEFAULT_LEVEL,
  LEVELS,
  SCENARIOS,
  actionFullLabel,
  actionsFor,
  grade,
  initialDraft,
  type Draft,
  type LevelId,
  type Result,
  type Scenario,
} from './policy';

/** The groups the editor is laid out by. */
const KINDS = [
  { kind: 'project', label: 'projects' },
  { kind: 'invoice', label: 'the invoice' },
  { kind: 'people', label: 'people' },
  { kind: 'apikey', label: 'deploy keys' },
];

export default function Access({
  initialScenario,
  initialDraft: handedOver,
  autoCheck = false,
}: {
  initialScenario?: string;
  /** Permissions ticked before this module loaded. See mount.tsx. */
  initialDraft?: readonly string[];
  /** The click that loaded this module was the check button. */
  autoCheck?: boolean;
}) {
  /**
   * Deliberately not persisted. A draft is an attempt at a puzzle, not a
   * preference — finding yesterday's half-finished answer already filled in is
   * worse than starting clean, and it would rob the visitor of the blank page
   * the scenario is supposed to hand them. A reload resets everything.
   */
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const id = initialScenario ?? (SCENARIOS[0] as Scenario).id;
    return handedOver && handedOver.length > 0
      ? { [id]: { actions: [...handedOver], scoped: false } }
      : {};
  });
  const [level, setLevel] = useState<LevelId>(
    SCENARIOS.find((s) => s.id === initialScenario)?.level ?? DEFAULT_LEVEL,
  );
  const [scenarioId, setScenarioId] = useState(initialScenario ?? (SCENARIOS[0] as Scenario).id);
  const [result, setResult] = useState<Result | null>(() => {
    if (!autoCheck) return null;
    const s = SCENARIOS.find((x) => x.id === initialScenario) ?? (SCENARIOS[0] as Scenario);
    return grade(s, { actions: [...(handedOver ?? [])], scoped: false });
  });

  const briefs = SCENARIOS.filter((s) => s.level === level);
  const scenario =
    briefs.find((s) => s.id === scenarioId) ??
    (briefs[0] as Scenario) ??
    (SCENARIOS[0] as Scenario);

  /** A level is chosen, never earned — switching just lands on its first brief. */
  function chooseLevel(next: LevelId): void {
    setLevel(next);
    setScenarioId(SCENARIOS.find((s) => s.level === next)?.id ?? scenarioId);
    setResult(null);
  }

  // At judgement the brief stops listing limits: you are told what the person
  // must be able to do and have to work out the rest. They are revealed with
  // the verdict, so a wrong guess still teaches rather than only scolding.
  const hideLimits = scenario.level === 'judgement' && result === null;
  const draft = drafts[scenario.id] ?? initialDraft(scenario);

  /**
   * Any edit throws the verdict away. Checking is a commitment, and a tick left
   * over from a policy that no longer exists would be worse than no tick at all.
   */
  function setDraft(next: Draft): void {
    setDrafts({ ...drafts, [scenario.id]: next });
    setResult(null);
  }

  function togglePermission(action: string): void {
    setDraft({
      ...draft,
      actions: draft.actions.includes(action)
        ? draft.actions.filter((a) => a !== action)
        : [...draft.actions, action],
    });
  }

  const verdictFor = (label: string) => result?.verdicts.find((v) => v.label === label);

  const requirementRow = (label: string) => {
    const verdict = verdictFor(label);
    return (
      <li key={label} class="ax-req">
        <span class="ax-req-mark" aria-hidden="true">
          {verdict ? (verdict.met ? '✓' : '✗') : '·'}
        </span>
        <span class={verdict && !verdict.met ? 'ax-req-label is-missed' : 'ax-req-label'}>
          {label}
        </span>
        {verdict && !verdict.met && <span class="ax-reason">{verdict.note}</span>}
      </li>
    );
  };

  return (
    <div class="ax">
      <div class="ax-ask-line">
        <span class="ax-you">level</span>
        <div class="ax-choices ax-wrap" role="group" aria-label="Difficulty">
          {LEVELS.map((l) => (
            <label key={l.id} class="ax-role" title={l.demand}>
              <input
                type="radio"
                name="ax-level"
                value={l.id}
                class="sr-only"
                checked={level === l.id}
                onChange={() => chooseLevel(l.id)}
              />
              <span>{l.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div class="ax-ask-line">
        <span class="ax-you">brief</span>
        <div class="ax-choices ax-wrap" role="group" aria-label="Scenario">
          {briefs.map((s) => (
            <label key={s.id} class="ax-role">
              <input
                type="radio"
                name="ax-scenario"
                value={s.id}
                class="sr-only"
                checked={scenario.id === s.id}
                onChange={() => {
                  setScenarioId(s.id);
                  setResult(null);
                }}
              />
              <span>{s.title}</span>
            </label>
          ))}
        </div>
      </div>

      <p class="ax-brief">{scenario.brief}</p>

      <div class="ax-reqs">
        <div>
          <p class="ax-req-head">must be able to</p>
          <ul class="ax-rows">
            {scenario.requirements.filter((r) => r.must).map((r) => requirementRow(r.label))}
          </ul>
        </div>
        <div>
          <p class="ax-req-head">must not</p>
          <ul class="ax-rows">
            {scenario.requirements
              .filter((r) => !r.must)
              .map((r, i) =>
                hideLimits ? (
                  // One placeholder per hidden limit: the count is a fair hint —
                  // it tells you how many boundaries to find without telling you
                  // what they are. Same `???` the achievements use for the same
                  // idea, so the site has one way of saying "not yet known".
                  <li key={i} class="ax-req">
                    <span class="ax-req-mark" aria-hidden="true">
                      ·
                    </span>
                    <span class="ax-req-label is-unknown">???</span>
                  </li>
                ) : (
                  requirementRow(r.label)
                ),
              )}
          </ul>
        </div>
      </div>

      <div class="ax-editor">
        <p class="ax-req-head">
          {scenario.role} can
          {scenario.mode === 'fix' && <span class="ax-term">already configured</span>}
        </p>
        {KINDS.map((group) => (
          <div key={group.kind} class="ax-ask-line">
            <span class="ax-you">{group.label}</span>
            <div class="ax-choices ax-wrap" role="group" aria-label={group.label}>
              {actionsFor(group.kind).map((a) => (
                <label key={a.id} class="ax-toggle">
                  <input
                    type="checkbox"
                    value={a.id}
                    class="sr-only"
                    checked={draft.actions.includes(a.id)}
                    onChange={() => togglePermission(a.id)}
                  />
                  <span>{a.label}</span>
                </label>
              ))}
              {/* Not a fourth permission — a condition on the three beside it.
                  This is the difference between "may edit projects" and "may
                  edit projects they created", and it is the only way to satisfy
                  a brief that separates their own work from everyone else's. */}
              {group.kind === 'project' && (
                <label class="ax-toggle is-condition">
                  <input
                    type="checkbox"
                    class="sr-only"
                    checked={draft.scoped}
                    onChange={() => setDraft({ ...draft, scoped: !draft.scoped })}
                  />
                  <span>only their own</span>
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Checked on demand, never as you type. */}
      <div class="ax-check">
        <button type="button" class="ax-run" onClick={() => setResult(grade(scenario, draft))}>
          check
        </button>
        {result && (
          <span class={result.solved ? 'ax-grade is-solved' : 'ax-grade'}>
            {!result.solved
              ? 'not yet'
              : result.revealed > 0
                ? 'solved — and you worked out ' +
                  result.revealed +
                  ' limit' +
                  (result.revealed === 1 ? '' : 's') +
                  ' the brief never mentioned'
                : result.extra.length === 0
                  ? 'solved — exactly the permissions needed'
                  : 'solved, but you also granted ' + result.extra.map(actionFullLabel).join(', ')}
          </span>
        )}
      </div>

      {/* The engine's own signature, made a sentence — and the probe you reach
          for while solving. Chips rather than a <select>: a native dropdown's
          popup is drawn by the OS and ignores the palette, and a custom listbox
          would mean reimplementing keyboard navigation and ARIA for no gain. */}
    </div>
  );
}
