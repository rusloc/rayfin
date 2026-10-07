import type { PoRow } from './poView';

/** A line is late once its ETA is more than this many days in the past without an actual arrival. */
export const LATE_AFTER_DAYS = 7;

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 'YYYY-MM-DD' of (today − LATE_AFTER_DAYS) in local time; ETAs strictly before it are overdue. */
export function lateCutoff(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - LATE_AFTER_DAYS);
  return isoDate(d);
}

/** ETA < (today − 7 days) and no "Arrival date actual" yet. Dates are 'YYYY-MM-DD' strings. */
export function isLateLine(row: PoRow, cutoff: string): boolean {
  const eta = row._eta;
  const arrived = row._arrival_date_actual;
  return typeof eta === 'string' && eta !== '' && eta < cutoff && (arrived === null || arrived === undefined || arrived === '');
}
