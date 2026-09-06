/**
 * Editing in the source view: change a value and watch the human view change
 * with it, and add or remove entries in the arrays the page renders.
 *
 * The source view claims the two views are one dataset rendered twice. This is
 * the proof — an architecture demonstration rather than a party trick, which is
 * why it earns a script on a page that otherwise needs none.
 *
 * **Scope.** Values are strings, edited in place; there are no numbers in the
 * data, and the one boolean gates whether an element exists at all, which is
 * structure rather than a value. Arrays of strings and arrays of objects can
 * both grow and shrink. Still no new keys, no type changes and no raw-text JSON
 * editing, so there is no invalid-JSON state to design for — that remains the
 * reason this stays affordable.
 *
 * **An entry is one element on each side.** A string entry is the `<li>` or
 * `<span>` that renders it; an object entry spans a `<dt>` and a `<dd>`, so
 * those are wrapped in a `display: contents` div carrying `data-bind-item`. One
 * handle per entry on both sides is what lets add, remove and renumber stay
 * generic instead of growing a branch per shape.
 *
 * Three rules from CLAUDE.md, structural here rather than promised:
 *
 *   - **Text, never HTML.** Every read and write is `textContent`, and pasted
 *     text goes in through `createTextNode`. New entries are cloned from
 *     rendered ones, never parsed. Nothing here builds a node from input.
 *   - **Ephemeral.** Nothing is persisted; a reload restores what was served.
 *   - **Reset.** Original values and original array lengths are both captured
 *     before anything changes.
 */

const PATH_ATTRS = ['data-path', 'data-bind', 'data-bind-item'] as const;

/**
 * A leaf value, not a branch. Branches carry `data-path` too — an object entry
 * is a `<details data-path="contact.0" data-kind="object">` — so anything that
 * clears or edits "the value" has to exclude them, or it wipes the subtree.
 */
const LEAF = '[data-path]:not([data-kind])';

/**
 * Only schemes a link should ever have. Edits are local and ephemeral, so a
 * `javascript:` URL could only ever be aimed at the visitor's own browser — but
 * building a feature that turns typed text into an executable URL is the wrong
 * habit, and refusing costs one function.
 */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

