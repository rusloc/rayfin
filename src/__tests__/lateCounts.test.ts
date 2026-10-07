import { describe, expect, it } from 'vitest';

import { lateByCreationMonth, monthRange, niceTicks } from '@/components/lateCounts';

describe('lateByCreationMonth', () => {
  const cutoff = '2026-09-30';
  it('counts only late lines, per creation month, and tallies undated ones', () => {
    const { counts, undated } = lateByCreationMonth(
      [
        { _eta: '2026-09-01', _arrival_date_actual: null, _po_creation_date: '2026-08-01' },
        { _eta: '2026-09-01', _arrival_date_actual: null, _po_creation_date: '2026-08-31T00:00:00' },
        { _eta: '2026-09-01', _arrival_date_actual: null, _po_creation_date: '2026-07-31' },
        { _eta: '2026-09-01', _arrival_date_actual: null, _po_creation_date: null },
        { _eta: '2026-09-01', _arrival_date_actual: '2026-09-02', _po_creation_date: '2026-08-01' }, // arrived
        { _eta: '2026-10-01', _arrival_date_actual: null, _po_creation_date: '2026-08-01' }, // not overdue
      ],
      cutoff
    );
    expect([...counts].sort()).toEqual([
      ['2026-07', 1],
      ['2026-08', 2],
    ]);
    expect(undated).toBe(1);
  });
});

describe('monthRange', () => {
  it('lists every month inclusive, across year ends', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthRange('2026-10', '2026-10')).toEqual(['2026-10']);
    expect(monthRange('2026-11', '2026-10')).toEqual([]);
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
