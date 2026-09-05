/**
 * An editor-style terminal panel: slides up from the bottom, full width,
 * drag-resizable from its top edge. Not a command palette — the panel shape is
 * most of the character (CLAUDE.md).
 *
 * This whole module is code-split and only fetched when the visitor opens the
 * terminal. Nothing here is on the recruiter path.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { runCommand, type Line } from './commands';

const STORAGE_KEY = 'taha:terminal-height';
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
 * Panel height persists, unlike content edits which are deliberately
 * ephemeral. Height is a UI preference, not content — a visitor who resized
 * their terminal expects it remembered (CLAUDE.md).
 */
function loadHeight(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw === null ? NaN : Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null; // private mode, blocked storage — not worth failing over
  }
}

function saveHeight(px: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(px));
  } catch {
    /* ignore */
  }
}

const MIN_PX = 120;
const maxPx = () => Math.round(window.innerHeight * 0.9);
const defaultPx = () => Math.round(window.innerHeight * 0.5);
const clampHeight = (px: number) => Math.min(Math.max(px, MIN_PX), maxPx());

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
  const [height, setHeight] = useState(() => clampHeight(loadHeight() ?? defaultPx()));
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

  const inputRef = useRef<HTMLInputElement>(null);
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

  // Re-clamp if the viewport shrinks below the stored height.
  useEffect(() => {
    const onResize = () => setHeight((h) => clampHeight(h));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const commit = useCallback((px: number) => {
    const next = clampHeight(px);
    setHeight(next);
    saveHeight(next);
  }, []);

  // Pointer drag on the top edge. Pointer events cover mouse, pen and touch in
  // one path, and capture keeps the drag alive if the cursor outruns the handle.
  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      const handle = e.currentTarget as HTMLElement;
      handle.setPointerCapture(e.pointerId);
      setDragging(true);

      const move = (ev: PointerEvent) => commit(window.innerHeight - ev.clientY);
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
    [commit],
  );

  /** Arrow keys resize too — a mouse-only resizer is not accessible. */
  const onHandleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const step = e.shiftKey ? 64 : 16;
      if (e.key === 'ArrowUp') commit(height + step);
      else if (e.key === 'ArrowDown') commit(height - step);
      else if (e.key === 'Home') commit(maxPx());
      else if (e.key === 'End') commit(MIN_PX);
      else return;
      e.preventDefault();
    },
    [commit, height],
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
      setLines((prev) => [...prev, echo, ...result].slice(-MAX_LINES));
    },
    [value],
  );

  return (
    <section
      class="term"
      ref={panelRef}
      style={{ height: `${height}px` }}
      aria-label="Terminal"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        class="term-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize terminal"
        aria-valuenow={Math.round((height / window.innerHeight) * 100)}
        aria-valuemin={Math.round((MIN_PX / window.innerHeight) * 100)}
        aria-valuemax={90}
        tabIndex={0}
        data-dragging={dragging ? '' : undefined}
        onPointerDown={onPointerDown}
        onKeyDown={onHandleKeyDown}
      />

      <div class="term-bar">
        <span class="term-dot" aria-hidden="true" />
        <span class="term-title">taha.sh</span>
        <span class="term-hint" aria-hidden="true">
          esc to close
        </span>
        <button type="button" class="term-close" onClick={onClose} aria-label="Close terminal">
          ✕
        </button>
      </div>

      <div class="term-body" ref={scrollRef} onClick={() => inputRef.current?.focus()}>
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
