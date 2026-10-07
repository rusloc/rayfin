import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeQuery } = vi.hoisted(() => ({ executeQuery: vi.fn() }));

vi.mock('@/services/rayfinClient', () => ({
  isLocalBackend: () => false,
  getRayfinClient: () => ({
    connectors: { comsreport: { executeQuery } },
  }),
}));

import { PO_ROW_LIMIT, PO_VIEW_DAX, listPoLines } from '@/services/poView';

const ALIASES = [
  'poNo',
  'lineNo',
  'masterLine',
  'supplierName',
  'clientName',
  'branchBu',
  'itemCode',
  'commodity',
  'poStatus',
  'poCreationDate',
  'poNeedByDate',
  'etd',
  'eta',
  'transportMode',
  'originCountry',
  'destinationCountry',
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

const FULL_ROW = [
  '4500001234',
  10,
  '4500001234-10',
  'ACME Ltd',
  'Client A',
  'BU-01',
  'ITEM-7',
  'Steel',
  'Open',
  '2026-03-05T00:00:00.000',
  '2026-04-01T00:00:00',
  '2026-04-10T00:00:00.000',
  '2026-05-02T00:00:00.000',
  'Sea',
  'CN',
  'DE',
];

describe('poView service', () => {
  beforeEach(() => {
    executeQuery.mockReset();
  });

  it('passes the DAX and the row limit to the connector', async () => {
    executeQuery.mockResolvedValue(success([], []));
    await listPoLines();
    expect(executeQuery).toHaveBeenCalledTimes(1);
    expect(executeQuery).toHaveBeenCalledWith({
      query: PO_VIEW_DAX,
      resultSetRowCountLimit: PO_ROW_LIMIT,
    });
    expect(PO_ROW_LIMIT).toBe(50_000);
    expect(PO_VIEW_DAX).toMatch(/^EVALUATE\s+SELECTCOLUMNS \(/);
    expect(PO_VIEW_DAX).toContain("'_PO_VIEW_'[_destination_country_dest]");
  });

  it('maps bracketed column names ([alias]) to PoLine', async () => {
    executeQuery.mockResolvedValue(
      success(
        ALIASES.map((a) => `[${a}]`),
        [FULL_ROW]
      )
    );
    const [line] = await listPoLines();
    expect(line).toEqual({
      poNo: '4500001234',
      lineNo: 10,
      masterLine: '4500001234-10',
      supplierName: 'ACME Ltd',
      clientName: 'Client A',
      branchBu: 'BU-01',
      itemCode: 'ITEM-7',
      commodity: 'Steel',
      poStatus: 'Open',
      poCreationDate: '2026-03-05',
      poNeedByDate: '2026-04-01',
      etd: '2026-04-10',
      eta: '2026-05-02',
      transportMode: 'Sea',
      originCountry: 'CN',
      destinationCountry: 'DE',
    });
  });

  it('maps unbracketed column names the same way, regardless of column order', async () => {
    const reversed = [...ALIASES].reverse();
    const reversedRow = [...FULL_ROW].reverse();
    executeQuery.mockResolvedValue(success(reversed, [reversedRow]));
    const [line] = await listPoLines();
    expect(line.poNo).toBe('4500001234');
    expect(line.lineNo).toBe(10);
    expect(line.eta).toBe('2026-05-02');
    expect(line.destinationCountry).toBe('DE');
  });

  it('truncates dates to the date part without a timezone shift', async () => {
    executeQuery.mockResolvedValue(
      success(
        ['[poCreationDate]', '[poNeedByDate]', '[etd]', '[eta]'],
        [
          [
            '2026-01-01T00:00:00',
            '2026-12-31T23:59:59.999',
            new Date(Date.UTC(2026, 5, 15)),
            'not a date',
          ],
        ]
      )
    );
    const [line] = await listPoLines();
    expect(line.poCreationDate).toBe('2026-01-01');
    expect(line.poNeedByDate).toBe('2026-12-31');
    expect(line.etd).toBe('2026-06-15');
    expect(line.eta).toBeNull();
  });

  it('turns blanks, nulls and missing columns into null; coerces numeric strings', async () => {
    executeQuery.mockResolvedValue(
      success(
        ['[poNo]', '[lineNo]', '[supplierName]', '[etd]'],
        [
          ['', '12', '   ', ''],
          [null, null, null, null],
          ['PO-1', 'abc', 'S', '2026-02-02T00:00:00'],
        ]
      )
    );
    const lines = await listPoLines();
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({
      poNo: null,
      lineNo: 12,
      supplierName: null,
      etd: null,
      clientName: null,
      eta: null,
    });
    expect(lines[1]).toMatchObject({ poNo: null, lineNo: null, etd: null });
    expect(lines[2]).toMatchObject({
      poNo: 'PO-1',
      lineNo: null,
      supplierName: 'S',
      etd: '2026-02-02',
    });
  });

  it('returns an empty list for an empty result', async () => {
    executeQuery.mockResolvedValue(success(ALIASES, []));
    expect(await listPoLines()).toEqual([]);
  });

  it('reports overflow with the row limit', async () => {
    executeQuery.mockResolvedValue(
      failure('overflow', 'More than 50000 rows in a query result')
    );
    await expect(listPoLines()).rejects.toThrow(/more than 50,000 rows/);
  });

  it('reports api errors with the permission and tenant-setting hints', async () => {
    executeQuery.mockResolvedValue(failure('api', 'PowerBIFeatureDisabled'));
    const err = await listPoLines().catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('PowerBIFeatureDisabled');
    expect((err as Error).message).toContain('Build permission');
    expect((err as Error).message).toContain(
      'Dataset Execute Queries REST API'
    );
  });

  it.each(['query', 'network', 'unknown'])(
    'passes the %s error message through',
    async (category) => {
      executeQuery.mockResolvedValue(failure(category, `boom ${category}`));
      await expect(listPoLines()).rejects.toThrow(`boom ${category}`);
    }
  );

  it('wraps a thrown transport error in a readable message', async () => {
    executeQuery.mockRejectedValue(new Error('socket hang up'));
    await expect(listPoLines()).rejects.toThrow(
      'Could not reach the Coms report model: socket hang up'
    );
  });
});
