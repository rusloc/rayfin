import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeQuery } = vi.hoisted(() => ({ executeQuery: vi.fn() }));

vi.mock('@/services/rayfinClient', () => ({
  isLocalBackend: () => false,
  getRayfinClient: () => ({
    connectors: { comsreport: { executeQuery } },
  }),
}));

import {
  DEFAULT_PO_COLUMNS,
  MAX_PO_COLUMNS,
  PO_COLUMNS,
} from '@/services/poColumns';
import { PO_KEY_COLUMNS, PO_ROW_LIMIT, listPoRows } from '@/services/poView';

// One column of each catalog type.
const STR = '_po_no_ekporef';
const INT = '_line_no';
const DBL = '_shipped';
const DATE = '_etd';
const MIXED = [STR, INT, DBL, DATE] as const;
const LINE_ID = '_line_id';
/** Columns the service projects for a caller's list: the list, then the key columns it lacks. */
const projected = (columns: readonly string[]) => [
  ...new Set([...columns, ...PO_KEY_COLUMNS]),
];

function success(columnNames: string[], rows: unknown[][]) {
  return {
    status: 'success' as const,
    table: {
      columns: columnNames.map((name) => ({ name, dataType: 'unknown' })),
      rows,
    },
    requestId: 'req-1',
  };
}

function failure(category: string, message: string) {
  return {
    status: 'error' as const,
    error: { category, message },
    requestId: 'req-1',
  };
}

function sentDax(): string {
  return (executeQuery.mock.calls[0][0] as { query: string }).query;
}

