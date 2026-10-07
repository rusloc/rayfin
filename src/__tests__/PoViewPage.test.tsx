import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { PoViewPage } from '@/pages/PoViewPage';
import { saveLineNote } from '@/services/poNotes';
import { listPoRows } from '@/services/poView';

vi.mock('@/hooks/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn(), user: { id: 'u1', email: 'user@example.com' } }),
}));

vi.mock('@/services/poView', () => ({
  listPoRows: vi.fn(async (columns: string[]) =>
    Array.from({ length: 50 }, (_, i) => {
      const row: Record<string, string | number | null> = {};
      for (const c of columns) row[c] = null;
      return Object.assign(row, {
        _line_id: `line-${i}`,
        _po_no_ekporef: `1250420${i}`,
        _line_no: 1,
        _master_line: 'Master',
        _supplier_name: 'INFLIGHT DIRECT INC.',
        _po_need_by_date: '2026-09-16',
        _client_name: 'EMIRATES AIRLINE',
        _pickup_date: '2026-08-01',
        _etd: '2026-08-10',
        // Lines 1-5 are long overdue and not arrived; line 6 is overdue but arrived.
        ...(i >= 1 && i <= 6 ? { _eta: '2020-01-01', _arrival_date_actual: i === 6 ? '2020-01-10' : null } : {}),
        // Late lines by creation day: 01-Sep ×2, 03-Sep ×2, line 4 undated; line 6 (arrived) is not late.
        ...(i >= 1 && i <= 6 ? { _po_creation_date: [null, '2026-09-01', '2026-09-01', '2026-09-03', null, '2026-09-03', '2026-09-02'][i] } : {}),
      });
    })
  ),
}));

const note = (over: Record<string, unknown>) => ({
  id: 'n-other',
  lineId: 'line-0',
  poNo: '12504200',
  lineNo: '1',
  flagged: true,
  comment: 'Supplier confirmed new ETD',
  authorEmail: 'colleague@example.com',
  userId: 'u2',
  createdAt: '2026-10-07T10:00:00.000Z',
  updatedAt: '2026-10-07T10:00:00.000Z',
  ...over,
});

vi.mock('@/services/poNotes', () => ({
  listPoNotes: vi.fn(async () => [note({})]),
  saveLineNote: vi.fn(async (line: { lineId: string }, state: { flagged: boolean; comment: string | null }) =>
    note({ id: `n-${line.lineId}`, lineId: line.lineId, userId: 'u1', authorEmail: 'user@example.com', ...state })
  ),
}));

// AG Grid reports a missing module through console.error and carries on with
// `undefined`, so these errors are the only signal before production breaks.
let gridErrors: string[];
beforeEach(() => {
  gridErrors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(' ');
    if (text.includes('AG Grid')) gridErrors.push(text);
  });
});
afterEach(() => vi.restoreAllMocks());

const settle = () => act(() => new Promise((r) => setTimeout(r, 400)));

