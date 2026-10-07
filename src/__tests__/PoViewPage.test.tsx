import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { PoViewPage } from '@/pages/PoViewPage';
import { listPoRows } from '@/services/poView';

vi.mock('@/hooks/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn(), user: { email: 'user@example.com' } }),
}));

vi.mock('@/services/poView', () => ({
  listPoRows: vi.fn(async (columns: string[]) =>
    Array.from({ length: 50 }, (_, i) => {
      const row: Record<string, string | number | null> = {};
      for (const c of columns) row[c] = null;
      return Object.assign(row, {
        _po_no_ekporef: `1250420${i}`,
        _line_no: 1,
        _master_line: 'Master',
        _supplier_name: 'INFLIGHT DIRECT INC.',
        _po_need_by_date: '2026-09-16',
      });
    })
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
