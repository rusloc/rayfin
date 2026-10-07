import { useEffect, useState } from 'react';

import { PO_COLUMNS } from '@/services/poColumns';
import type { PoRow } from '@/services/poView';

import { lineAsJson, lineAsText, type DetailsFormat } from './lineDetails';

interface LineDetailsPanelProps {
  lineId: string;
  title: string;
  subtitle?: string | null;
  /** Fetches the full record of the line (every catalog column). */
  load: (lineId: string) => Promise<PoRow | null>;
  onClose: () => void;
}

/** Document glyph for the grid's line details column. */
export function DocIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden>
      <path d="M5 2.5h6.5L15 6v11.5H5z" strokeLinejoin="round" />
      <path d="M11.5 2.5V6H15M7.5 9.5h5M7.5 12h5M7.5 14.5h3" strokeLinecap="round" />
    </svg>
  );
}

const FORMATS: [DetailsFormat, string][] = [
  ['text', 'TEXT'],
  ['json', 'JSON'],
];

/** Side panel (where the note panel opens): every column of one PO line, as a text list or JSON. */
export function LineDetailsPanel({ lineId, title, subtitle, load, onClose }: LineDetailsPanelProps) {
  const [row, setRow] = useState<PoRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<DetailsFormat>('text');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const content = row ? (format === 'json' ? lineAsJson(row) : lineAsText(row)) : null;

  /** Copy what is shown (TEXT or JSON) to the clipboard; the note beside the button confirms for 2 s. */
  const copy = () => {
    if (content === null) return;
    navigator.clipboard
      .writeText(content)
      .then(() => setCopyState('copied'))
      .catch(() => setCopyState('failed'));
  };

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [copyState]);

  useEffect(() => {
    let stale = false;
    load(lineId)
      .then((data) => {
        if (stale) return;
        if (data) setRow(data);
        else setError('This line is no longer in the PO view.');
      })
      .catch((err: unknown) => !stale && setError(err instanceof Error ? err.message : 'Could not load the line.'));
    return () => {
      stale = true;
    };
  }, [lineId, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside
      aria-label="PO line details"
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col bg-white popup-surface"
    >
      <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">
            {subtitle ? `${subtitle} · ` : ''}all {PO_COLUMNS.length} columns
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-xl leading-none text-gray-400 hover:text-gray-700">
          ×
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : content !== null ? (
          <pre data-testid="line-details" className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-gray-800">
            {content}
          </pre>
        ) : (
          <p className="text-sm text-gray-400">Loading all columns…</p>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
        <div role="group" aria-label="Format" className="flex rounded-lg border border-gray-200 p-0.5">
          {FORMATS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFormat(value)}
              aria-pressed={format === value}
              className={`rounded-md px-3 py-1 text-sm ${
                format === value ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span role="status" className={`text-xs ${copyState === 'failed' ? 'text-red-600' : 'text-gray-500'}`}>
            {copyState === 'copied' ? `Copied as ${format.toUpperCase()}` : copyState === 'failed' ? 'Copy failed' : ''}
          </span>
          <button
            onClick={copy}
            disabled={content === null}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Copy
          </button>
        </div>
      </footer>
    </aside>
  );
}
