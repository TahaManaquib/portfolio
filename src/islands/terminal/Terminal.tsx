/**
 * An editor-style terminal panel: slides up from the bottom, full width,
 * drag-resizable from its top edge. Not a command palette — the panel shape is
 * most of the character (CLAUDE.md).
 *
 * This whole module is code-split and only fetched when the visitor opens the
 * terminal. Nothing here is on the recruiter path.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { runCommand, type Line, type Select } from './commands';
import {
  DOCKS,
  FONT_MAX,
  FONT_MIN,
  apply,
  clampFont,
  clampSize,
  defaultFor,
  effectiveDock,
  isSide,
  loadDock,
  loadFont,
  loadSize,
  maxFor,
  minFor,
  saveDock,
  saveFont,
  saveSize,
  type Dock,
} from './dock';

const LINES_KEY = 'taha:terminal-lines';
const HISTORY_KEY = 'taha:terminal-history';

/**
 * Caps on what gets kept. Without them a bored visitor can grow the scrollback
 * until writes start throwing QuotaExceededError, and the DOM with it.
 */
const MAX_LINES = 400;
const MAX_HISTORY = 50;

const KINDS = new Set(['in', 'out', 'err', 'dim']);

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null; // absent, blocked, or corrupt — all mean "start fresh"
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or quota — not worth failing the terminal over */
  }
}

/**
 * Stored data is untrusted: it can be hand-edited, corrupted, or left over from
 * an older shape of this component. Validate every entry rather than trusting
 * JSON.parse — an unexpected `kind` would otherwise become a garbage CSS class.
 * (The text itself is safe to render: Preact escapes it, never innerHTML.)
 *
 * Returns null for "nothing usable stored", which includes an empty array — so
 * a scrollback cleared with `cls` comes back as a fresh session rather than a
 * blank panel with no hint in it.
 */
function loadLines(): Line[] | null {
  const parsed = read(LINES_KEY);
  if (!Array.isArray(parsed)) return null;
  const lines = parsed
    .filter(
      (l): l is Line =>
        typeof l === 'object' && l !== null && typeof l.text === 'string' && KINDS.has(l.kind),
    )
    .map((l) => ({ kind: l.kind, text: l.text }));
  return lines.length > 0 ? lines : null;
}

function loadHistory(): string[] {
  const parsed = read(HISTORY_KEY);
  return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string') : [];
}

/**
 * Panel size, dock and mode all persist, unlike content edits which are
 * deliberately ephemeral. They are UI preferences, not content — a visitor who
 * resized or moved their terminal expects it remembered (CLAUDE.md). The
 * limits, the per-axis storage and the validation all live in `dock.ts`.
 */

/** The axis a dock resizes along, and which viewport dimension bounds it. */
const axisOf = (dock: Dock) => (isSide(dock) ? 'width' : 'height');
const extentOf = (dock: Dock) => (isSide(dock) ? window.innerWidth : window.innerHeight);

const clampFor = (dock: Dock, px: number) =>
  clampSize(dock, px, window.innerWidth, window.innerHeight);
const maxOf = (dock: Dock) => maxFor(dock, window.innerWidth, window.innerHeight);
const startSize = (dock: Dock) =>
  clampFor(dock, loadSize(dock) ?? defaultFor(dock, window.innerWidth, window.innerHeight));

/** Percentages for the handle's ARIA, derived so they cannot drift from the clamp. */
const pct = (px: number, dock: Dock) => Math.round((px / extentOf(dock)) * 100);

/**
 * The opening lines. On touch there is no physical keyboard, so the panel is
 * usable but not comfortable — say so once, lightly, rather than nagging.
 */
function banner(): Line[] {
  const lines: Line[] = [{ kind: 'out', text: "taha.sh — type 'help' for commands" }];
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;
  if (touch) lines.push({ kind: 'dim', text: 'some of this works better with a keyboard ;)' });
  return lines;
}

