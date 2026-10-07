import { useEffect, useMemo, useState } from 'react';

import { lateCutoff } from '@/services/poRules';
import type { PoRow } from '@/services/poView';

import { dayRange, lateByCreationDay, niceTicks } from './lateCounts';

interface LateChartProps {
  /** All loaded PO lines (not the grid's filtered view). */
  rows: readonly PoRow[];
  onClose: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' → 'dd-Mmm-yy' (axis) or 'dd-Mmm-yyyy' (tooltip). */
function dayLabel(day: string, longYear = false) {
  const [y, m, d] = day.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${longYear ? y : y.slice(2)}`;
}

/** Minimum width of one day on the x axis; wider ranges scroll horizontally. */
const SLOT = 28;

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
 * 16:9 modal: late lines (pale red rows) counted per PO creation day. The
 * From / To dates filter this chart only; empty bounds fall back to the first
 * / last day that has late lines.
 */
export function LateChart({ rows, onClose }: LateChartProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { counts, undated } = useMemo(() => lateByCreationDay(rows, lateCutoff()), [rows]);
  const dataDays = useMemo(() => [...counts.keys()].sort(), [counts]);
  const first = dataDays[0] ?? '';
  const last = dataDays.at(-1) ?? '';

  const start = from || first;
  const end = to || last;
  const days = useMemo(
    () => (start && end ? (start <= end ? dayRange(start, end) : dayRange(end, start)) : []),
    [start, end]
  );
  const values = days.map((d) => counts.get(d) ?? 0);
  const total = values.reduce((a, b) => a + b, 0);
  const ticks = niceTicks(Math.max(0, ...values));
  const top = ticks.at(-1)!;
  const pct = (v: number) => `${(v / top) * 100}%`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/30 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Late lines chart"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex aspect-video w-[min(94vw,calc((100vh-2rem)*16/9))] flex-col rounded-2xl bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="font-semibold text-gray-900">Late lines by PO creation date</h3>
            <p className="text-sm text-gray-500">ETA more than 7 days ago and no actual arrival · one bar per day</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none text-gray-400 hover:text-gray-700">
            ×
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm text-gray-600">
          <label className="flex items-center gap-2">
            From
            <input
              type="date"
              value={start}
              min={first || undefined}
              max={last || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1 text-gray-800 focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2">
            To
            <input
              type="date"
              value={end}
              min={first || undefined}
              max={last || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1 text-gray-800 focus:border-blue-500 focus:outline-none"
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
              All dates
            </button>
          )}
          <span className="ml-auto">
            <strong className="font-semibold text-gray-900">{total.toLocaleString()}</strong> late lines in range
            {undated > 0 && <span className="text-gray-400"> · {undated.toLocaleString()} without a creation date</span>}
          </span>
        </div>

        {days.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-sm text-gray-400">No late lines.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-x-auto px-6 pb-4">
            <div className="flex h-full" style={{ minWidth: 40 + days.length * SLOT }}>
              {/* y axis, sticky while the days scroll */}
              <div className="sticky left-0 z-10 flex w-10 shrink-0 flex-col bg-white">
                <div className="relative mt-6 flex-1">
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
                <div className="h-16" />
              </div>

              <div className="flex flex-1 flex-col">
                <div className="relative mt-6 flex-1 border-b border-gray-300">
                  {ticks.slice(1).map((t) => (
                    <div key={t} className="absolute inset-x-0 border-t border-gray-100" style={{ bottom: pct(t) }} />
                  ))}
                  <div className="absolute inset-0 flex">
                    {days.map((day, i) => (
                      <div key={day} className="relative h-full flex-1" style={{ minWidth: SLOT }}>
                        {values[i] > 0 && (
                          <>
                            <span
                              className="absolute inset-x-0 text-center text-[11px] font-medium tabular-nums text-gray-700"
                              style={{ bottom: `calc(${pct(values[i])} + 2px)` }}
                            >
                              {values[i]}
                            </span>
                            <div
                              role="img"
                              aria-label={`${dayLabel(day, true)}: ${values[i]} late lines`}
                              title={`${dayLabel(day, true)}: ${values[i]} late line${values[i] === 1 ? '' : 's'}`}
                              className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t bg-red-400 hover:bg-red-500"
                              style={{ height: pct(values[i]), width: 'min(24px, calc(100% - 4px))' }}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* x axis: one label per day */}
                <div className="flex h-16">
                  {days.map((day) => (
                    <div key={day} className="flex flex-1 justify-center pt-1" style={{ minWidth: SLOT }}>
                      <span className="rotate-180 text-[10px] tabular-nums text-gray-500 [writing-mode:vertical-rl]">
                        {dayLabel(day)}
                      </span>
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
