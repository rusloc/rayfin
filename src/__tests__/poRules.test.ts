import { describe, expect, it } from 'vitest';

import { isLateLine, lateCutoff } from '@/services/poRules';

describe('lateCutoff', () => {
  it('is today minus 7 days in local time, across month and year ends', () => {
    expect(lateCutoff(new Date(2026, 9, 7, 23, 59))).toBe('2026-09-30');
    expect(lateCutoff(new Date(2026, 0, 3, 0, 1))).toBe('2025-12-27');
  });
});

describe('isLateLine', () => {
  const cutoff = '2026-09-30';
  it('flags an ETA before the cutoff with no actual arrival', () => {
    expect(isLateLine({ _eta: '2026-09-29', _arrival_date_actual: null }, cutoff)).toBe(true);
  });
  it('is strict: an ETA exactly on the cutoff is not late yet', () => {
    expect(isLateLine({ _eta: '2026-09-30', _arrival_date_actual: null }, cutoff)).toBe(false);
  });
  it('is not late once arrived, or without an ETA', () => {
    expect(isLateLine({ _eta: '2026-01-01', _arrival_date_actual: '2026-01-05' }, cutoff)).toBe(false);
    expect(isLateLine({ _eta: null, _arrival_date_actual: null }, cutoff)).toBe(false);
    expect(isLateLine({}, cutoff)).toBe(false);
  });
});
