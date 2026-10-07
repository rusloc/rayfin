import { useEffect } from 'react';

export interface JourneyStep {
  label: string;
  /** Display-formatted date, or null when the milestone has no date yet. */
  date: string | null;
}

interface JourneyPanelProps {
  title: string;
  supplier: string | null;
  client: string | null;
  steps: JourneyStep[];
  onClose: () => void;
}

/** Route glyph used by the grid's shipment path column. */
export function RouteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <circle cx="5" cy="4" r="2" />
      <circle cx="15" cy="16" r="2" />
      <path d="M5 6v2.5a3 3 0 0 0 3 3h4a3 3 0 0 1 3 3V14" strokeDasharray="2 2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Modal with the shipment path of one PO line: supplier on top, milestones as
 * big dots joined by a dotted line, client at the bottom. A milestone with a
 * date is filled; one without is hollow.
 */
export function JourneyPanel({ title, supplier, client, steps, onClose }: JourneyPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shipment path"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Supplier</p>
            <p className="truncate font-semibold text-gray-900" title={supplier ?? undefined}>
              {supplier ?? '—'}
            </p>
            <p className="text-xs text-gray-500">{title}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none text-gray-400 hover:text-gray-700">
            ×
          </button>
        </header>

        <ol className="px-6 py-5">
          {steps.map((step, i) => (
            <li key={step.label} className="relative flex gap-4 pb-7 last:pb-0">
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[9px] top-6 bottom-1 border-l-2 border-dotted border-gray-300"
                />
              )}
              <span
                aria-hidden
                className={`relative z-10 mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 ${
                  step.date ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                }`}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{step.label}</p>
                <p className={`text-sm ${step.date ? 'text-gray-600' : 'text-gray-400'}`}>{step.date ?? 'No date yet'}</p>
              </div>
            </li>
          ))}
        </ol>

        <footer className="border-t border-gray-100 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Client</p>
          <p className="truncate font-semibold text-gray-900" title={client ?? undefined}>
            {client ?? '—'}
          </p>
        </footer>
      </div>
    </div>
  );
}