test('renders rows, searches via the panel, clears and re-queries on column apply', async () => {
  render(
    <MemoryRouter>
      <PoViewPage />
    </MemoryRouter>
  );

  expect(await screen.findByText('50 of 50 lines')).toBeTruthy();
  expect(screen.getAllByText('INFLIGHT DIRECT INC.').length).toBeGreaterThan(0);
  expect(screen.getByText('PO No. (EKPO Ref)')).toBeTruthy();

  // One header row that only sorts: no floating filters, no header filter buttons.
  expect(document.querySelector('.ag-floating-filter')).toBeNull();
  expect(document.querySelector('.ag-header-cell-filter-button')).toBeNull();

  fireEvent.click(screen.getByLabelText('Search'));
  fireEvent.change(screen.getByLabelText('PO No.'), { target: { value: 'no-such-po' } });
  fireEvent.click(screen.getAllByText('Search').at(-1)!);
  expect(await screen.findByText('0 of 50 lines')).toBeTruthy();

  fireEvent.click(screen.getByText('Clear filters'));
  expect(await screen.findByText('50 of 50 lines')).toBeTruthy();

  // Need-by range is inclusive on both ends (all mock rows are 2026-09-16).
  fireEvent.click(screen.getByLabelText('Search'));
  fireEvent.change(screen.getByLabelText('Need-by from'), { target: { value: '2026-09-16' } });
  fireEvent.change(screen.getByLabelText('Need-by to'), { target: { value: '2026-09-16' } });
  fireEvent.click(screen.getAllByText('Search').at(-1)!);
  await settle();
  expect(screen.getByText('50 of 50 lines')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Search'));
  fireEvent.change(screen.getByLabelText('Need-by from'), { target: { value: '2026-09-17' } });
  fireEvent.click(screen.getAllByText('Search').at(-1)!);
  expect(await screen.findByText('0 of 50 lines')).toBeTruthy();
  fireEvent.click(screen.getByText('Clear filters'));
  await settle();

  fireEvent.click(screen.getByText('Columns · 16'));
  fireEvent.click(screen.getByLabelText('TEUs'));
  fireEvent.click(screen.getByText('Apply'));
  await settle();
  expect(vi.mocked(listPoRows).mock.calls.at(-1)?.[0]).toEqual(expect.arrayContaining(['_teus']));
  expect(screen.getByText('Columns · 17')).toBeTruthy();

  expect(gridErrors).toEqual([]);
});

test('column picker select / deselect all respect the cap and the search', async () => {
  render(
    <MemoryRouter>
      <PoViewPage />
    </MemoryRouter>
  );
  await screen.findByText('50 of 50 lines');
  fireEvent.click(screen.getByText('Columns · 16'));

  fireEvent.click(screen.getByText('Deselect all'));
  expect(screen.getByText('0 of max 25 selected')).toBeTruthy();
  expect((screen.getByText('Apply') as HTMLButtonElement).disabled).toBe(true);

  fireEvent.click(screen.getByText('Select all'));
  expect(screen.getByText('25 of max 25 selected')).toBeTruthy();
  expect((screen.getByText('Select all') as HTMLButtonElement).disabled).toBe(true);

  fireEvent.change(screen.getByPlaceholderText('Search columns…'), { target: { value: 'eta' } });
  fireEvent.click(screen.getByText('Deselect all shown'));
  const left = Number(screen.getByText(/of max 25 selected/).textContent?.split(' ')[0]);
  expect(left).toBeLessThan(25);

  fireEvent.click(screen.getByText('Select all shown'));
  expect(screen.getByText('25 of max 25 selected')).toBeTruthy();
  expect(gridErrors).toEqual([]);
});

test("notes: a colleague's shared note is shown, editable by me, and flags toggle", async () => {
  render(
    <MemoryRouter>
      <PoViewPage />
    </MemoryRouter>
  );
  await screen.findByText('50 of 50 lines');

  // Line 0 carries a colleague's flagged note; I see it and can rewrite it.
  fireEvent.click(await screen.findByText('💬 note'));
  const comment = (await screen.findByPlaceholderText('Add a comment…')) as HTMLTextAreaElement;
  expect(comment.value).toBe('Supplier confirmed new ETD');
  expect(screen.getByText('colleague@example.com')).toBeTruthy();

  fireEvent.change(comment, { target: { value: '  chase supplier  ' } });
  fireEvent.click(screen.getByText('Save'));
  await settle();
  expect(vi.mocked(saveLineNote)).toHaveBeenLastCalledWith(
    { lineId: 'line-0', poNo: '12504200', lineNo: '1' },
    { flagged: true, comment: 'chase supplier' }
  );
  expect(screen.queryByLabelText('PO line notes')).toBeNull();
  expect(screen.getAllByText('💬 note')).toHaveLength(1); // still one note on the line, rewritten
  expect(screen.getByTitle('chase supplier')).toBeTruthy();

  const flags = screen.getAllByLabelText('Flag this line');
  fireEvent.click(flags[0]);
  await settle();
  expect(vi.mocked(saveLineNote)).toHaveBeenLastCalledWith(
    { lineId: 'line-1', poNo: '12504201', lineNo: '1' },
    { flagged: true, comment: null }
  );
  expect(gridErrors).toEqual([]);
});

test('search by flag and by comment runs over shared notes', async () => {
  render(
    <MemoryRouter>
      <PoViewPage />
    </MemoryRouter>
  );
  await screen.findByText('50 of 50 lines');
  await screen.findByText('💬 note');

  const runSearch = (setup: () => void) => {
    fireEvent.click(screen.getByLabelText('Search'));
    setup();
    fireEvent.click(screen.getAllByText('Search').at(-1)!);
  };

  runSearch(() => fireEvent.click(screen.getByText('✓ Flagged')));
  expect(await screen.findByText('1 of 50 lines')).toBeTruthy();

  runSearch(() => fireEvent.click(screen.getByText('✗ Not flagged')));
  expect(await screen.findByText('49 of 50 lines')).toBeTruthy();

  runSearch(() => {
    fireEvent.click(within(screen.getByRole('group', { name: 'Flag' })).getByText('Any'));
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'CONFIRMED' } });
  });
  expect(await screen.findByText('1 of 50 lines')).toBeTruthy();

  runSearch(() => fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'nothing-like-this' } }));
  expect(await screen.findByText('0 of 50 lines')).toBeTruthy();

  fireEvent.click(screen.getByText('Clear filters'));
  expect(await screen.findByText('50 of 50 lines')).toBeTruthy();
  expect(gridErrors).toEqual([]);
});

