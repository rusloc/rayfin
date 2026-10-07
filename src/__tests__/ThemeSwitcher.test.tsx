import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { readTheme } from '@/components/theme';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

test('switches light / dark / dark-gray, paints <html> and remembers the choice', () => {
  render(<ThemeSwitcher />);
  expect(screen.getByRole('button', { name: 'Light theme' }).getAttribute('aria-pressed')).toBe('true');

  fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(screen.getByRole('button', { name: 'Dark theme' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Light theme' }).getAttribute('aria-pressed')).toBe('false');
  expect(readTheme()).toBe('dark');

  fireEvent.click(screen.getByRole('button', { name: 'Dark gray theme' }));
  expect(document.documentElement.dataset.theme).toBe('dark-gray');
  expect(readTheme()).toBe('dark-gray');
});

test('falls back to light when storage holds junk or is blocked', () => {
  localStorage.setItem('coms-theme', 'neon');
  expect(readTheme()).toBe('light');

  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(readTheme()).toBe('light');
});
