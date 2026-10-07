import { describe, expect, it } from 'vitest';

import { lineAsJson, lineAsText } from '@/components/lineDetails';
import { PO_COLUMNS } from '@/services/poColumns';

const row = { _line_id: 'L-1', _po_no_ekporef: '4500012345', _po_creation_date: '2026-03-05', _teus: 2.5 };

describe('lineAsText', () => {
  it('lists every catalog column once, in catalog order, with friendly labels and dd-Mmm-yyyy dates', () => {
    const lines = lineAsText(row).split('\n');
    expect(lines).toHaveLength(PO_COLUMNS.length);
    expect(lines[0]).toBe(`${PO_COLUMNS[0].label}: ${row[PO_COLUMNS[0].name as keyof typeof row] ?? '—'}`);
    expect(lines).toContain('PO Creation Date: 05-Mar-2026');
    expect(lines).toContain('TEUs: 2.5');
    expect(lines.filter((l) => l.endsWith(': —')).length).toBe(PO_COLUMNS.length - 4);
  });
});

describe('lineAsJson', () => {
  it('keys by model column name in catalog order, raw values, null when empty', () => {
    const parsed = JSON.parse(lineAsJson(row)) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(PO_COLUMNS.map((c) => c.name));
    expect(parsed._po_creation_date).toBe('2026-03-05');
    expect(parsed._teus).toBe(2.5);
    expect(parsed._client_name).toBeNull();
  });
});
