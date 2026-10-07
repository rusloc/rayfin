import { useState } from 'react';

import type { PoLineRef, PoNote } from '@/services/poNotes';

interface NotePanelProps {
  line: PoLineRef;
  /** Extra context for the header, e.g. supplier name; may be missing when the column is hidden. */
  subtitle?: string | null;
  /** The line's shared note, or null when nobody has written one yet. */
  note: PoNote | null;
  onSave: (line: PoLineRef, state: { flagged: boolean; comment: string | null }) => Promise<void>;
  onClose: () => void;
}

const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** Side drawer: the one shared note of a PO line; every signed-in user can rewrite or clear it. */
export function NotePanel({ line, subtitle, note, onSave, onClose }: NotePanelProps) {
  const [flagged, setFlagged] = useState(note?.flagged ?? false);
  const [comment, setComment] = useState(note?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = flagged !== (note?.flagged ?? false) || comment.trim() !== (note?.comment ?? '');

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
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col bg-white popup-surface"
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

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Shared note</p>
        {note ? (
          <p className="text-xs text-gray-500">
            Last edited by <span title={note.authorEmail}>{note.authorEmail}</span> · {stamp(note.updatedAt)}
          </p>
        ) : (
          <p className="text-xs text-gray-400">No note on this line yet.</p>
        )}
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
          rows={8}
          placeholder="Add a comment…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400">Everyone sees this note and can change it.</p>
      </div>

      <footer className="space-y-3 border-t border-gray-100 px-5 py-4">
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between">
          {note ? (
            <button
              onClick={() => window.confirm('Clear the note on this line for everyone?') && void save({ flagged: false, comment: null })}
              disabled={saving}
              className="text-sm text-gray-400 hover:text-red-600"
            >
              Clear note
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