function safeHref(value: string): string | null {
  try {
    const url = new URL(value, document.baseURI);
    return SAFE_SCHEMES.has(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

const escapeRe = (path: string) => path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches a direct index child of `path`: `proof.2`, not `proof.2.label`. */
const indexChild = (path: string) => new RegExp(`^${escapeRe(path)}\\.\\d+$`);

/**
 * Inserts text at the caret without `execCommand`, which is deprecated.
 * `createTextNode` cannot produce markup whatever the string contains, so the
 * text-never-HTML rule is enforced by the API rather than by care.
 */
function insertPlainText(text: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Caret offset inside a cell, and whether it sits at either extreme. */
function caretInfo(cell: HTMLElement): { offset: number; atStart: boolean; atEnd: boolean } {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return { offset: 0, atStart: true, atEnd: true };
  const range = selection.getRangeAt(0);
  const before = range.cloneRange();
  before.selectNodeContents(cell);
  before.setEnd(range.startContainer, range.startOffset);
  const offset = before.toString().length;
  const length = cell.textContent?.length ?? 0;
  return {
    offset,
    atStart: selection.isCollapsed && offset === 0,
    atEnd: selection.isCollapsed && offset === length,
  };
}

/** Puts the caret at a character offset inside a cell, clamped to its text. */
function placeCaret(cell: HTMLElement, offset: number): void {
  cell.focus();
  const text = cell.firstChild;
  const length = cell.textContent?.length ?? 0;
  const range = document.createRange();
  if (text && text.nodeType === Node.TEXT_NODE) {
    range.setStart(text, Math.max(0, Math.min(offset, length)));
  } else {
    range.selectNodeContents(cell);
  }
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** What goes between joined entries: `a, b, and c`. */
function separatorAfter(index: number, total: number): string {
  if (index >= total - 1) return '';
  if (index === total - 2) return ', and ';
  return ', ';
}

interface ListInfo {
  /** The array's `<details>` in the JSON view. Its `data-path` is the truth. */
  readonly details: HTMLElement;
  /** The `[data-children]` box holding its rows. */
  readonly rows: HTMLElement;
  readonly rowTemplate: HTMLElement;
  readonly itemTemplate: HTMLElement;
  /** Where the page renders this array's entries. */
  readonly host: HTMLElement;
  /** Object entries are addressed by `data-bind-item`, strings by `data-bind`. */
  readonly objects: boolean;
  /** Set when the entries form a sentence rather than a list. */
  readonly join: string | null;
  /**
   * Pristine clones of the entries as served, taken before any control is
   * attached. Reset restores *these* rather than re-adding blanks and retyping
   * the text into them: an entry carries more than its bound values — hrefs,
   * `target`/`rel`, the screen-reader-only "opens in a new tab" note — and none
   * of that is editable, so none of it could be put back by hand.
   */
  readonly originalRows: readonly HTMLElement[];
  readonly originalItems: readonly HTMLElement[];
  /**
   * Where the entries end on the page. The hero's list sits mid-sentence, so
   * restoring by appending would land it after the full stop.
   */
  readonly anchor: ChildNode | null;
}

export function mountEditor(view: HTMLElement): void {
  const targets = new Map<string, HTMLElement[]>();
  /**
   * Paths the page renders as an attribute rather than as text: a link's
   * destination, and the metadata in <head>. The title is not one of these — it
   * binds by text content, because that is what changes the browser tab.
   */
  const attrs = new Map<string, { el: HTMLElement; attr: string }[]>();
  /** Cells that already have listeners. See `makeEditable`. */
  const wired = new WeakSet<HTMLElement>();
  const originals = new Map<string, string>();
  const lists: ListInfo[] = [];
  const known = new WeakSet<HTMLElement>();

  const resetRow = document.querySelector<HTMLElement>('[data-edit-row]');
  const resetButton = document.querySelector<HTMLButtonElement>('[data-edit-reset]');

  /**
   * Rebuilt wholesale after any structural change rather than patched. Paths
   * shift underneath this map whenever an entry is added or removed, and a
   * ~50-element query is far cheaper than the bookkeeping to keep it exact.
   */
  function refreshTargets(): void {
    targets.clear();
    for (const el of document.querySelectorAll<HTMLElement>('[data-bind]')) {
      const path = el.dataset.bind;
      if (!path) continue;
      const list = targets.get(path);
      if (list) list.push(el);
      else targets.set(path, [el]);
    }

    attrs.clear();
    const add = (path: string | undefined, el: HTMLElement, attr: string) => {
      if (!path) return;
      const list = attrs.get(path);
      if (list) list.push({ el, attr });
      else attrs.set(path, [{ el, attr }]);
    };
    for (const el of document.querySelectorAll<HTMLElement>('[data-bind-href]')) {
      add(el.dataset.bindHref, el, 'href');
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-bind-content]')) {
      add(el.dataset.bindContent, el, 'content');
    }
  }

  /** A value the page renders somewhere — as text, or as an attribute. */
  const isBound = (path: string) => targets.has(path) || attrs.has(path);

  function markTouched(): void {
    if (resetRow) resetRow.hidden = false;
  }

  function write(path: string, text: string): void {
    for (const el of targets.get(path) ?? []) el.textContent = text;
    for (const { el, attr } of attrs.get(path) ?? []) {
      if (attr !== 'href') {
        el.setAttribute(attr, text);
        continue;
      }
      const safe = safeHref(text);
      // A link with nowhere valid to go loses its href rather than keeping the
      // old one — silently ignoring the edit would be the confusing option.
      if (safe === null) el.removeAttribute('href');
      else el.setAttribute('href', safe);
    }
  }

  // ---- value editing ------------------------------------------------------

  function makeEditable(cell: HTMLElement): void {
    // Guarded on a set of wired cells, not on `isContentEditable`. A cloned row
    // can arrive already carrying `contenteditable` — the template for a nested
    // list is captured after its parent's cells were wired — and trusting the
    // attribute meant such a cell looked editable while having no listeners at
    // all: you could type into it and nothing reached the page.
    if (wired.has(cell)) return;
    wired.add(cell);
    const path = cell.dataset.path as string;
    if (!originals.has(path)) originals.set(path, cell.textContent ?? '');

    cell.contentEditable = 'plaintext-only';
    cell.spellcheck = false;
    cell.setAttribute('role', 'textbox');
    cell.setAttribute('aria-label', `${path} — editable value`);
    cell.classList.add('is-editable');

    cell.addEventListener('input', () => {
      write(cell.dataset.path as string, cell.textContent ?? '');
      markTouched();
    });

    // `plaintext-only` is not universal, so a paste is forced to plain text
    // rather than trusted. Newlines are flattened: a value is one line, and
    // pasting a paragraph should not silently restructure the tree.
    cell.addEventListener('paste', (event) => {
      event.preventDefault();
      insertPlainText((event.clipboardData?.getData('text/plain') ?? '').replace(/\s+/g, ' '));
      write(cell.dataset.path as string, cell.textContent ?? '');
      markTouched();
    });

    cell.addEventListener('keydown', (event) => {
      const current = cell.dataset.path as string;
      if (event.key === 'Enter') {
        event.preventDefault();
        cell.blur();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        const original = originals.get(current) ?? '';
        cell.textContent = original;
        write(current, original);
        cell.blur();
        return;
      }
      navigate(cell, event);
    });
  }

  // ---- caret navigation ---------------------------------------------------

  /**
   * Makes the values behave like one document to the caret while remaining
   * separate editable regions underneath.
   *
   * The alternative — one big `contenteditable` over the whole tree — would let
   * a visitor delete a brace or a key and leave the JSON invalid, which is
   * exactly the state Tier 1 is designed never to have. So the structure stays
   * locked and only the crossings are simulated: arrow off the end of one value
   * and the caret appears in the next, keeping its column where that makes
   * sense, the way moving between lines in an editor does.
   */
  function editableCells(): HTMLElement[] {
    return [...view.querySelectorAll<HTMLElement>(`${LEAF}.is-editable`)];
  }

  function step(cell: HTMLElement, delta: number): HTMLElement | null {
    const cells = editableCells();
    const index = cells.indexOf(cell);
    if (index === -1) return null;
    return cells[index + delta] ?? null;
  }

  function navigate(cell: HTMLElement, event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;

    const { offset, atStart, atEnd } = caretInfo(cell);
    let next: HTMLElement | null = null;
    let target = 0;

    if (event.key === 'ArrowDown') {
      next = step(cell, 1);
      target = offset;
    } else if (event.key === 'ArrowUp') {
      next = step(cell, -1);
      target = offset;
    } else if (event.key === 'ArrowRight' && atEnd) {
      next = step(cell, 1);
      target = 0;
    } else if (event.key === 'ArrowLeft' && atStart) {
      next = step(cell, -1);
      target = Number.MAX_SAFE_INTEGER;
    } else {
      return;
    }

    if (!next) return;
    event.preventDefault();
    placeCaret(next, target);
  }

  // ---- structure ----------------------------------------------------------

  const pathOf = (info: ListInfo) => info.details.dataset.path as string;
  const itemAttr = (info: ListInfo) => (info.objects ? 'data-bind-item' : 'data-bind');

  /** Entry rows only — the injected add-button row is not one of them. */
  const jsonRows = (info: ListInfo) =>
    [...info.rows.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.dataset.addRow === undefined,
    );

  const pageItems = (info: ListInfo) => {
    const match = indexChild(pathOf(info));
    const attr = itemAttr(info);
    return [...info.host.children].filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && match.test(el.getAttribute(attr) ?? ''),
    );
  };

  /** A row's own path: on the element for a branch, on its cell for a leaf. */
  const rowPath = (row: HTMLElement) =>
    row.dataset.path ?? row.querySelector<HTMLElement>(':scope > [data-path]')?.dataset.path ?? '';

  /**
   * Rewrites every path attribute in a subtree from one index to another. This
   * is what makes object entries work: renaming `contact.2` has to carry
   * `contact.2.label` and `contact.2.value` with it, however deep they sit.
   */
  function renumber(root: HTMLElement, from: string, to: string): void {
    if (!from || from === to) return;
    const fix = (el: HTMLElement, attr: string) => {
      const value = el.getAttribute(attr);
      if (value === from) el.setAttribute(attr, to);
      else if (value?.startsWith(`${from}.`)) el.setAttribute(attr, to + value.slice(from.length));
    };
    for (const attr of PATH_ATTRS) {
      if (root.hasAttribute(attr)) fix(root, attr);
      for (const el of root.querySelectorAll<HTMLElement>(`[${attr}]`)) fix(el, attr);
    }
    for (const cell of root.querySelectorAll<HTMLElement>(LEAF)) {
      if (cell.isContentEditable) {
        cell.setAttribute('aria-label', `${cell.dataset.path} — editable value`);
      }
    }
  }

  /** A branch carries its comma on the closing-brace row, a leaf on itself. */
  const commaHost = (row: HTMLElement) =>
    row.tagName === 'DETAILS' ? (row.lastElementChild as HTMLElement | null) : row;

  function setComma(row: HTMLElement, needed: boolean): void {
    const host = commaHost(row);
    if (!host) return;
    const comma = host.querySelector<HTMLElement>(':scope > [data-comma]');
    if (needed && !comma) {
      const span = document.createElement('span');
      span.className = 'tok-p';
      span.dataset.comma = '';
      span.textContent = ',';
      // Before the remove control: the comma is JSON, the button is a handle
      // bolted onto the end of the row.
      host.insertBefore(span, host.querySelector(':scope > [data-remove]'));
    } else if (!needed && comma) {
      comma.remove();
    }
  }

  /**
   * Renumbers both sides and repairs everything that depends on position: the
   * trailing comma in the JSON, the `, ` / `, and ` that turn a list back into
   * a sentence, and the count in the collapsed summary. One pass after every
   * change, so add and remove need no index bookkeeping of their own.
   */
  function relabel(info: ListInfo): void {
    const path = pathOf(info);
    const rows = jsonRows(info);
    rows.forEach((row, i) => {
      renumber(row, rowPath(row), `${path}.${i}`);
      setComma(row, i < rows.length - 1);
    });

    const attr = itemAttr(info);
    pageItems(info).forEach((el, i) => renumber(el, el.getAttribute(attr) ?? '', `${path}.${i}`));

    refreshTargets();

    if (info.join === 'comma-and') {
      const items = pageItems(info);
      const first = items[0];
      const last = items[items.length - 1];
      // Only meaningful with two or more: with one entry `first === last`, and
      // the walk below would run to the end of the parent and swallow the full
      // stop along with everything else after it.
      if (first && last && first !== last) {
        // Only the text strictly between the entries is ours — the lead-in
        // before the first and the full stop after the last are not.
        const between: ChildNode[] = [];
        for (let node = first.nextSibling; node && node !== last; node = node.nextSibling) {
          if (node.nodeType === Node.TEXT_NODE) between.push(node);
        }
        for (const node of between) node.remove();
        items.forEach((el, i) => {
          const sep = separatorAfter(i, items.length);
          if (sep) el.after(document.createTextNode(sep));
        });
      }
    }

    const count = info.details.querySelector<HTMLElement>(':scope > summary [data-count]');
    if (count) count.textContent = `${rows.length} item${rows.length === 1 ? '' : 's'}`;
  }

  function button(label: string, title: string): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'json-btn';
    el.textContent = label;
    el.title = title;
    el.setAttribute('aria-label', title);
    return el;
  }

  /**
   * Drops the separator a joined entry owns — but only if it owns one. The text
   * after the *last* entry is the sentence's full stop, not a separator, and
   * eating it leaves the page reading "...and integrations" with no end.
   */
  function dropSeparatorAfter(info: ListInfo, el: HTMLElement): void {
    if (!info.join) return;
    const isEntry = (node: Element | null) =>
      node instanceof HTMLElement &&
      indexChild(pathOf(info)).test(node.getAttribute(itemAttr(info)) ?? '');

    if (isEntry(el.nextElementSibling)) {
      if (el.nextSibling?.nodeType === Node.TEXT_NODE) el.nextSibling.remove();
      return;
    }
    // Last entry: what follows is the sentence's full stop, not a separator.
    // The separator it owns is the one *before* it — and only if another entry
    // is on the far side of it, or that is the lead-in and not ours to touch.
    if (isEntry(el.previousElementSibling) && el.previousSibling?.nodeType === Node.TEXT_NODE) {
      el.previousSibling.remove();
    }
  }

  function removeItem(info: ListInfo, row: HTMLElement): void {
    const path = rowPath(row);
    const attr = itemAttr(info);
    for (const el of pageItems(info)) {
      if (el.getAttribute(attr) !== path) continue;
      dropSeparatorAfter(info, el);
      el.remove();
    }
    row.remove();
    relabel(info);
    markTouched();
  }

  function wireRemove(info: ListInfo, row: HTMLElement): void {
    // A branch hangs its control off the summary so it stays reachable while
    // collapsed; a leaf puts it at the end of its own row.
    const host =
      row.tagName === 'DETAILS' ? row.querySelector<HTMLElement>(':scope > summary') : row;
    if (!host || host.querySelector(':scope > [data-remove]')) return;
    const el = button('−', `remove entry from ${pathOf(info)}`);
    el.dataset.remove = '';
    el.addEventListener('click', (event) => {
      // Inside a <summary> a click would otherwise toggle the disclosure.
      event.preventDefault();
      event.stopPropagation();
      removeItem(info, row);
    });
    host.append(el);
  }

  function addItem(info: ListInfo): void {
    const row = info.rowTemplate.cloneNode(true) as HTMLElement;
    const item = info.itemTemplate.cloneNode(true) as HTMLElement;

    // A new entry starts empty. Clearing per bound leaf rather than wiping
    // textContent is what keeps an object entry's structure intact.
    const blank = (root: HTMLElement, selector: string) => {
      if (root.matches(selector)) root.textContent = '';
      for (const el of root.querySelectorAll<HTMLElement>(selector)) el.textContent = '';
    };
    blank(row, LEAF);
    blank(item, '[data-bind]');
    commaHost(row)?.querySelector(':scope > [data-comma]')?.remove();
    // A cloned link would point at the entry it was copied from, which is worse
    // than pointing nowhere. Hrefs are not editable, so it cannot be corrected.
    for (const anchor of item.querySelectorAll('a[href]')) anchor.removeAttribute('href');

    // `:scope >` matters: an object entry's rows box contains nested arrays
    // with add rows of their own, and an unscoped query finds one of those.
    const addRow = info.rows.querySelector(':scope > [data-add-row]');
    if (addRow) info.rows.insertBefore(row, addRow);
    else info.rows.append(row);

    const existing = pageItems(info);
    const lastItem = existing[existing.length - 1];
    if (lastItem) lastItem.after(item);
    else info.host.append(item);

    relabel(info);
    // A clone may carry editing state copied from a wired cell. Strip it first
    // so `makeEditable` starts from a clean element and nothing is left looking
    // editable without being so.
    const strip = (cell: HTMLElement) => {
      cell.removeAttribute('contenteditable');
      cell.removeAttribute('role');
      cell.removeAttribute('aria-label');
      cell.classList.remove('is-editable');
    };
    const wire = (cell: HTMLElement) => {
      strip(cell);
      if (isBound(cell.dataset.path ?? '')) makeEditable(cell);
    };
    if (row.matches(LEAF)) wire(row);
    for (const cell of row.querySelectorAll<HTMLElement>(LEAF)) wire(cell);
    wireRemove(info, row);
    // A cloned object entry brings its own nested arrays with it. They need
    // their own controls, and they should start with a single blank entry
    // rather than however many the entry they were copied from happened to have.
    registerLists(row, true);
    markTouched();
  }

  /**
   * Finds arrays the page renders and gives them controls. Runs over the whole
   * view at mount, and over each newly cloned entry after that.
   */
  function registerLists(root: HTMLElement, trimNested = false): void {
    const found = [...root.querySelectorAll<HTMLElement>('[data-kind="array"]')];
    if (root.matches('[data-kind="array"]')) found.unshift(root);

    for (const details of found) {
      if (known.has(details)) continue;
      const path = details.dataset.path;
      const rows = details.querySelector<HTMLElement>(':scope > [data-children]');
      const firstRow = rows?.firstElementChild;
      if (!path || !rows || !(firstRow instanceof HTMLElement)) continue;

      // The page must render this array for editing it to demonstrate anything.
      const firstItem =
        document.querySelector<HTMLElement>(`[data-bind="${CSS.escape(path)}.0"]`) ??
        document.querySelector<HTMLElement>(`[data-bind-item="${CSS.escape(path)}.0"]`);
      const host = firstItem?.parentElement;
      if (!firstItem || !host) continue;

      known.add(details);
      const objects = firstItem.hasAttribute('data-bind-item');
      const attr = objects ? 'data-bind-item' : 'data-bind';
      const match = indexChild(path);
      const currentItems = [...host.children].filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && match.test(el.getAttribute(attr) ?? ''),
      );
      const currentRows = [...rows.children].filter(
        (el): el is HTMLElement => el instanceof HTMLElement,
      );
      const info: ListInfo = {
        details,
        rows,
        rowTemplate: firstRow.cloneNode(true) as HTMLElement,
        itemTemplate: firstItem.cloneNode(true) as HTMLElement,
        host,
        objects,
        join: host.dataset.bindJoin ?? null,
        originalRows: currentRows.map((el) => el.cloneNode(true) as HTMLElement),
        originalItems: currentItems.map((el) => el.cloneNode(true) as HTMLElement),
        anchor: currentItems[currentItems.length - 1]?.nextSibling ?? null,
      };
      lists.push(info);

      for (const row of jsonRows(info)) wireRemove(info, row);

      const addRow = document.createElement('div');
      addRow.className = 'row';
      addRow.dataset.addRow = '';
      const add = button('+', `add entry to ${path}`);
      add.addEventListener('click', () => addItem(info));
      addRow.append(add);
      rows.append(addRow);

      if (trimNested) {
        let current = jsonRows(info);
        while (current.length > 1) {
          removeItem(info, current[current.length - 1] as HTMLElement);
          current = jsonRows(info);
        }
      }
    }
  }

  // ---- wire up ------------------------------------------------------------

  refreshTargets();
  registerLists(view);
  for (const cell of view.querySelectorAll<HTMLElement>(LEAF)) {
    if (isBound(cell.dataset.path ?? '')) makeEditable(cell);
  }

  /** Puts one list back exactly as it was served, entries and all. */
  function restore(info: ListInfo): void {
    for (const row of jsonRows(info)) row.remove();
    for (const el of pageItems(info)) {
      dropSeparatorAfter(info, el);
      el.remove();
    }

    const addRow = info.rows.querySelector(':scope > [data-add-row]');
    for (const proto of info.originalRows) {
      const row = proto.cloneNode(true) as HTMLElement;
      if (addRow) info.rows.insertBefore(row, addRow);
      else info.rows.append(row);
    }
    for (const proto of info.originalItems) {
      const item = proto.cloneNode(true) as HTMLElement;
      if (info.anchor?.isConnected) info.host.insertBefore(item, info.anchor);
      else info.host.append(item);
    }

    relabel(info);

    for (const row of jsonRows(info)) {
      if (row.matches(LEAF) && isBound(row.dataset.path ?? '')) makeEditable(row);
      for (const cell of row.querySelectorAll<HTMLElement>(LEAF)) {
        if (isBound(cell.dataset.path ?? '')) makeEditable(cell);
      }
      wireRemove(info, row);
      registerLists(row);
    }
  }

  resetButton?.addEventListener('click', () => {
    // Shallowest arrays first: restoring `stack.primary` replaces the nested
    // lists that come after it, and a replaced list cannot be restored twice.
    for (const info of [...lists].sort((a, b) => pathOf(a).length - pathOf(b).length)) {
      if (info.details.isConnected) restore(info);
    }

    for (const [path, text] of originals) {
      const cell = view.querySelector<HTMLElement>(`${LEAF}[data-path="${CSS.escape(path)}"]`);
      if (cell) cell.textContent = text;
      write(path, text);
    }

    if (resetRow) resetRow.hidden = true;
  });
}
