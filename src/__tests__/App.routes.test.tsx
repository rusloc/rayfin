import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import App from '@/App';
import { AppHeader } from '@/components/AppHeader';

vi.mock('@/hooks/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false, signOut: vi.fn(), user: { id: 'u1', email: 'u@example.com' } }),
}));
vi.mock('@/pages/PoViewPage', () => ({ PoViewPage: () => <p>PO PAGE</p> }));
vi.mock('@/pages/HomePage', () => ({ HomePage: () => <p>NAMES PAGE</p> }));

afterEach(() => window.history.pushState({}, '', '/'));

test('root lands on the PO view', async () => {
  window.history.pushState({}, '', '/');
  render(<App />);
  expect(await screen.findByText('PO PAGE')).toBeTruthy();
  expect(window.location.pathname).toBe('/po');
});

test('names register stays reachable by URL', async () => {
  window.history.pushState({}, '', '/names');
  render(<App />);
  expect(await screen.findByText('NAMES PAGE')).toBeTruthy();
});

test('header nav no longer offers the names register', () => {
  render(
    <MemoryRouter>
      <AppHeader title="COMS" />
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: 'PO view' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Names' })).toBeNull();
});