describe('poView service', () => {
  beforeEach(() => {
    executeQuery.mockReset();
    executeQuery.mockResolvedValue(success([], []));
  });

  describe('DAX generation', () => {
    it('passes a SELECTCOLUMNS query over _PO_VIEW_ and the row limit', async () => {
      await listPoRows(DEFAULT_PO_COLUMNS);
      expect(executeQuery).toHaveBeenCalledTimes(1);
      expect(executeQuery).toHaveBeenCalledWith({
        query: expect.stringMatching(/^EVALUATE\nSELECTCOLUMNS \(\n {4}'_PO_VIEW_'\n/),
        resultSetRowCountLimit: PO_ROW_LIMIT,
      });
      expect(PO_ROW_LIMIT).toBe(50_000);
      expect(sentDax().trimEnd().endsWith('\n)')).toBe(true);
    });

    it('aliases every requested column by its model name exactly once, in request order', async () => {
      await listPoRows(DEFAULT_PO_COLUMNS);
      const dax = sentDax();
      let lastIndex = -1;
      for (const name of DEFAULT_PO_COLUMNS) {
        const pair = `,"${name}", '_PO_VIEW_'[${name}]`;
        expect(dax.split(pair)).toHaveLength(2);
        const at = dax.indexOf(pair);
        expect(at).toBeGreaterThan(lastIndex);
        lastIndex = at;
      }
      // Exactly one alias pair per column — the request plus the missing key columns.
      expect(dax.match(/^ {4},"/gm)).toHaveLength(projected(DEFAULT_PO_COLUMNS).length);
    });

    it('collapses duplicate column names before building the query', async () => {
      await listPoRows([STR, INT, STR, INT, STR]);
      const dax = sentDax();
      // STR and INT are key columns themselves; only _line_id is added.
      expect(dax.match(/^ {4},"/gm)).toHaveLength(3);
      expect(dax.split(`"${STR}"`)).toHaveLength(2);
      expect(dax.split(`"${INT}"`)).toHaveLength(2);
      expect(dax.split(`"${LINE_ID}"`)).toHaveLength(2);
    });
  });

  describe('key columns', () => {
    it('exposes the three note-join keys, all in the catalog', () => {
      expect(PO_KEY_COLUMNS).toEqual([LINE_ID, STR, INT]);
      for (const name of PO_KEY_COLUMNS) {
        expect(PO_COLUMNS.some((c) => c.name === name)).toBe(true);
      }
    });

    it('always projects the key columns, after the requested ones, without duplicates', async () => {
      await listPoRows([DBL, DATE]);
      const dax = sentDax();
      const order = [DBL, DATE, ...PO_KEY_COLUMNS].map((n) => dax.indexOf(`"${n}"`));
      expect(order.every((at) => at >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(dax.match(/^ {4},"/gm)).toHaveLength(5);

      executeQuery.mockClear();
      await listPoRows([INT, DBL, LINE_ID]);
      expect(sentDax().match(/^ {4},"/gm)).toHaveLength(4);
    });

    it('does not count the key columns against MAX_PO_COLUMNS', async () => {
      const nonKeys = PO_COLUMNS.map((c) => c.name).filter((n) => !PO_KEY_COLUMNS.includes(n));
      const exactly = nonKeys.slice(0, MAX_PO_COLUMNS);
      await expect(listPoRows(exactly)).resolves.toEqual([]);
      expect(sentDax().match(/^ {4},"/gm)).toHaveLength(MAX_PO_COLUMNS + PO_KEY_COLUMNS.length);
      await expect(listPoRows(nonKeys.slice(0, MAX_PO_COLUMNS + 1))).rejects.toThrow(
        `Pick at most ${MAX_PO_COLUMNS} columns`
      );
    });

    it('projects extra columns uncapped and rejects unknown extras before querying', async () => {
      const nonKeys = PO_COLUMNS.map((c) => c.name).filter((n) => !PO_KEY_COLUMNS.includes(n));
      await listPoRows(nonKeys.slice(0, MAX_PO_COLUMNS), ['_pickup_date', '_eta']);
      expect(sentDax()).toContain('"_pickup_date"');
      expect(sentDax().match(/^ {4},"/gm)).toHaveLength(
        new Set([...nonKeys.slice(0, MAX_PO_COLUMNS), ...PO_KEY_COLUMNS, '_pickup_date', '_eta']).size
      );

      executeQuery.mockClear();
      await expect(listPoRows([DBL], ['_nope'])).rejects.toThrow('Unknown PO view column(s): _nope.');
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it('fills a key column with null when the result lacks it', async () => {
      executeQuery.mockResolvedValue(success([`[${DBL}]`], [[1.5]]));
      const [row] = await listPoRows([DBL]);
      expect(row).toEqual({ [DBL]: 1.5, [LINE_ID]: null, [STR]: null, [INT]: null });
    });
  });

  describe('validation', () => {
    it('rejects an empty selection without querying', async () => {
      await expect(listPoRows([])).rejects.toThrow('Pick at least one column.');
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it('rejects unknown column names (DAX-injection guard) without querying', async () => {
      const evil = `_po_no_ekporef]) ,"x", '_PO_VIEW_'[_po_remarks`;
      await expect(listPoRows([STR, 'nope', evil])).rejects.toThrow(
        `Unknown PO view columns: nope, ${evil}.`
      );
      await expect(listPoRows(['_tbd_1'])).rejects.toThrow(
        'Unknown PO view column: _tbd_1.'
      );
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it('rejects more than MAX_PO_COLUMNS distinct columns without querying', async () => {
      const tooMany = PO_COLUMNS.slice(0, MAX_PO_COLUMNS + 1).map((c) => c.name);
      await expect(listPoRows(tooMany)).rejects.toThrow(
        `Pick at most ${MAX_PO_COLUMNS} columns (you picked ${MAX_PO_COLUMNS + 1}).`
      );
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it('counts distinct names against the cap, so duplicates do not trip it', async () => {
      const exactly = PO_COLUMNS.slice(0, MAX_PO_COLUMNS).map((c) => c.name);
      await expect(listPoRows([...exactly, ...exactly])).resolves.toEqual([]);
      expect(executeQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('row mapping', () => {
    it('maps bracketed column names ([alias]) by catalog type', async () => {
      executeQuery.mockResolvedValue(
        success(
          MIXED.map((n) => `[${n}]`),
          [['  4500001234 ', 10, 12.5, '2026-09-16T00:00:00']]
        )
      );
      const [row] = await listPoRows(MIXED);
      expect(row).toEqual({
        [STR]: '4500001234',
        [INT]: 10,
        [DBL]: 12.5,
        [DATE]: '2026-09-16',
        [LINE_ID]: null,
      });
    });

    it('maps bare column names the same way, regardless of result column order', async () => {
      executeQuery.mockResolvedValue(
        success(
          [DATE, DBL, INT, STR],
          [['2026-09-16T00:00:00.000', 0.25, 7, 'PO-9']]
        )
      );
      const [row] = await listPoRows(MIXED);
      expect(row).toEqual({
        [STR]: 'PO-9',
        [INT]: 7,
        [DBL]: 0.25,
        [DATE]: '2026-09-16',
        [LINE_ID]: null,
      });
    });

    it('keeps the key set equal to the requested columns plus missing key columns, in that order', async () => {
      executeQuery.mockResolvedValue(success([`[${INT}]`, `[${STR}]`], [[1, 'A']]));
      const [row] = await listPoRows([STR, INT]);
      expect(Object.keys(row)).toEqual([STR, INT, LINE_ID]);
    });

    it('string: trims; blank, whitespace, null and missing columns become null', async () => {
      executeQuery.mockResolvedValue(
        success([`[${STR}]`], [[''], ['   '], [null], [undefined], [' x ']])
      );
      const rows = await listPoRows([STR, '_client_name']);
      expect(rows.map((r) => r[STR])).toEqual([null, null, null, null, 'x']);
      expect(rows.every((r) => r._client_name === null)).toBe(true);
    });

    it('int64 / double: numbers pass through, numeric strings coerce, junk and blanks become null', async () => {
      executeQuery.mockResolvedValue(
        success(
          [`[${INT}]`, `[${DBL}]`],
          [
            [10, 1.5],
            ['12', '0.5'],
            ['abc', 'NaN'],
            ['', null],
            [0, -0.1],
          ]
        )
      );
      const rows = await listPoRows([INT, DBL]);
      expect(rows.map((r) => [r[INT], r[DBL]])).toEqual([
        [10, 1.5],
        [12, 0.5],
        [null, null],
        [null, null],
        [0, -0.1],
      ]);
    });

    it('dateTime: takes the date part verbatim, no timezone shift; junk becomes null', async () => {
      executeQuery.mockResolvedValue(
        success(
          [`[${DATE}]`],
          [
            ['2026-01-01T00:00:00'],
            ['2026-12-31T23:59:59.999'],
            [new Date(Date.UTC(2026, 5, 15))],
            ['not a date'],
            [null],
            [''],
          ]
        )
      );
      const rows = await listPoRows([DATE]);
      expect(rows.map((r) => r[DATE])).toEqual([
        '2026-01-01',
        '2026-12-31',
        '2026-06-15',
        null,
        null,
        null,
      ]);
    });

    it('returns an empty list for an empty result', async () => {
      executeQuery.mockResolvedValue(success(DEFAULT_PO_COLUMNS.map((n) => `[${n}]`), []));
      expect(await listPoRows(DEFAULT_PO_COLUMNS)).toEqual([]);
    });
  });

  describe('error categories', () => {
    it('reports overflow with the row limit', async () => {
      executeQuery.mockResolvedValue(
        failure('overflow', 'More than 50000 rows in a query result')
      );
      await expect(listPoRows([STR])).rejects.toThrow(/more than 50,000 rows/);
    });

    it('reports api errors with the permission and tenant-setting hints', async () => {
      executeQuery.mockResolvedValue(failure('api', 'PowerBIFeatureDisabled'));
      const err = await listPoRows([STR]).catch((e: Error) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('PowerBIFeatureDisabled');
      expect((err as Error).message).toContain('Build permission');
      expect((err as Error).message).toContain('Dataset Execute Queries REST API');
    });

    it.each(['query', 'network', 'unknown'])(
      'passes the %s error message through',
      async (category) => {
        executeQuery.mockResolvedValue(failure(category, `boom ${category}`));
        await expect(listPoRows([STR])).rejects.toThrow(`boom ${category}`);
      }
    );

    it('wraps a thrown transport error in a readable message', async () => {
      executeQuery.mockRejectedValue(new Error('socket hang up'));
      await expect(listPoRows([STR])).rejects.toThrow(
        'Could not reach the Coms report model: socket hang up'
      );
    });
  });
});
