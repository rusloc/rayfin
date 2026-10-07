import { useEffect, useMemo, useState } from 'react';

import { lateCutoff } from '@/services/poRules';
import type { PoRow } from '@/services/poView';

import { lateByCreationMonth, monthRange, niceTicks } from './lateCounts';

interface LateChartProps {
  /** All loaded PO lines (not the grid's filtered view). */
  rows: readonly PoRow[];
  onClose: () => void;
  /** A bar was clicked: 'YYYY-MM' of its creation month. */
  onSelectMonth: (month: string) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM' → 'Mmm-yy' (axis) or 'Mmm yyyy' (tooltip). */
function monthLabel(month: string, longYear = false) {
  const [y, m] = month.split('-');
  const name = MONTHS[Number(m) - 1];
  return longYear ? `${name} ${y}` : `${name}-${y.slice(2)}`;
}

/** Minimum width of one month on the x axis; wider ranges scroll horizontally. */
const SLOT = 44;

/** Bar-chart glyph for the "Purchase order lines" title button. */
export function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M3 17h14" strokeLinecap="round" />
      <path d="M6 14V9M10 14V5M14 14v-3" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}

/**
 * 16:9 modal: late lines (pale red rows) counted per PO creation month. The
 * From / To months filter this chart only; empty bounds fall back to the
 * first / last month that has late lines. Clicking a bar hands its month to
 * `onSelectMonth` (the page closes the chart and filters the grid).
 */
export function LateChart({ rows, onClose, onSelectMonth }: LateChartProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { counts, undated } = useMemo(() => lateByCreationMonth(rows, lateCutoff()), [rows]);
  const dataMonths = useMemo(() => [...counts.keys()].sort(), [counts]);
  const first = dataMonths[0] ?? '';
  const last = dataMonths.at(-1) ?? '';

  const start = from || first;
  const end = to || last;
  const months = useMemo(
    () => (start && end ? (start <= end ? monthRange(start, end) : monthRange(end, start)) : []),
    [start, end]
  );
  const values = months.map((m) => counts.get(m) ?? 0);
  const total = values.reduce((a, b) => a + b, 0);
  const ticks = niceTicks(Math.max(0, ...values));
  const top = ticks.at(-1)!;
  const pct = (v: number) => `${(v / top) * 100}%`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Late lines chart"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex aspect-video w-[min(94vw,max(36rem,47vw),calc((100vh-2rem)*8/9))] flex-col rounded-2xl bg-white popup-surface"
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-2.5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Late lines by PO creation month</h3>
            <p className="text-xs text-gray-500">ETA more than 7 days ago and no actual arrival</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none text-gray-400 hover:text-gray-700">
            ×
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs text-gray-600">
          <label className="flex items-center gap-1.5">
            From
            <input
              type="month"
              value={start}
              min={first || undefined}
              max={last || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-gray-300 px-1.5 py-0.5 text-gray-800 focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5">
            To
            <input
              type="month"
              value={end}
              min={first || undefined}
              max={last || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-gray-300 px-1.5 py-0.5 text-gray-800 focus:border-blue-500 focus:outline-none"
            />
          </label>
          {(from || to) && (
            <button
              onClick={() => {
                setFrom('');
                setTo('');
              }}
              className="font-medium text-blue-600 hover:text-blue-800"
            >
              All months
            </button>
          )}
          <span className="ml-auto">
            <strong className="font-semibold text-gray-900">{total.toLocaleString()}</strong> late lines in range
            {undated > 0 && <span className="text-gray-400"> · {undated.toLocaleString()} without a creation date</span>}
          </span>
        </div>

        {months.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-sm text-gray-400">No late lines.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-x-auto px-4 pb-3">
            <div className="flex h-full" style={{ minWidth: 36 + months.length * SLOT }}>
              {/* y axis, sticky while the months scroll */}
              <div className="sticky left-0 z-10 flex w-9 shrink-0 flex-col bg-white">
                <div className="relative mt-5 flex-1">
                  {ticks.map((t) => (
                    <span
                      key={t}
                      className="absolute right-2 translate-y-1/2 text-[11px] tabular-nums text-gray-400"
                      style={{ bottom: pct(t) }}
                    >
                      {t.toLocaleString()}
                    </span>
                  ))}
                </div>
                <div className="h-6" />
              </div>

              <div className="flex flex-1 flex-col">
                <div className="relative mt-5 flex-1 border-b border-gray-300">
                  {ticks.slice(1).map((t) => (
                    <div key={t} className="absolute inset-x-0 border-t border-gray-100" style={{ bottom: pct(t) }} />
                  ))}
                  <div className="absolute inset-0 flex">
                    {months.map((month, i) => (
                      <div key={month} className="relative h-full flex-1" style={{ minWidth: SLOT }}>
                        {values[i] > 0 && (
                          // The whole month column is the hit target, not just the bar.
                          <button
                            onClick={() => onSelectMonth(month)}
                            aria-label={`${monthLabel(month, true)}: ${values[i]} late lines`}
                            title={`${monthLabel(month, true)}: ${values[i]} late line${values[i] === 1 ? '' : 's'} · click to show in the table`}
                            className="group absolute inset-0 cursor-pointer focus:outline-none"
                          >
                            <span
                              className="absolute inset-x-0 text-center text-[11px] font-medium tabular-nums text-gray-700"
                              style={{ bottom: `calc(${pct(values[i])} + 2px)` }}
                            >
                              {values[i].toLocaleString()}
                            </span>
                            <span
                              className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t bg-red-400 group-hover:bg-red-500 group-focus-visible:bg-red-500"
                              style={{ height: pct(values[i]), width: 'min(24px, calc(100% - 4px))' }}
                            />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* x axis: one label per month */}
                <div className="flex h-6">
                  {months.map((month) => (
                    <div
                      key={month}
                      className="flex-1 pt-1 text-center text-[10px] tabular-nums text-gray-500"
                      style={{ minWidth: SLOT }}
                    >
                      {monthLabel(month)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