export default function Terminal({ onClose }: { onClose: () => void }) {
  const [dock, setDock] = useState<Dock>(() => effectiveDock(loadDock(), window.innerWidth));
  const [size, setSize] = useState(() => startSize(effectiveDock(loadDock(), window.innerWidth)));
  const [font, setFont] = useState(loadFont);
  const [lines, setLines] = useState<Line[]>(() => loadLines() ?? banner());
  const [value, setValue] = useState('');
  const [dragging, setDragging] = useState(false);

  /**
   * Command history, oldest first. Persisted alongside the scrollback, so a
   * refresh does not wipe the session — only `cls` does. Capped at MAX_HISTORY.
   */
  const [history, setHistory] = useState<string[]>(loadHistory);
  /** null = editing a fresh line; a number = browsing history at that index. */
  const [histIndex, setHistIndex] = useState<number | null>(null);
  /** The half-typed line, stashed so ArrowDown can return you to it. */
  const draftRef = useRef('');

  /**
   * The open question, if a command asked one.
   *
   * Held here rather than pushed into `lines`, which is what makes it correct
   * for free in two places: it is never written to the persisted scrollback, so
   * a reload cannot restore a half-answered prompt as if it were live; and
   * answering it replaces the list rather than leaving fourteen dead rows
   * behind, the way a real prompt does.
   */
  const [picker, setPicker] = useState<{ select: Select; index: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Focus the input on mount, and keep the newest output in view.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Scrollback and history survive a reload; only `cls` clears them. Height is
  // stored separately because it is a UI preference rather than session content.
  useEffect(() => write(LINES_KEY, lines), [lines]);
  useEffect(() => write(HISTORY_KEY, history), [history]);

  /**
   * Keep the wheel inside the panel.
   *
   * `overscroll-behavior: contain` on the scrollback handles the common case,
   * but it only governs chaining *out of a scroll container* — the title bar
   * and the resize handle are not scrollable, so a wheel over them was never
   * "contained" at all and went straight to the page behind. The listener must
   * be non-passive, which rules out Preact's onWheel prop.
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onWheel = (e: WheelEvent) => {
      const body = scrollRef.current;
      if (body && e.composedPath().includes(body)) return; // the scrollback consumes it
      e.preventDefault();
    };
    panel.addEventListener('wheel', onWheel, { passive: false });
    return () => panel.removeEventListener('wheel', onWheel);
  }, []);

  /** Publish the dock and its size to :root; the stylesheet does the layout. */
  useEffect(() => apply(dock, size), [dock, size]);

  // Re-clamp if the viewport shrinks below the stored size, and drop a side
  // dock back to the bottom if the window becomes too narrow to hold one.
  useEffect(() => {
    const onResize = () => {
      const next = effectiveDock(dock, window.innerWidth);
      if (next !== dock) {
        setDock(next);
        setSize(startSize(next));
        return;
      }
      setSize((s) => clampFor(dock, s));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [dock]);

  const commit = useCallback(
    (px: number) => {
      const next = clampFor(dock, px);
      setSize(next);
      saveSize(dock, next);
    },
    [dock],
  );

  const stepFont = useCallback((by: number) => {
    setFont((current) => {
      const next = clampFont(current + by);
      if (next !== current) saveFont(next);
      return next;
    });
  }, []);

  /** Moving the panel swaps to that axis's remembered size, not the current one. */
  const moveTo = useCallback((next: Dock) => {
    const allowed = effectiveDock(next, window.innerWidth);
    setDock(allowed);
    saveDock(allowed);
    setSize(startSize(allowed));
  }, []);

  /**
   * The `dock` command's half of the control surface. An event rather than a
   * direct call, because `commands.ts` is imported by this component — reaching
   * back the other way would close the loop.
   */
  useEffect(() => {
    const onSet = (event: Event) => {
      const detail: unknown = (event as CustomEvent).detail;
      if (typeof detail !== 'object' || detail === null) return;
      const { dock: d } = detail as { dock?: unknown };
      if (typeof d === 'string' && (DOCKS as readonly string[]).includes(d)) moveTo(d as Dock);
    };
    window.addEventListener('taha:set-dock', onSet);
    return () => window.removeEventListener('taha:set-dock', onSet);
  }, [moveTo]);

  // Pointer drag on the inner edge. Pointer events cover mouse, pen and touch in
  // one path, and capture keeps the drag alive if the cursor outruns the handle.
  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      const handle = e.currentTarget as HTMLElement;
      handle.setPointerCapture(e.pointerId);
      setDragging(true);

      // Each dock grows away from its own edge, so the sign differs per side.
      const measure = (ev: PointerEvent) =>
        dock === 'bottom'
          ? window.innerHeight - ev.clientY
          : dock === 'left'
            ? ev.clientX
            : window.innerWidth - ev.clientX;

      const move = (ev: PointerEvent) => commit(measure(ev));
      const up = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        setDragging(false);
      };

      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      e.preventDefault();
    },
    [commit, dock],
  );

  /**
   * Arrow keys resize too — a mouse-only resizer is not accessible.
   *
   * The grow key follows the axis *and* the edge: Up grows a bottom panel,
   * Right grows a left-docked one, and Left grows a right-docked one. Wiring
   * both sides to the same key is the easy mistake and feels immediately wrong.
   */
  const onHandleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const step = e.shiftKey ? 64 : 16;
      const grow = dock === 'bottom' ? 'ArrowUp' : dock === 'left' ? 'ArrowRight' : 'ArrowLeft';
      const shrink = dock === 'bottom' ? 'ArrowDown' : dock === 'left' ? 'ArrowLeft' : 'ArrowRight';

      if (e.key === grow) commit(size + step);
      else if (e.key === shrink) commit(size - step);
      else if (e.key === 'Home') commit(maxOf(dock));
      else if (e.key === 'End') commit(minFor(dock));
      else return;
      e.preventDefault();
    },
    [commit, size, dock],
  );

  /** Recall puts the caret at the end, the way a shell does. */
  const recall = useCallback((text: string) => {
    setValue(text);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(text.length, text.length));
  }, []);

  const onInputKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        if (history.length === 0) return;
        e.preventDefault();
        if (histIndex === null) draftRef.current = value;
        const next = histIndex === null ? history.length - 1 : Math.max(0, histIndex - 1);
        setHistIndex(next);
        recall(history[next]!);
      } else if (e.key === 'ArrowDown') {
        if (histIndex === null) return;
        e.preventDefault();
        const next = histIndex + 1;
        if (next >= history.length) {
          setHistIndex(null);
          recall(draftRef.current);
        } else {
          setHistIndex(next);
          recall(history[next]!);
        }
      }
    },
    [history, histIndex, recall, value],
  );

  const submit = useCallback(
    (e: Event) => {
      e.preventDefault();
      const input = value.trim();
      setValue('');
      setHistIndex(null);
      draftRef.current = '';
      if (!input) return;

      // Skip consecutive duplicates, the way shells do with HISTCONTROL=ignoredups.
      setHistory((prev) =>
        prev[prev.length - 1] === input ? prev : [...prev, input].slice(-MAX_HISTORY),
      );

      const result = runCommand(input);
      if (result === 'cls') {
        // `cls` wipes the screen, never the history — same as a real shell.
        setLines([]);
        return;
      }

      const echo: Line = { kind: 'in', text: input };

      // A command that asked a question rather than answering one. The typed
      // line is echoed as normal, so the scrollback reads truthfully — `theme`
      // is what was typed — and the list opens underneath it.
      if (!(result instanceof Promise) && typeof result === 'object' && 'kind' in result) {
        setLines((prev) => [...prev, echo].slice(-MAX_LINES));
        setPicker({ select: result, index: result.initial });
        return;
      }

      // `hash` goes through WebCrypto, which is async. Echo the command
      // immediately so the line does not sit there looking ignored, then append
      // the output when it resolves.
      if (result instanceof Promise) {
        setLines((prev) => [...prev, echo].slice(-MAX_LINES));
        void result
          .then((resolved) => {
            if (resolved === 'cls') {
              setLines([]);
              return;
            }
            // No async command asks a question today; handled anyway so adding
            // one cannot silently render `[object Object]`.
            if (typeof resolved === 'object' && 'kind' in resolved) {
              setPicker({ select: resolved, index: resolved.initial });
              return;
            }
            setLines((prev) => [...prev, ...resolved].slice(-MAX_LINES));
          })
          .catch((cause: unknown) => {
            // Commands handle their own failures; this is the backstop, so a
            // rejection surfaces in the terminal rather than only the console.
            const line: Line = {
              kind: 'err',
              text: cause instanceof Error ? cause.message : String(cause),
            };
            setLines((prev) => [...prev, line].slice(-MAX_LINES));
          });
        return;
      }

      setLines((prev) => [...prev, echo, ...result].slice(-MAX_LINES));
    },
    [value],
  );

  /**
   * Answers the open question by running the command the user would have typed.
   *
   * `runCommand(`${verb} ${value}`)` on purpose: selecting is the *same* path as
   * typing, so the two cannot diverge and the award hook, the error handling and
   * the output are all whatever the typed form already does.
   */
  const answer = useCallback(
    (index: number) => {
      if (!picker) return;
      const option = picker.select.options[index];
      if (!option) return;
      setPicker(null);

      const result = runCommand(`${picker.select.verb} ${option.value}`);
      if (result === 'cls') {
        setLines([]);
        return;
      }
      if (result instanceof Promise) {
        void result.then((resolved) => {
          if (resolved === 'cls') setLines([]);
          else if (!(typeof resolved === 'object' && 'kind' in resolved))
            setLines((prev) => [...prev, ...resolved].slice(-MAX_LINES));
        });
        return;
      }
      if (typeof result === 'object' && 'kind' in result) return;
      setLines((prev) => [...prev, ...result].slice(-MAX_LINES));
    },
    [picker],
  );

  const cancelPicker = useCallback(() => {
    setPicker(null);
    setLines((prev) => [...prev, { kind: 'dim', text: 'cancelled' } as Line].slice(-MAX_LINES));
  }, []);

  /**
   * Keys while a question is open. They live on the list, not on the input,
   * which is what keeps this from fighting the two handlers already bound:
   * ArrowUp/Down mean *history* on the input and must keep meaning that, and
   * typing goes nowhere because the input does not have focus.
   */
  const onListKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!picker) return;
      const last = picker.select.options.length - 1;
      const move = (index: number) => {
        e.preventDefault();
        setPicker((prev) => (prev ? { ...prev, index } : prev));
      };

      if (e.key === 'ArrowDown') move(picker.index >= last ? 0 : picker.index + 1);
      else if (e.key === 'ArrowUp') move(picker.index <= 0 ? last : picker.index - 1);
      else if (e.key === 'Home') move(0);
      else if (e.key === 'End') move(last);
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        answer(picker.index);
      } else if (e.key === 'Escape') {
        // **Stopped here deliberately.** Escape closes the whole panel from the
        // section handler above; while a question is open it must cancel the
        // question instead, and a second Escape then closes the panel.
        e.preventDefault();
        e.stopPropagation();
        cancelPicker();
      }
    },
    [picker, answer, cancelPicker],
  );

  // Focus follows the question: into the list when it opens, back to the input
  // when it closes, so the caret is never left somewhere the keys do nothing.
  useEffect(() => {
    if (picker) listRef.current?.focus();
    else inputRef.current?.focus();
  }, [picker !== null]);

  // Keep the highlighted row on screen without scrolling the panel around it.
  useEffect(() => {
    if (!picker) return;
    listRef.current
      ?.querySelector(`[data-option="${picker.index}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [picker?.index]);

  return (
    <section
      class="term"
      /* The target of the opener's aria-controls. */
      id="terminal-panel"
      ref={panelRef}
      style={{ [axisOf(dock)]: `${size}px`, fontSize: `${font}px` }}
      aria-label="Terminal"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
          return;
        }

        // Ctrl/Cmd plus +/- resizes the text, the way an editor does.
        //
        // This deliberately takes those keys away from browser zoom, which is
        // only defensible because it is scoped to the panel: the handler is on
        // the panel, so it fires only while focus is inside it, and clicking
        // the page back gives zoom straight back. `=` and `_` are the unshifted
        // faces of `+` and `-`, and both need catching.
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const grow = e.key === '+' || e.key === '=';
        const shrink = e.key === '-' || e.key === '_';
        if (!grow && !shrink) return;
        e.preventDefault();
        stepFont(grow ? 1 : -1);
      }}
    >
      <div
        class="term-handle"
        role="separator"
        // A side dock is resized along the horizontal axis, so the separator
        // that does it is a vertical one. Reporting this wrong tells a screen
        // reader the arrow keys do the opposite of what they do.
        aria-orientation={isSide(dock) ? 'vertical' : 'horizontal'}
        aria-label="Resize terminal"
        aria-valuenow={pct(size, dock)}
        aria-valuemin={pct(minFor(dock), dock)}
        aria-valuemax={pct(maxOf(dock), dock)}
        tabIndex={0}
        data-dragging={dragging ? '' : undefined}
        onPointerDown={onPointerDown}
        onKeyDown={onHandleKeyDown}
      />

      <div class="term-bar">
        <span class="term-dot" aria-hidden="true" />
        <span class="term-title">taha.sh</span>

        {/* Text size. Disabled at the bounds rather than silently ignoring a
            press — a control that does nothing looks broken. */}
        <div class="term-font" role="group" aria-label="Text size">
          <button
            type="button"
            onClick={() => stepFont(-1)}
            disabled={font <= FONT_MIN}
            title={`Smaller text (${font}px)`}
          >
            <span aria-hidden="true">A&minus;</span>
            <span class="sr-only">Smaller text</span>
          </button>
          <button
            type="button"
            onClick={() => stepFont(1)}
            disabled={font >= FONT_MAX}
            title={`Larger text (${font}px)`}
          >
            <span aria-hidden="true">A+</span>
            <span class="sr-only">Larger text</span>
          </button>
        </div>

        {/* Dock controls, in edge order so the row reads as a little map of
            where the panel can go. Hidden below the width where a side dock
            stops being usable, rather than offered and then refused. */}
        <div class="term-docks" role="group" aria-label="Terminal position">
          {DOCKS.map((d) => (
            <button
              key={d}
              type="button"
              class="term-dock"
              data-dock-btn={d}
              aria-pressed={dock === d}
              title={`Dock ${d}`}
              onClick={() => moveTo(d)}
            >
              <span class="term-dock-glyph" aria-hidden="true" />
              <span class="sr-only">{`Dock ${d}`}</span>
            </button>
          ))}
        </div>

        <span class="term-hint" aria-hidden="true">
          esc to close
        </span>
        <button type="button" class="term-close" onClick={onClose} aria-label="Close terminal">
          ✕
        </button>
      </div>

      <div
        class="term-body"
        ref={scrollRef}
        onClick={() => (picker ? listRef.current?.focus() : inputRef.current?.focus())}
      >
        {lines.map((line, i) => (
          <div key={i} class={`term-line term-${line.kind}`}>
            {line.kind === 'in' ? (
              <span class="term-prompt">
                <span class="term-cwd">~</span> <span class="term-sigil">$</span>
              </span>
            ) : null}
            <span>{line.text}</span>
          </div>
        ))}

        {picker ? (
          <div class="term-ask">
            <p class="term-ask-head">
              <span>{picker.select.title}</span>
              <span class="term-ask-keys">↑↓ move · enter select · esc cancel</span>
            </p>
            {/* A real listbox: the highlight is announced through
                aria-activedescendant rather than by moving focus row to row,
                which is what lets one keydown handler own the whole list. */}
            <ul
              class="term-ask-list"
              ref={listRef}
              tabIndex={0}
              role="listbox"
              aria-label={picker.select.title}
              aria-activedescendant={`term-option-${picker.index}`}
              onKeyDown={onListKeyDown}
            >
              {picker.select.options.map((option, i) => (
                <li
                  key={option.value}
                  id={`term-option-${i}`}
                  data-option={i}
                  role="option"
                  aria-selected={i === picker.index}
                  class="term-ask-option"
                  onClick={() => answer(i)}
                >
                  {/* A marker as well as colour — the highlight must not rest on
                      hue alone (WCAG 1.4.1). */}
                  <span class="term-ask-mark" aria-hidden="true">
                    {i === picker.index ? '▸' : ' '}
                  </span>
                  <span class="term-ask-label">{option.label}</span>
                  {option.hint ? <span class="term-ask-hint">{option.hint}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form class="term-form" onSubmit={submit}>
          <label class="term-prompt" for="term-input">
            <span class="term-cwd">~</span> <span class="term-sigil">$</span>
          </label>
          <input
            id="term-input"
            ref={inputRef}
            class="term-input"
            value={value}
            onInput={(e) => setValue((e.target as HTMLInputElement).value)}
            onKeyDown={onInputKeyDown}
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck={false}
            aria-label="Terminal input"
          />
        </form>
      </div>
    </section>
  );
}
