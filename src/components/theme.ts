/** Colour themes; the palettes live in main.css under `:root[data-theme=…]`. */
export const THEMES = ['light', 'dark', 'dark-gray'] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = 'coms-theme';

/** The viewer's remembered theme, or 'light' (storage may be blocked or empty). */
export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(saved as Theme) ? (saved as Theme) : 'light';
  } catch {
    return 'light';
  }
}

/** Paint `theme` (sets `data-theme` on <html>) and remember it for next visit. */
export function applyTheme(theme: Theme, remember = true): void {
  document.documentElement.dataset.theme = theme;
  if (!remember) return;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the theme still applies for this page load.
  }
}
