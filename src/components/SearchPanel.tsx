import { useEffect, useRef, useState } from 'react';

import { activeCount, EMPTY_SEARCH, type ColumnSearchKey, type PoSearch, type TriState } from './poSearch';

interface SearchPanelProps {
  value: PoSearch;
  /** Which criteria can apply: a filter only works while its column is in the grid. */
  enabled: Record<ColumnSearchKey, boolean>;
  suggestions: { supplier: string[]; masterLine: string[] };
  onApply: (next: PoSearch) => void;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" strokeLinecap="round" />
    </svg>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-300';

/** Popover holding every search criterion of the PO view; edits apply on Search. */
export function SearchPanel({ value, enabled, suggestions, onApply }: SearchPanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PoSearch>(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = activeCount(value);

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

  const set = (key: keyof PoSearch) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  const apply = (next: PoSearch) => {
    setOpen(false);
    onApply(next);
  };

  const hint = (key: ColumnSearchKey) =>
    enabled[key] ? null : <span className="ml-1 font-normal text-gray-400">(add the column to search)</span>;

  /** Any / yes / no segmented toggle for a boolean criterion. */
  const triState = (key: 'flag' | 'late', legend: string, [yes, no]: [string, string]) => (
    <fieldset className="space-y-1 text-xs font-medium text-gray-600">
      <legend>{legend}</legend>
      <div className="flex gap-1">
        {(
          [
            ['any', 'Any'],
            ['yes', yes],
            ['no', no],
          ] as [TriState, string][]
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={draft[key] === value}
            onClick={() => setDraft((d) => ({ ...d, [key]: value }))}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-sm ${
              draft[key] === value
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => {
          if (!open) setDraft(value);
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-label="Search"
        title="Search"
        className="relative flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <SearchIcon />
        Search
        {count > 0 && (
          <span className="ml-0.5 rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">{count}</span>
        )}
      </button>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
          className="absolute right-0 z-20 mt-2 w-96 space-y-3 rounded-xl bg-white p-4 popup-surface"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Search PO lines</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close search"
              className="text-xl leading-none text-gray-400 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          <label className="block space-y-1 text-xs font-medium text-gray-600">
            <span>Supplier name{hint('supplier')}</span>
            <input
              autoFocus
              list="po-search-suppliers"
              value={draft.supplier}
              onChange={set('supplier')}
              disabled={!enabled.supplier}
              placeholder="contains…"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-xs font-medium text-gray-600">
            <span>Master line{hint('masterLine')}</span>
            <input
              list="po-search-master-lines"
              value={draft.masterLine}
              onChange={set('masterLine')}
              disabled={!enabled.masterLine}
              placeholder="contains…"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-xs font-medium text-gray-600">
            <span>PO No.{hint('poNo')}</span>
            <input value={draft.poNo} onChange={set('poNo')} disabled={!enabled.poNo} placeholder="contains…" className={inputClass} />
          </label>
          <fieldset className="space-y-1 text-xs font-medium text-gray-600">
            <legend>PO need-by date{hint('needByFrom')}</legend>
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Need-by from"
                value={draft.needByFrom}
                onChange={set('needByFrom')}
                disabled={!enabled.needByFrom}
                className={inputClass}
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                aria-label="Need-by to"
                value={draft.needByTo}
                onChange={set('needByTo')}
                disabled={!enabled.needByTo}
                className={inputClass}
              />
            </div>
          </fieldset>
          <label className="block space-y-1 text-xs font-medium text-gray-600">
            <span>PO creation month</span>
            <input type="month" value={draft.createdMonth} onChange={set('createdMonth')} className={inputClass} />
          </label>

          {triState('late', 'Late', ['Late', 'Not late'])}
          {triState('flag', 'Flag', ['✓ Flagged', '✗ Not flagged'])}
          <label className="block space-y-1 text-xs font-medium text-gray-600">
            <span>Comment</span>
            <input value={draft.comment} onChange={set('comment')} placeholder="contains…" className={inputClass} />
          </label>

          <datalist id="po-search-suppliers">
            {suggestions.supplier.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="po-search-master-lines">
            {suggestions.masterLine.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => apply(EMPTY_SEARCH)}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Clear all
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Search
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
