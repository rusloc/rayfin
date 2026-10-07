import { useEffect, useMemo, useRef, useState } from 'react';

interface ColumnPickerProps {
  /** Every pickable column name, in catalog order. */
  all: readonly string[];
  /** Applied selection, in display order. */
  selected: readonly string[];
  defaults: readonly string[];
  max: number;
  label: (name: string) => string;
  onApply: (next: string[]) => void;
}

/**
 * Popover checklist. Edits stay in a draft until Apply, because every applied
 * change re-queries the model.
 */
export function ColumnPicker({ all, selected, defaults, max, label, onApply }: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Selected columns float to the top, ordered once per opening so rows
  // don't jump while boxes are ticked.
  const [order, setOrder] = useState<string[]>([]);

  const openPicker = () => {
    const picked = new Set(selected);
    setDraft([...selected]);
    setOrder([...selected, ...all.filter((n) => !picked.has(n))]);
    setSearch('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return order;
    return order.filter((n) => label(n).toLowerCase().includes(term) || n.includes(term));
  }, [order, search, label]);

  const picked = new Set(draft);
  const full = draft.length >= max;

  const toggle = (name: string) =>
    setDraft((d) => (d.includes(name) ? d.filter((n) => n !== name) : [...d, name]));

  // Both act on the list as currently shown, so a search narrows them.
  // Select all stops at the cap, in list order.
  const selectAll = () =>
    setDraft((d) => {
      const room = max - d.length;
      return room > 0 ? [...d, ...visible.filter((n) => !d.includes(n)).slice(0, room)] : d;
    });
  const deselectAll = () => {
    const shown = new Set(visible);
    setDraft((d) => d.filter((n) => !shown.has(n)));
  };
  const allShownPicked = visible.every((n) => picked.has(n));
  const noneShownPicked = !visible.some((n) => picked.has(n));

  const apply = () => {
    setOpen(false);
    onApply(draft);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-expanded={open}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        Columns · {selected.length}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-96 rounded-xl bg-white popup-surface">
          <div className="space-y-2 border-b border-gray-100 p-3">
            <div className="flex items-center justify-between">
              <p className={`text-xs ${full ? 'text-amber-600' : 'text-gray-500'}`}>
                {draft.length} of max {max} selected
              </p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close columns"
                className="text-xl leading-none text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search columns…"
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex items-center gap-3 text-xs font-medium">
              <button
                onClick={selectAll}
                disabled={full || allShownPicked}
                className="text-blue-600 hover:text-blue-800 disabled:text-gray-300"
              >
                {search.trim() ? 'Select all shown' : 'Select all'}
              </button>
              <button
                onClick={deselectAll}
                disabled={noneShownPicked}
                className="text-blue-600 hover:text-blue-800 disabled:text-gray-300"
              >
                {search.trim() ? 'Deselect all shown' : 'Deselect all'}
              </button>
              <button
                onClick={() => setDraft([...defaults])}
                className="ml-auto text-blue-600 hover:text-blue-800"
              >
                Reset to default
              </button>
            </div>
          </div>

          <ul className="max-h-80 overflow-y-auto py-1">
            {visible.map((name) => {
              const checked = picked.has(name);
              return (
                <li key={name}>
                  <label
                    title={name}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm ${
                      !checked && full ? 'text-gray-300' : 'text-gray-800 hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && full}
                      onChange={() => toggle(name)}
                      className="accent-blue-600"
                    />
                    {label(name)}
                  </label>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-gray-400">No matching columns</li>
            )}
          </ul>

          <div className="flex justify-end gap-2 border-t border-gray-100 p-3">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={apply}
              disabled={draft.length === 0}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
