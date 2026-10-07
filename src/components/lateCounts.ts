import { isLateLine } from '@/services/poRules';
import type { PoRow } from '@/services/poView';

/** Column the late chart groups by. */
export const LATE_CHART_DATE_COLUMN = '_po_creation_date';

export interface LateByDay {
  /** Late line count per 'YYYY-MM-DD' creation day (days without late lines are absent). */
  counts: Map<string, number>;
  /** Late lines without a creation date (cannot be placed on the axis). */
  undated: number;
}

/** Late lines (same rule as the pale red rows) counted per PO creation day. */
export function lateByCreationDay(rows: readonly PoRow[], cutoff: string): LateByDay {
  const counts = new Map<string, number>();
  let undated = 0;
  for (const row of rows) {
    if (!isLateLine(row, cutoff)) continue;
    const created = row[LATE_CHART_DATE_COLUMN];
    if (typeof created !== 'string' || created === '') {
      undated++;
      continue;
    }
    const day = created.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return { counts, undated };
}

/** Every 'YYYY-MM-DD' day from `from` to `to`, both inclusive (empty when from > to). */
export function dayRange(from: string, to: string): string[] {
  const days: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

/** Clean y-axis ticks from 0 to a round top ≥ max (steps of 1 / 2 / 5 × 10^k, at most ~5 ticks). */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const unit = Math.max(1, step);
  const ticks: number[] = [];
  for (let v = 0; v < max + unit; v += unit) ticks.push(v);
  return ticks;
}
