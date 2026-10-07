import { useState } from 'react';

import type { PoLineRef, PoNote } from '@/services/poNotes';

interface NotePanelProps {
  line: PoLineRef;
  /** Extra context for the header, e.g. supplier name; may be missing when the column is hidden. */
  subtitle?: string | null;
  notes: PoNote[];
  userId: string | null;
  onSave: (line: PoLineRef, state: { flagged: boolean; comment: string | null }) => Promise<void>;
  onClose: () => void;
}

const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** Side drawer: everyone's notes on one PO line, with the signed-in user's own note editable. */
export function NotePanel({ line, subtitle, notes, userId, onSave, onClose }: NotePanelProps) {
  const mine = notes.find((n) => n.userId === userId) ?? null;
  const others = notes.filter((n) => n !== mine);
  const [flagged, setFlagged] = useState(mine?.flagged ?? false);
  const [comment, setComment] = useState(mine?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = flagged !== (mine?.flagged ?? false) || comment.trim() !== (mine?.comment ?? '');

  const save = async (state: { flagged: boolean; comment: string | null }) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(line, state);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside
      aria-label="PO line notes"
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl"
    >
      <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-gray-900">
            PO {line.poNo}
            {line.lineNo && <span className="text-gray-500"> · line {line.lineNo}</span>}
          </h3>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-xl leading-none">
          ×
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {others.length === 0 && <p className="text-sm text-gray-400">No notes from others on this line.</p>}
        {others.map((n) => (
          <article key={n.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
              <span className="truncate" title={n.authorEmail}>
                {n.authorEmail}
              </span>
              <span className="shrink-0">{stamp(n.updatedAt)}</span>
            </div>
            {n.flagged && <p className="mt-1 text-xs font-medium text-amber-600">⚑ Flagged</p>}
            {n.comment && <p className="mt-1 whitespace-pre-wrap text-gray-800">{n.comment}</p>}
          </article>
        ))}
      </div>

      <footer className="space-y-3 border-t border-gray-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">My note</p>
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={flagged}
            onChange={(e) => setFlagged(e.target.checked)}
            className="accent-amber-500"
          />
          Flag this line
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Add a comment…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between">
          {mine ? (
            <button
              onClick={() => window.confirm('Delete your note on this line?') && void save({ flagged: false, comment: null })}
              disabled={saving}
              className="text-sm text-gray-400 hover:text-red-600"
            >
              Delete my note
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={() => void save({ flagged, comment: comment.trim() || null })}
            disabled={saving || !dirty}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </footer>
    </aside>
  );
}
