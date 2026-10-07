import { describe, expect, it } from 'vitest';

import { dayRange, lateByCreationDay, niceTicks } from '@/components/lateCounts';

describe('lateByCreationDay', () => {
  const cutoff = '2026-09-30';
  it('counts only late lines, per creation day, and tallies undated ones', () => {
    const { counts, undated } = lateByCreationDay(
      [
        { _eta: '2026-09-01', _arrival_date_actual: null, _po_creation_date: '2026-08-01' },
        { _eta: '2026-09-01', _arrival_date_actual: null, _po_creation_date: '2026-08-01T00:00:00' },
        { _eta: '2026-09-01', _arrival_date_actual: null, _po_creation_date: null },
        { _eta: '2026-09-01', _arrival_date_actual: '2026-09-02', _po_creation_date: '2026-08-01' }, // arrived
        { _eta: '2026-10-01', _arrival_date_actual: null, _po_creation_date: '2026-08-01' }, // not overdue
      ],
      cutoff
    );
    expect([...counts]).toEqual([['2026-08-01', 2]]);
    expect(undated).toBe(1);
  });
});

describe('dayRange', () => {
  it('lists every day inclusive, across month and leap-year ends', () => {
    expect(dayRange('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
    expect(dayRange('2026-10-07', '2026-10-07')).toEqual(['2026-10-07']);
    expect(dayRange('2026-10-08', '2026-10-07')).toEqual([]);
  });
});

describe('niceTicks', () => {
  it('starts at 0 and ends on a round value at or above the max', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(10)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(12)).toEqual([0, 5, 10, 15]);
    expect(niceTicks(240)).toEqual([0, 50, 100, 150, 200, 250]);
  });
});
