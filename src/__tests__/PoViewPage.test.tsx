import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { PoViewPage } from '@/pages/PoViewPage';
import { saveMyNote } from '@/services/poNotes';
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
  saveMyNote: vi.fn(async (line: { lineId: string }, state: { flagged: boolean; comment: string | null }) =>
    note({ id: 'n-mine', lineId: line.lineId, userId: 'u1', authorEmail: 'user@example.com', ...state })
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

test('renders rows, filters, clears filters and re-queries on column apply', async () => {
  render(
    <MemoryRouter>
      <PoViewPage />
    </MemoryRouter>
  );

  expect(await screen.findByText('50 of 50 lines')).toBeTruthy();
  expect(screen.getAllByText('INFLIGHT DIRECT INC.').length).toBeGreaterThan(0);
  expect(screen.getByText('PO No. (EKPO Ref)')).toBeTruthy();

  const [poFilter] = document.querySelectorAll<HTMLInputElement>(
    '.ag-floating-filter input[type=text]'
  );
  fireEvent.input(poFilter, { target: { value: 'no-such-po' } });
  // Floating filters are debounced.
  expect(await screen.findByText('0 of 50 lines', {}, { timeout: 2000 })).toBeTruthy();

  fireEvent.click(screen.getByText('Clear filters'));
  await settle();
  expect(screen.getByText('50 of 50 lines')).toBeTruthy();

  fireEvent.click(screen.getByText('Columns · 16'));
  fireEvent.click(screen.getByLabelText('TEUs'));
  fireEvent.click(screen.getByText('Apply'));
  await settle();
  expect(vi.mocked(listPoRows)).toHaveBeenLastCalledWith(expect.arrayContaining(['_teus']));
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

test('notes: others are shown, my flag toggles, my comment saves', async () => {
  render(
    <MemoryRouter>
      <PoViewPage />
    </MemoryRouter>
  );
  await screen.findByText('50 of 50 lines');

  // Line 0 carries a colleague's flagged note.
  fireEvent.click(await screen.findByText('💬 1'));
  expect(await screen.findByText('Supplier confirmed new ETD')).toBeTruthy();
  expect(screen.getByText('colleague@example.com')).toBeTruthy();

  fireEvent.change(screen.getByPlaceholderText('Add a comment…'), { target: { value: '  chase supplier  ' } });
  fireEvent.click(screen.getByText('Save'));
  await settle();
  expect(vi.mocked(saveMyNote)).toHaveBeenLastCalledWith(
    { lineId: 'line-0', poNo: '12504200', lineNo: '1' },
    { flagged: false, comment: 'chase supplier' }
  );
  expect(screen.queryByLabelText('PO line notes')).toBeNull();
  expect(await screen.findByText('💬 2')).toBeTruthy();

  const flags = screen.getAllByLabelText('Flag this line');
  fireEvent.click(flags[1]);
  await settle();
  expect(vi.mocked(saveMyNote)).toHaveBeenLastCalledWith(
    { lineId: 'line-1', poNo: '12504201', lineNo: '1' },
    { flagged: true, comment: null }
  );
  expect(gridErrors).toEqual([]);
});