test('shipment path: first column opens a popup with supplier, milestones and client', async () => {
  render(
    <MemoryRouter>
      <PoViewPage />
    </MemoryRouter>
  );
  await screen.findByText('50 of 50 lines');
  expect(vi.mocked(listPoRows).mock.calls.at(-1)?.[1]).toEqual(
    expect.arrayContaining(['_supplier_name', '_client_name', '_pickup_date', '_etd', '_eta', '_arrival_date_actual'])
  );

  const [icon] = await screen.findAllByLabelText('Show shipment path');
  const cell = icon.closest('.ag-cell');
  expect(cell?.getAttribute('col-id')).toBe('__journey');
  expect(cell?.getAttribute('aria-colindex')).toBe('1'); // first column from the left
  expect(icon.className).toContain('cursor-pointer');

  fireEvent.click(icon);
  const dialog = await screen.findByRole('dialog', { name: 'Shipment path' });
  const lines = dialog.textContent ?? '';
  expect(lines.indexOf('INFLIGHT DIRECT INC.')).toBeLessThan(lines.indexOf('Pickup date'));
  expect(lines.indexOf('Arrival date (actual)')).toBeLessThan(lines.indexOf('EMIRATES AIRLINE'));
  expect(lines).toMatch(/Pickup date01-Aug-2026ETD10-Aug-2026ETANo date yetArrival date \(actual\)No date yet/);

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(gridErrors).toEqual([]);
});

test('late rule: overdue unarrived lines are pale red and searchable', async () => {
  render(
    <MemoryRouter>
      <PoViewPage />
    </MemoryRouter>
  );
  await screen.findByText('50 of 50 lines');

  const rowOf = (lineId: string) => document.querySelector(`.ag-row[row-id="${lineId}"]`);
  await screen.findAllByLabelText('Show shipment path');
  expect(rowOf('line-1')?.classList.contains('po-row-late')).toBe(true);
  expect(rowOf('line-6')?.classList.contains('po-row-late')).toBe(false); // arrived
  expect(rowOf('line-7')?.classList.contains('po-row-late')).toBe(false); // no ETA

  const runSearch = (choice: string) => {
    fireEvent.click(screen.getByLabelText('Search'));
    fireEvent.click(screen.getByRole('button', { name: choice }));
    fireEvent.click(screen.getAllByText('Search').at(-1)!);
  };
  runSearch('Late');
  expect(await screen.findByText('5 of 50 lines')).toBeTruthy();
  runSearch('Not late');
  expect(await screen.findByText('45 of 50 lines')).toBeTruthy();

  fireEvent.click(screen.getByText('Clear filters'));
  expect(await screen.findByText('50 of 50 lines')).toBeTruthy();
  expect(gridErrors).toEqual([]);
});

test('late chart: title icon opens a 16:9 popup counting late lines per creation day, own date filter', async () => {
  render(
    <MemoryRouter>
      <PoViewPage />
    </MemoryRouter>
  );
  await screen.findByText('50 of 50 lines');
  expect(vi.mocked(listPoRows).mock.calls.at(-1)?.[1]).toEqual(expect.arrayContaining(['_po_creation_date']));

  fireEvent.click(screen.getByLabelText('Late lines chart'));
  const dialog = await screen.findByRole('dialog', { name: 'Late lines chart' });
  expect(dialog.className).toContain('aspect-video');
  const chart = within(dialog);

  // Day axis 01..03 Sep, the empty 02-Sep included; count above every bar.
  expect(chart.getByText('01-Sep-26')).toBeTruthy();
  expect(chart.getByText('02-Sep-26')).toBeTruthy();
  expect(chart.getByText('03-Sep-26')).toBeTruthy();
  expect(chart.getByRole('img', { name: '01-Sep-2026: 2 late lines' })).toBeTruthy();
  expect(chart.getByRole('img', { name: '03-Sep-2026: 2 late lines' })).toBeTruthy();
  expect(chart.getAllByRole('img')).toHaveLength(2);
  expect(dialog.textContent).toContain('4 late lines in range');
  expect(dialog.textContent).toContain('1 without a creation date');

  // The chart's own From date narrows the chart only.
  fireEvent.change(chart.getByLabelText('From'), { target: { value: '2026-09-02' } });
  expect(chart.queryByText('01-Sep-26')).toBeNull();
  expect(dialog.textContent).toContain('2 late lines in range');
  fireEvent.click(chart.getByText('All dates'));
  expect(chart.getByText('01-Sep-26')).toBeTruthy();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('50 of 50 lines')).toBeTruthy();
  expect(gridErrors).toEqual([]);
});
